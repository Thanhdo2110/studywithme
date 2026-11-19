"use strict";

/* ==========================================================================
   StudyWithMe — lớp nghiệp vụ: phiên đăng nhập (Redis), phòng, chat, focus,
   cửa hàng, thống kê. Postgres cho dữ liệu bền vững, Redis cho phiên và
   credit focus.
   ========================================================================== */

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const U = require("./util");
const DB = require("./db");

const SESSION_TTL = 30 * 24 * 3600 * 1000;
const PRESENCE_WINDOW = 5 * 60 * 1000;
/* Ghế của người đã rời phòng quá lâu được trả lại để phòng không bị "đầy ảo". */
const MEMBER_TTL = 30 * 60 * 1000;
const FOCUS_KEY_TTL = 3600;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "uploads");

/* -------------------------------------------------------------------------- */
/* Phiên đăng nhập (Redis, TTL tự dọn)                                         */
/* -------------------------------------------------------------------------- */

async function createSession(ctx, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await ctx.kv.set(`swm:sess:${token}`, userId, { EX: Math.floor(SESSION_TTL / 1000) });
  return token;
}

async function destroySession(ctx, token) {
  if (!token) return;
  await ctx.kv.del(`swm:sess:${token}`);
}

async function userByToken(ctx, token) {
  if (!token) return null;
  const userId = await ctx.kv.get(`swm:sess:${token}`);
  if (!userId) return null;
  const { rows } = await ctx.pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!rows[0]) {
    /* Tài khoản đã bị dọn (guest hết hạn) nhưng phiên còn trong Redis. */
    await ctx.kv.del(`swm:sess:${token}`);
    return null;
  }
  return rows[0];
}

async function ensureGuest(ctx) {
  return DB.createUser(ctx.pool, { isGuest: true });
}

async function upgradeGuest(ctx, user, { name, email, password }) {
  const result = await U.hashPassword(password);
  const { rows } = await ctx.pool.query(
    `UPDATE users SET email = $1, pass_hash = $2, pass_salt = $3, name = $4, is_guest = FALSE
     WHERE id = $5 RETURNING *`,
    [email, result.hash, result.salt, name, user.id]
  );
  return rows[0];
}

async function createAccount(ctx, { name, email, password }) {
  return DB.createUser(ctx.pool, { name, email, password, isGuest: false });
}

/* -------------------------------------------------------------------------- */
/* Hồ sơ                                                                       */
/* -------------------------------------------------------------------------- */

function serializeProfile(user) {
  return {
    name: user.name,
    grade: user.grade,
    exam: user.exam,
    examDate: user.exam_date,
    targetSchool: user.target_school,
    goalHours: user.goal_hours,
    avatar: user.avatar,
    accent: user.accent,
    theme: user.theme,
    bio: user.bio,
    stars: user.stars,
    streak: user.streak,
    reminders: Boolean(user.reminders),
    sounds: Boolean(user.sounds),
    heartbeat: Boolean(user.heartbeat),
  };
}

function serializeAccount(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isGuest: Boolean(user.is_guest),
    createdAt: user.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Phòng học                                                                   */
/* -------------------------------------------------------------------------- */

/* `room_members` là "đã tham gia" và được giữ lại cho tới khi người dùng rời
   phòng — nhờ vậy "Phòng của tôi" mới có nghĩa. Chỗ ngồi, số người trong
   phòng và danh sách thành viên chỉ tính người còn hoạt động trong MEMBER_TTL. */
function activeSince() {
  return Date.now() - MEMBER_TTL;
}

async function realMemberCount(queryable, roomId) {
  const { rows } = await queryable.query(
    "SELECT COUNT(*)::int AS n FROM room_members WHERE room_id = $1 AND last_seen >= $2",
    [roomId, activeSince()]
  );
  return Number(rows[0] ? rows[0].n : 0);
}

/* Đếm một lượt cho cả danh sách phòng thay vì N query riêng lẻ. */
async function memberCounts(queryable, roomIds) {
  const counts = new Map();
  if (!roomIds.length) return counts;
  const { rows } = await queryable.query(
    `SELECT room_id, COUNT(*)::int AS n FROM room_members
     WHERE last_seen >= $1 AND room_id = ANY($2::text[])
     GROUP BY room_id`,
    [activeSince(), roomIds]
  );
  rows.forEach((row) => counts.set(row.room_id, Number(row.n)));
  return counts;
}

/* Những phòng người dùng thực sự đang có mặt (còn hoạt động), dùng để biết
   thẻ phòng ở Sảnh chính nên hiện "Vào phòng" hay "Đã đầy". */
async function joinedRoomIds(queryable, userId, roomIds) {
  const set = new Set();
  if (!roomIds.length) return set;
  const { rows } = await queryable.query(
    `SELECT room_id FROM room_members
     WHERE user_id = $1 AND last_seen >= $2 AND room_id = ANY($3::text[])`,
    [userId, activeSince(), roomIds]
  );
  rows.forEach((row) => set.add(row.room_id));
  return set;
}

async function isMember(queryable, roomId, userId) {
  const { rows } = await queryable.query(
    "SELECT 1 AS yes FROM room_members WHERE room_id = $1 AND user_id = $2 AND last_seen >= $3",
    [roomId, userId, activeSince()]
  );
  return rows.length > 0;
}

function presentRoom(room, user, realCount, extra = {}) {
  const mine = room.created_by === user.id;
  return {
    id: room.id,
    name: room.name,
    subject: room.subject,
    type: room.type,
    host: room.host_name,
    hostEmoji: room.host_emoji,
    capacity: room.capacity,
    joined: room.base_joined + realCount,
    topic: room.topic,
    live: Boolean(room.is_live),
    mine,
    createdByMe: mine,
    inRoom: extra.inRoom === undefined ? false : Boolean(extra.inRoom),
    createdAt: room.created_at,
  };
}

async function roomView(queryable, room, user) {
  const [count, member] = await Promise.all([
    realMemberCount(queryable, room.id),
    roomMemberRow(queryable, room.id, user.id),
  ]);
  return presentRoom(room, user, count, { inRoom: Boolean(member) });
}

function visibleRooms(queryable, user) {
  // Lobby công khai:
  // - Phòng cộng đồng hiển thị cho mọi người, kể cả khi chưa tham gia.
  // - Phòng nhóm chỉ hiển thị cho chủ phòng/thành viên hoặc nếu là link.
  // - Phòng cá nhân chỉ hiển thị cho chủ sở hữu.
  // "Phòng của tôi" được tính riêng trong myRoomsFor().
  return queryable
    .query(
      `SELECT * FROM rooms r
       WHERE (
          r.type = 'community'
          OR (r.type = 'group' AND (
            r.created_by IS NULL OR r.created_by = $1 OR
            EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = $1)
          ))
          OR (r.type = 'solo' AND r.created_by = $1)
       )
       ORDER BY (r.created_by = $1) DESC, r.sort_order DESC, r.created_at DESC`,
      [user.id]
    )
    .then((result) => result.rows);
}

async function roomList(ctx, user) {
  const rooms = await visibleRooms(ctx.pool, user);
  const ids = rooms.map((room) => room.id);
  const [counts, joined] = await Promise.all([
    memberCounts(ctx.pool, ids),
    joinedRoomIds(ctx.pool, user.id, ids),
  ]);
  return rooms.map((room) =>
    presentRoom(room, user, counts.get(room.id) || 0, { inRoom: joined.has(room.id) })
  );
}

/* "Phòng của tôi": phòng mình tạo + phòng mình đã tham gia. Rời phòng xoá
   dòng room_members nên phòng đã rời tự động biến mất khỏi danh sách này. */
async function myRoomsFor(ctx, user) {
  const { rows } = await ctx.pool.query(
    `SELECT r.*, m.joined_at, m.last_seen AS member_seen
     FROM rooms r
     LEFT JOIN room_members m ON m.room_id = r.id AND m.user_id = $1
     WHERE r.created_by = $1 OR m.user_id = $1
     ORDER BY (r.created_by = $1) DESC, (m.last_seen >= $2) DESC, r.created_at DESC`,
    [user.id, activeSince()]
  );
  const counts = await memberCounts(
    ctx.pool,
    rows.map((room) => room.id)
  );
  return rows.map((room) => ({
    ...presentRoom(room, user, counts.get(room.id) || 0, { inRoom: room.member_seen !== null }),
    role: room.created_by === user.id ? "host" : "member",
    joinedAt: room.joined_at === null || room.joined_at === undefined ? null : Number(room.joined_at),
    active: room.member_seen !== null && Number(room.member_seen) >= activeSince(),
  }));
}

async function getRoom(ctx, user, roomId) {
  const { rows } = await ctx.pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
  const room = rows[0];
  if (!room) return null;
  if (room.type === "solo" && room.created_by !== user.id) return null;
  return room;
}

async function roomMemberRow(queryable, roomId, userId) {
  const { rows } = await queryable.query(
    "SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2",
    [roomId, userId]
  );
  return rows[0] || null;
}

function hashString(value) {
  return [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function syntheticMembers(room) {
  const offset = hashString(room.id) % U.MEMBER_POOL.length;
  const list = [];
  for (let i = 0; i < room.base_joined; i++) {
    const [name, emoji] = U.MEMBER_POOL[(offset + i) % U.MEMBER_POOL.length];
    list.push({
      id: `seed-${room.id}-${i + 1}`,
      name,
      emoji,
      seat: i + 1,
      status: i === 0 ? "study" : i % 6 === 0 ? "rest" : i % 9 === 0 ? "idle" : "study",
      minutes: 15 + ((i * 17) % 85),
      host: i === 0 && !room.created_by,
      me: false,
      seeded: true,
    });
  }
  return list;
}

async function membersFor(queryable, room, viewerId) {
  const list = syntheticMembers(room);
  const today = U.todayISO();
  const { rows } = await queryable.query(
    `SELECT m.*, u.name, u.avatar, u.is_guest,
      COALESCE((SELECT seconds FROM focus_daily f WHERE f.user_id = u.id AND f.day = $1), 0) AS today_seconds
     FROM room_members m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $2 AND m.last_seen >= $3
     ORDER BY m.seat`,
    [today, room.id, activeSince()]
  );

  rows.forEach((row) => {
    const online = row.user_id === viewerId || Date.now() - Number(row.last_seen) < PRESENCE_WINDOW;
    list.push({
      id: row.user_id,
      name: row.name,
      emoji: row.avatar,
      seat: row.seat,
      status: online ? "study" : "rest",
      minutes: Math.round(Number(row.today_seconds) / 60),
      host: room.created_by === row.user_id,
      me: row.user_id === viewerId,
      seeded: false,
    });
  });

  return list.sort((a, b) => a.seat - b.seat);
}

async function nextSeat(queryable, room) {
  const taken = new Set();
  for (let seat = 1; seat <= room.base_joined; seat++) taken.add(seat);
  const { rows } = await queryable.query(
    "SELECT seat FROM room_members WHERE room_id = $1 AND last_seen >= $2",
    [room.id, activeSince()]
  );
  rows.forEach((row) => taken.add(row.seat));
  for (let seat = 1; seat <= room.capacity; seat++) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}

async function joinRoom(ctx, room, user, { force = false } = {}) {
  const client = await ctx.pool.connect();
  try {
    await client.query("BEGIN");
    const locked = (await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [room.id])).rows[0];
    if (!locked) throw Object.assign(new Error("Không tìm thấy phòng học."), { status: 404, code: "ROOM_NOT_FOUND" });
    if (!locked.is_live && locked.created_by !== user.id) {
      throw Object.assign(new Error("Phòng chưa mở."), { status: 409, code: "ROOM_NOT_OPEN" });
    }
    if (locked.type === "solo" && locked.created_by !== user.id) {
      throw Object.assign(new Error("Bạn không có quyền vào phòng cá nhân này."), { status: 403, code: "SOLO_ROOM_DENIED" });
    }

    const existing = (await client.query(
      "SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2",
      [locked.id, user.id]
    )).rows[0];
    const now = Date.now();
    if (existing) {
      let seat = existing.seat;
      if (Number(existing.last_seen) < activeSince()) {
        const clash = (await client.query(
          `SELECT 1 AS yes FROM room_members
           WHERE room_id = $1 AND seat = $2 AND user_id <> $3 AND last_seen >= $4`,
          [locked.id, seat, user.id, activeSince()]
        )).rows.length;
        if (clash) seat = (await nextSeat(client, locked)) || seat;
      }
      await client.query(
        "UPDATE room_members SET last_seen = $1, seat = $4 WHERE room_id = $2 AND user_id = $3",
        [now, locked.id, user.id, seat]
      );
      await client.query("COMMIT");
      return roomView(ctx.pool, locked, user);
    }

    const joined = locked.base_joined + (await realMemberCount(client, locked.id));
    if (!force && joined >= locked.capacity) {
      throw Object.assign(new Error("Phòng đã đủ chỗ. Hãy chọn phòng khác hoặc tạo phòng mới."), { status: 409, code: "ROOM_FULL" });
    }
    const seat = await nextSeat(client, locked);
    if (!seat) {
      throw Object.assign(new Error("Phòng đã đủ chỗ. Hãy chọn phòng khác hoặc tạo phòng mới."), { status: 409, code: "ROOM_FULL" });
    }
    await client.query(
      `INSERT INTO room_members (room_id, user_id, seat, role, joined_at, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [locked.id, user.id, seat, locked.created_by === user.id ? "host" : "member", now, now]
    );
    await client.query("COMMIT");
    return roomView(ctx.pool, locked, user);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updatePresence(queryable, roomId, userId) {
  await queryable.query("UPDATE room_members SET last_seen = $1 WHERE room_id = $2 AND user_id = $3", [
    Date.now(),
    roomId,
    userId,
  ]);
}

async function roomMessages(queryable, roomId, user, limit = 80) {
  const { rows } = await queryable.query(
    `SELECT * FROM (
       SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2
     ) recent ORDER BY created_at ASC`,
    [roomId, limit]
  );
  return rows.map((row) => serializeMessage(row, user));
}

function serializeMessage(row, user) {
  const date = new Date(Number(row.created_at));
  return {
    id: row.id,
    author: row.author,
    emoji: row.emoji,
    time: `${U.pad(date.getHours())}:${U.pad(date.getMinutes())}`,
    text: row.text,
    me: row.user_id === user.id,
    userId: row.user_id,
    createdAt: Number(row.created_at),
  };
}

async function addMessage(ctx, room, user, text) {
  const now = Date.now();
  const client = await ctx.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
    const last = await client.query(
      "SELECT created_at FROM messages WHERE room_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1",
      [room.id, user.id]
    );
    if (last.rows[0] && now - Number(last.rows[0].created_at) < 800) {
      throw Object.assign(new Error("Chậm một chút — giới hạn 1 tin nhắn mỗi giây."), { status: 429, code: "RATE_LIMITED" });
    }
    const id = U.newId("msg");
    const { rows } = await client.query(
      `INSERT INTO messages (id, room_id, user_id, author, emoji, text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, room.id, user.id, user.name, user.avatar, text, now]
    );
    await client.query("COMMIT");
    return serializeMessage(rows[0], user);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function roomDocs(queryable, roomId) {
  const { rows } = await queryable.query("SELECT * FROM docs WHERE room_id = $1 ORDER BY created_at DESC", [roomId]);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    meta: row.meta,
    url: row.url,
    icon: row.icon,
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
  }));
}

async function getDoc(queryable, docId) {
  const { rows } = await queryable.query(
    "SELECT * FROM docs WHERE id = $1",
    [docId]
  );
  return rows[0] || null;
}

async function addDoc(ctx, room, user, { title, meta, url, file }) {
  const id = U.newId("doc");
  const safeUrl = /^https?:\/\//i.test(String(url || "")) ? String(url).slice(0, 400) : "";
  let finalUrl = safeUrl;
  if (file) {
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const extension = path.extname(file.name || "").toLowerCase().slice(0, 10);
    await fsp.writeFile(path.join(UPLOAD_DIR, `${id}${extension}`), file.buffer, { flag: "wx" });
    finalUrl = `/api/uploads/${encodeURIComponent(id)}`;
  }
  await ctx.pool.query(
    `INSERT INTO docs (id, room_id, title, meta, url, icon, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, 'file', $6, $7)`,
    [id, room.id, title, meta, finalUrl, user.id, Date.now()]
  );
  return { id, title, meta, url: finalUrl, icon: "file", createdBy: user.id, createdAt: Date.now() };
}

async function deleteDoc(ctx, room, user, docId) {
  const doc = await getDoc(ctx.pool, docId);
  if (!doc) {
    throw Object.assign(new Error("Không tìm thấy tài liệu."), { status: 404, code: "DOC_NOT_FOUND" });
  }
  if (doc.room_id !== room.id) {
    throw Object.assign(new Error("Tài liệu không thuộc phòng này."), { status: 400, code: "DOC_WRONG_ROOM" });
  }
  if (doc.created_by !== user.id) {
    throw Object.assign(new Error("Chỉ người đính kèm mới được xóa tài liệu."), { status: 403, code: "NOT_DOC_OWNER" });
  }

  if (typeof doc.url === "string" && doc.url.startsWith("/api/uploads/")) {
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const entries = await fsp.readdir(UPLOAD_DIR);
    const fileName = entries.find((name) => name.startsWith(`${doc.id}.`));
    if (fileName) await fsp.unlink(path.join(UPLOAD_DIR, fileName)).catch(() => {});
  }
  await ctx.pool.query("DELETE FROM docs WHERE id = $1", [doc.id]);
  return { id: doc.id };
}

async function roomNotebook(queryable, roomId, userId) {
  const { rows } = await queryable.query("SELECT content FROM notebooks WHERE room_id = $1 AND user_id = $2", [
    roomId,
    userId,
  ]);
  return rows[0] ? rows[0].content : "";
}

async function createRoom(ctx, user, { name, subject, type, topic }) {
  if (type === "solo") {
    const existing = await ctx.pool.query(
      "SELECT * FROM rooms WHERE created_by = $1 AND type = 'solo' ORDER BY created_at DESC LIMIT 1",
      [user.id]
    );
    if (existing.rows[0]) {
      await joinRoom(ctx, existing.rows[0], user, { force: true });
      return roomView(ctx.pool, existing.rows[0], user);
    }
  }

  const id = `room_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  const capacity = U.ROOM_TYPES[type] || 20;
  const finalName =
    type === "solo" ? name || `Phòng của ${String(user.name).split(" ").slice(-1)[0]}` : name;
  const now = Date.now();

  const { rows } = await ctx.pool.query(
    `INSERT INTO rooms
      (id, name, subject, type, topic, host_name, host_emoji, capacity, base_joined, is_live, created_by, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, TRUE, $9, 1000, $10)
     RETURNING *`,
    [id, finalName, subject, type, topic || "Buổi học tập trung cùng nhau", user.name, user.avatar, capacity, user.id, now]
  );

  await joinRoom(ctx, rows[0], user, { force: true });
  return roomView(ctx.pool, rows[0], user);
}

/* Rời phòng = xoá tư cách thành viên. Chủ phòng phải dùng "Giải tán nhóm"
   để tránh phòng mồ côi không ai quản lý. */
async function leaveRoom(ctx, room, user) {
  if (room.created_by === user.id) {
    const err = new Error("Bạn là chủ phòng. Hãy dùng “Giải tán nhóm” nếu muốn đóng phòng.");
    err.status = 409;
    err.code = "OWNER_CANNOT_LEAVE";
    throw err;
  }
  await ctx.pool.query("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [room.id, user.id]);
}

/* Giải tán nhóm: chỉ chủ phòng. Tin nhắn, tài liệu, thành viên và sổ nháp xoá
   theo ràng buộc ON DELETE CASCADE. */
async function deleteRoom(ctx, room, user) {
  if (room.created_by !== user.id) {
    const err = new Error("Chỉ chủ phòng mới có thể giải tán nhóm.");
    err.status = 403;
    err.code = "NOT_ROOM_OWNER";
    throw err;
  }
  const docs = await ctx.pool.query(
    "SELECT id, url FROM docs WHERE room_id = $1",
    [room.id]
  );
  for (const doc of docs.rows) {
    if (typeof doc.url === "string" && doc.url.startsWith("/api/uploads/")) {
      try {
        await fsp.mkdir(UPLOAD_DIR, { recursive: true });
        const entries = await fsp.readdir(UPLOAD_DIR);
        const fileName = entries.find((name) => name.startsWith(`${doc.id}.`));
        if (fileName) await fsp.unlink(path.join(UPLOAD_DIR, fileName));
      } catch {
        /* File upload có thể đã không tồn tại; vẫn xoá dữ liệu phòng. */
      }
    }
  }
  await ctx.pool.query("DELETE FROM rooms WHERE id = $1", [room.id]);
}

async function updateRoomHost(queryable, user) {
  await queryable.query("UPDATE rooms SET host_name = $1, host_emoji = $2 WHERE created_by = $3", [
    user.name,
    user.avatar,
    user.id,
  ]);
}

/* -------------------------------------------------------------------------- */
/* Toàn bộ trạng thái cho bootstrap                                            */
/* -------------------------------------------------------------------------- */

async function totalsFor(queryable, userId, days) {
  const from = U.iso(U.addDays(new Date(), -(days - 1)));
  const { rows } = await queryable.query(
    "SELECT COALESCE(SUM(seconds), 0)::int AS seconds FROM focus_daily WHERE user_id = $1 AND day >= $2",
    [userId, from]
  );
  return Math.round(Number(rows[0].seconds || 0) / 60);
}

async function notebooksFor(queryable, userId, rooms) {
  const map = {};
  const allowed = rooms.map((room) => room.id);
  if (!allowed.length) return map;
  const { rows } = await queryable.query(
    "SELECT room_id, content FROM notebooks WHERE user_id = $1 AND room_id = ANY($2::text[])",
    [userId, allowed]
  );
  rows.forEach((row) => {
    map[row.room_id] = row.content;
  });
  return map;
}

async function docsByRoom(queryable, rooms) {
  const map = {};
  const allowed = rooms.map((room) => room.id);
  if (!allowed.length) return map;
  const { rows } = await queryable.query(
    "SELECT * FROM docs WHERE room_id = ANY($1::text[]) ORDER BY created_at DESC",
    [allowed]
  );
  allowed.forEach((id) => {
    map[id] = [];
  });
  rows.forEach((row) => {
    map[row.room_id].push({
      id: row.id,
      title: row.title,
      meta: row.meta,
      url: row.url,
      icon: row.icon,
      createdAt: Number(row.created_at),
    });
  });
  return map;
}

async function stateForUser(ctx, user) {
  const rooms = await visibleRooms(ctx.pool, user);
  const counts = await memberCounts(ctx.pool, rooms.map((room) => room.id));
  const roomViews = rooms.map((room) => presentRoom(room, user, counts.get(room.id) || 0));

  const [focus, todoRows, scheduleRows, ownedRows, notebooks, docs, todayRow, myRooms] = await Promise.all([
    DB.focusSummary(ctx.pool, user.id, 400),
    ctx.pool.query("SELECT * FROM todos WHERE user_id = $1 ORDER BY position, created_at", [user.id]),
    ctx.pool.query("SELECT * FROM schedule WHERE user_id = $1 ORDER BY day, start", [user.id]),
    ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]),
    notebooksFor(ctx.pool, user.id, rooms),
    docsByRoom(ctx.pool, rooms),
    ctx.pool.query("SELECT seconds FROM focus_daily WHERE user_id = $1 AND day = $2", [user.id, U.todayISO()]),
    myRoomsFor(ctx, user),
  ]);

  return {
    account: serializeAccount(user),
    profile: serializeProfile(user),
    rooms: roomViews,
    myRooms,
    todos: todoRows.rows.map((row) => ({
      id: row.id,
      text: row.text,
      subject: row.subject,
      done: Boolean(row.done),
    })),
    schedule: scheduleRows.rows.map((row) => ({
      id: row.id,
      day: row.day,
      start: row.start,
      duration: row.duration,
      subject: row.subject,
      note: row.note,
    })),
    notebooks,
    docsByRoom: docs,
    owned: ownedRows.rows.map((row) => row.item_id),
    shop: U.SHOP_ITEMS,
    totalFocus: await totalsFor(ctx.pool, user.id, 90),
    daily: focus.daily,
    bySubject: focus.bySubject,
    hours: focus.hours,
    todayMinutes: Math.round(Number(todayRow.rows[0] ? todayRow.rows[0].seconds : 0) / 60),
    serverNow: Date.now(),
  };
}

async function bootstrapPayload(ctx, user) {
  return {
    version: 2,
    account: serializeAccount(user),
    state: await stateForUser(ctx, user),
  };
}

/* -------------------------------------------------------------------------- */
/* Cập nhật hồ sơ, lịch, to-do, sổ tay                                        */
/* -------------------------------------------------------------------------- */

async function saveState(ctx, user, body) {
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const updates = {};
  const allowedAccent = new Set(["green", "blue", "violet", "amber"]);

  if (typeof profile.name === "string") {
    const name = U.cleanText(profile.name, 60);
    if (name) updates.name = name;
  }
  if (typeof profile.grade === "string") updates.grade = U.cleanText(profile.grade, 20);
  if (typeof profile.exam === "string") updates.exam = U.cleanText(profile.exam, 60);
  if (typeof profile.examDate === "string") {
    updates.exam_date = U.validDate(profile.examDate) || "";
  }
  if (typeof profile.targetSchool === "string") updates.target_school = U.cleanText(profile.targetSchool, 120);
  if (profile.goalHours !== undefined) updates.goal_hours = U.clampInt(profile.goalHours, 1, 16, 4);
  if (typeof profile.avatar === "string") updates.avatar = U.cleanText(profile.avatar, 8) || "🦊";
  if (typeof profile.accent === "string" && allowedAccent.has(profile.accent)) updates.accent = profile.accent;
  if (profile.theme === "dark" || profile.theme === "light") updates.theme = profile.theme;
  if (typeof profile.bio === "string") updates.bio = U.cleanText(profile.bio, 280);
  ["reminders", "sounds", "heartbeat"].forEach((key) => {
    if (profile[key] !== undefined) updates[key] = Boolean(profile[key]);
  });

  const client = await ctx.pool.connect();
  try {
    await client.query("BEGIN");

    if (Object.keys(updates).length) {
      const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
      const values = Object.values(updates);
      values.push(user.id);
      await client.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
    }

    if (Array.isArray(body.todos)) {
      await client.query("DELETE FROM todos WHERE user_id = $1", [user.id]);
      const rows = [];
      const seen = new Set();
      body.todos.slice(0, 300).forEach((todo, index) => {
        const text = U.cleanText(todo && todo.text, 240);
        if (!text) return;
        let id = U.cleanText(todo.id, 64) || U.newId("todo");
        if (seen.has(id)) id = U.newId("todo");
        seen.add(id);
        const subject = U.cleanText(todo.subject, 40) || "toan";
        rows.push([user.id, id, text, subject, Boolean(todo.done), index, Date.now() + index]);
      });
      if (rows.length) {
        const params = [];
        const tuples = rows.map((row) => {
          const placeholders = row.map((value) => {
            params.push(value);
            return `$${params.length}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        await client.query(
          `INSERT INTO todos (user_id, id, text, subject, done, position, created_at)
           VALUES ${tuples.join(", ")}`,
          params
        );
      }
    }

    if (Array.isArray(body.schedule)) {
      await client.query("DELETE FROM schedule WHERE user_id = $1", [user.id]);
      const rows = [];
      const seen = new Set();
      body.schedule.slice(0, 300).forEach((item, index) => {
        if (!item) return;
        let id = U.cleanText(item.id, 64) || U.newId("sch");
        if (seen.has(id)) id = U.newId("sch");
        seen.add(id);
        const subject = U.cleanText(item.subject, 40) || "toan";
        const start = U.validClock(item.start) || "19:00";
        const duration = U.clampInt(item.duration, 5, 480, 60);
        const day = U.clampInt(item.day, 0, 6, 0);
        const note = U.cleanText(item.note, 140) || "Ca học";
        rows.push([user.id, id, day, start, duration, subject, note, Date.now() + index]);
      });
      if (rows.length) {
        const params = [];
        const tuples = rows.map((row) => {
          const placeholders = row.map((value) => {
            params.push(value);
            return `$${params.length}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        await client.query(
          `INSERT INTO schedule (user_id, id, day, start, duration, subject, note, created_at)
           VALUES ${tuples.join(", ")}`,
          params
        );
      }
    }

    if (body.notebooks && typeof body.notebooks === "object" && !Array.isArray(body.notebooks)) {
      const allowedRows = await client.query(
        `SELECT id FROM rooms r
         WHERE r.type = 'community'
            OR (r.type = 'group' AND (r.created_by IS NULL OR r.created_by = $1 OR
                 EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = $1)))
            OR (r.type = 'solo' AND r.created_by = $1)`,
        [user.id]
      );
      const allowed = new Set(allowedRows.rows.map((row) => row.id));
      for (const [roomId, content] of Object.entries(body.notebooks).slice(0, 100)) {
        if (!allowed.has(roomId)) continue;
        await client.query(
          `INSERT INTO notebooks (room_id, user_id, content, updated_at) VALUES ($1, $2, $3, $4)
           ON CONFLICT (room_id, user_id)
           DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
          [roomId, user.id, U.cleanMultiline(content, 20000), Date.now()]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const fresh = (await ctx.pool.query("SELECT * FROM users WHERE id = $1", [user.id])).rows[0];
  await updateRoomHost(ctx.pool, fresh);
  const [todos, schedule] = await Promise.all([
    ctx.pool.query("SELECT * FROM todos WHERE user_id = $1 ORDER BY position, created_at", [user.id]),
    ctx.pool.query("SELECT * FROM schedule WHERE user_id = $1 ORDER BY day, start", [user.id]),
  ]);

  return {
    ok: true,
    profile: serializeProfile(fresh),
    todos: todos.rows.map((row) => ({
      id: row.id,
      text: row.text,
      subject: row.subject,
      done: Boolean(row.done),
    })),
    schedule: schedule.rows.map((row) => ({
      id: row.id,
      day: row.day,
      start: row.start,
      duration: row.duration,
      subject: row.subject,
      note: row.note,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Focus + Study Stars                                                         */
/* -------------------------------------------------------------------------- */

/* Credit nằm trong Redis: sống sót khi restart app và dùng chung giữa các
   instance. Mỗi giây trôi qua sinh ~1,25 giây công, tối đa 300 giây mỗi lần. */
async function consumeFocusCredit(kv, userId, seconds) {
  const key = `swm:focus:${userId}`;
  const now = Date.now();
  const raw = await kv.get(key);

  let bucket = null;
  if (raw) {
    try {
      bucket = JSON.parse(raw);
    } catch {
      bucket = null;
    }
  }
  if (!bucket || !Number.isFinite(Number(bucket.at)) || !Number.isFinite(Number(bucket.credit))) {
    bucket = { at: now - 60000, credit: 60 };
  }

  const elapsed = Math.max(0, (now - Number(bucket.at)) / 1000);
  bucket.credit = Math.min(300, Number(bucket.credit) + elapsed * 1.25 + 1);
  const used = Math.max(0, Math.min(seconds, bucket.credit, 300));
  bucket.credit = Number(bucket.credit) - used;
  bucket.at = now;

  await kv.set(key, JSON.stringify({ at: bucket.at, credit: bucket.credit }), { EX: FOCUS_KEY_TTL });
  return Math.floor(used);
}

async function todayMinutes(queryable, userId) {
  const { rows } = await queryable.query("SELECT seconds FROM focus_daily WHERE user_id = $1 AND day = $2", [
    userId,
    U.todayISO(),
  ]);
  return Math.round(Number(rows[0] ? rows[0].seconds : 0) / 60);
}

async function focusSnapshot(queryable, userId) {
  const fresh = (await queryable.query("SELECT * FROM users WHERE id = $1", [userId])).rows[0];
  return {
    awardedSeconds: 0,
    awardedStars: 0,
    stars: fresh.stars,
    streak: fresh.streak,
    todayMinutes: await todayMinutes(queryable, userId),
    totalMinutes: await totalsFor(queryable, userId, 90),
  };
}

async function awardFocus(ctx, user, { seconds, roomId }) {
  const requested = U.clampInt(seconds, 0, 300, 0);
  if (!requested) return focusSnapshot(ctx.pool, user.id);

  const used = await consumeFocusCredit(ctx.kv, user.id, requested);
  if (!used) return focusSnapshot(ctx.pool, user.id);

  const room = roomId ? await getRoom(ctx, user, roomId) : null;
  const subject = room ? room.subject : "toan";
  const now = new Date();
  const day = U.iso(now);
  const hour = String(now.getHours());

  const client = await ctx.pool.connect();
  let afterSeconds = 0;
  let awardedStars = 0;
  let streak = 0;
  let todayValue = 0;
  let totalMinutes = 0;

  try {
    await client.query("BEGIN");

    const row = (
      await client.query("SELECT * FROM focus_daily WHERE user_id = $1 AND day = $2 FOR UPDATE", [user.id, day])
    ).rows[0];

    const readJson = (value) => {
      if (!value) return {};
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return value;
    };

    const bySubject = readJson(row && row.by_subject);
    const byHour = readJson(row && row.by_hour);
    const beforeSeconds = row ? Number(row.seconds) : 0;
    afterSeconds = beforeSeconds + used;
    bySubject[subject] = (bySubject[subject] || 0) + used;
    byHour[hour] = (byHour[hour] || 0) + used;

    await client.query(
      `INSERT INTO focus_daily (user_id, day, seconds, by_subject, by_hour) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, day) DO UPDATE SET seconds = excluded.seconds,
         by_subject = excluded.by_subject, by_hour = excluded.by_hour`,
      [user.id, day, afterSeconds, JSON.stringify(bySubject), JSON.stringify(byHour)]
    );

    const beforeMinutes = Math.floor(beforeSeconds / 60);
    const afterMinutes = Math.floor(afterSeconds / 60);
    awardedStars = Math.max(0, afterMinutes - beforeMinutes);

    if (awardedStars) {
      await client.query("UPDATE users SET stars = stars + $1 WHERE id = $2", [awardedStars, user.id]);
    }

    streak = await DB.computeStreak(client, user.id);
    await client.query("UPDATE users SET streak = $1 WHERE id = $2", [streak, user.id]);

    await client.query("COMMIT");
    todayValue = Math.round(afterSeconds / 60);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  totalMinutes = await totalsFor(ctx.pool, user.id, 90);
  const fresh = (await ctx.pool.query("SELECT * FROM users WHERE id = $1", [user.id])).rows[0];

  return {
    awardedSeconds: used,
    awardedStars,
    stars: fresh.stars,
    streak,
    todayMinutes: todayValue,
    totalMinutes,
    day,
    subject,
  };
}

/* -------------------------------------------------------------------------- */
/* Cửa hàng                                                                    */
/* -------------------------------------------------------------------------- */

async function shopState(ctx, user) {
  const { rows } = await ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]);
  return { items: U.SHOP_ITEMS, owned: rows.map((row) => row.item_id), stars: user.stars };
}

async function buyItem(ctx, user, itemId) {
  const item = U.SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) {
    const err = new Error("Vật phẩm không tồn tại.");
    err.status = 404;
    err.code = "ITEM_NOT_FOUND";
    throw err;
  }

  const client = await ctx.pool.connect();
  let stars = 0;
  try {
    await client.query("BEGIN");

    const owned = await client.query("SELECT 1 AS yes FROM owned WHERE user_id = $1 AND item_id = $2", [
      user.id,
      itemId,
    ]);
    if (owned.rows.length) {
      const err = new Error("Bạn đã sở hữu vật phẩm này.");
      err.status = 409;
      err.code = "ALREADY_OWNED";
      throw err;
    }

    const paid = await client.query(
      "UPDATE users SET stars = stars - $1 WHERE id = $2 AND stars >= $1 RETURNING stars",
      [item.price, user.id]
    );
    if (!paid.rows.length) {
      const err = new Error(`Cần thêm ${(item.price - user.stars).toLocaleString("vi-VN")} ★ để mở khoá.`);
      err.status = 402;
      err.code = "NOT_ENOUGH_STARS";
      throw err;
    }

    await client.query("INSERT INTO owned (user_id, item_id, acquired_at) VALUES ($1, $2, $3)", [
      user.id,
      item.id,
      Date.now(),
    ]);

    await client.query("COMMIT");
    stars = Number(paid.rows[0].stars);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]);
  return { stars, owned: rows.map((row) => row.item_id), item };
}

/* -------------------------------------------------------------------------- */
/* Thống kê                                                                    */
/* -------------------------------------------------------------------------- */

async function statsFor(ctx, user, days) {
  const safeDays = U.clampInt(days, 7, 400, 90);
  const summary = await DB.focusSummary(ctx.pool, user.id, safeDays);
  const streak = await DB.computeStreak(ctx.pool, user.id);
  return {
    days: safeDays,
    daily: summary.daily,
    bySubject: summary.bySubject,
    hours: summary.hours,
    totalMinutes: summary.totalMinutes,
    totalSeconds: summary.totalSeconds,
    streak,
  };
}

module.exports = {
  SESSION_TTL,
  createSession,
  destroySession,
  userByToken,
  ensureGuest,
  upgradeGuest,
  createAccount,
  serializeProfile,
  serializeAccount,
  roomList,
  roomView,
  myRoomsFor,
  isMember,
  getRoom,
  joinRoom,
  leaveRoom,
  deleteRoom,
  updatePresence,
  membersFor,
  roomMessages,
  addMessage,
  roomDocs,
  getDoc,
  addDoc,
  deleteDoc,
  roomNotebook,
  createRoom,
  stateForUser,
  bootstrapPayload,
  saveState,
  awardFocus,
  shopState,
  buyItem,
  statsFor,
  presentRoom,
};
