/* Phòng học: vòng đời, thành viên & ghế, presence, chat, tài liệu, sổ nháp. */
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");

const U = require("../util");
const { PRESENCE_WINDOW, MEMBER_TTL, UPLOAD_DIR } = require("./shared");

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

  /* Chủ phòng luôn đứng đầu danh sách, sau đó tới thành viên theo số ghế. */
  return list.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.seat - b.seat);
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

/* Rời trang phòng: xoá hiện diện ngay lập tức. Thành viên thường mất cả tư cách
   (như "Rời phòng"); chủ phòng chỉ bị "ngủ" — phòng vẫn nằm trong Phòng của tôi. */
async function exitPresence(ctx, room, user) {
  if (room.created_by === user.id) {
    await ctx.pool.query(
      "UPDATE room_members SET last_seen = 0 WHERE room_id = $1 AND user_id = $2",
      [room.id, user.id]
    );
  } else {
    await ctx.pool.query("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [room.id, user.id]);
  }
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
module.exports = {
  activeSince,
  realMemberCount,
  memberCounts,
  joinedRoomIds,
  isMember,
  presentRoom,
  roomView,
  visibleRooms,
  roomList,
  myRoomsFor,
  getRoom,
  roomMemberRow,
  membersFor,
  nextSeat,
  joinRoom,
  updatePresence,
  roomMessages,
  serializeMessage,
  addMessage,
  roomDocs,
  getDoc,
  addDoc,
  deleteDoc,
  roomNotebook,
  createRoom,
  leaveRoom,
  exitPresence,
  deleteRoom,
  updateRoomHost,
};
