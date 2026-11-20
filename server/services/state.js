/* Trạng thái tổng hợp cho client: bootstrap, lưu profile/todos/schedule. */
const U = require("../util");
const { serializeProfile, serializeAccount, totalsFor } = require("./shared");
const { visibleRooms, memberCounts, presentRoom, myRoomsFor, updateRoomHost } = require("./rooms");
const { gardenFor } = require("./garden");
const DB = require("../db");
const { todayMinutes } = require("./focus");


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

  const [focus, todoRows, scheduleRows, ownedRows, garden, notebooks, docs, todayRow, myRooms] = await Promise.all([
    DB.focusSummary(ctx.pool, user.id, 400),
    ctx.pool.query("SELECT * FROM todos WHERE user_id = $1 ORDER BY position, created_at", [user.id]),
    ctx.pool.query("SELECT * FROM schedule WHERE user_id = $1 ORDER BY day, start", [user.id]),
    ctx.pool.query("SELECT item_id FROM owned WHERE user_id = $1", [user.id]),
    gardenFor(ctx.pool, user.id),
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
    garden,
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
  if (typeof profile.currentSchool === "string") updates.current_school = U.cleanText(profile.currentSchool, 120);
  if (typeof profile.gender === "string") updates.gender = profile.gender === "nam" || profile.gender === "nu" ? profile.gender : "";
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

module.exports = { notebooksFor, docsByRoom, stateForUser, bootstrapPayload, saveState };
