"use strict";

/* ==========================================================================
   Chuyển toàn bộ dữ liệu từ SQLite (bản v2) sang Postgres (bản v3).

   Cách dùng:
     DATABASE_URL=postgres://swm:swm@localhost:5433/swm npm run migrate:sqlite
     npm run migrate:sqlite -- --dry-run        # chỉ xem số dòng, không ghi
     npm run migrate:sqlite -- --no-fresh       # thêm vào DB hiện có
     npm run migrate:sqlite -- data/khac.db     # đổi file nguồn

   Mặc định `--fresh`: xoá schema Postgres rồi nạp lại từ đầu, giữ nguyên
   id/token/thời gian nên dữ liệu khớp 1-1 với bản SQLite.
   ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DB = require("./db");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fresh = !args.includes("--no-fresh");
const sourceArg = args.find((arg) => !arg.startsWith("--"));
const source = path.resolve(sourceArg || path.join(__dirname, "..", "data", "studywithme.db"));
const databaseUrl = process.env.DATABASE_URL || "postgres://swm:swm@localhost:5433/swm";

async function insertRows(client, table, columns, rows) {
  if (!rows.length) return 0;
  const chunkSize = Math.max(1, Math.floor(60000 / columns.length));
  let inserted = 0;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const slice = rows.slice(start, start + chunkSize);
    const params = [];
    const tuples = slice.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value === undefined ? null : value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const result = await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")} ON CONFLICT DO NOTHING`,
      params
    );
    inserted += result.rowCount;
  }
  return inserted;
}

const bool = (value) => Boolean(Number(value || 0));
const num = (value) => (value === null || value === undefined ? 0 : Number(value));
const text = (value) => (value === null || value === undefined ? null : String(value));

(async () => {
  if (!fs.existsSync(source)) {
    throw new Error(`Không tìm thấy file SQLite: ${source}`);
  }

  const sqlite = new DatabaseSync(source, { readOnly: true });
  const read = (sql) => {
    try {
      return sqlite.prepare(sql).all();
    } catch {
      return [];
    }
  };

  const users = read("SELECT * FROM users");
  const rooms = read("SELECT * FROM rooms");
  const members = read("SELECT * FROM room_members");
  const messages = read("SELECT * FROM messages");
  const docs = read("SELECT * FROM docs");
  const notebooks = read("SELECT * FROM notebooks");
  const todos = read("SELECT * FROM todos");
  const schedule = read("SELECT * FROM schedule");
  const focus = read("SELECT * FROM focus_daily");
  const owned = read("SELECT * FROM owned");
  sqlite.close();

  console.log(`Nguồn: ${source}`);
  console.log(
    `  users=${users.length} rooms=${rooms.length} members=${members.length} messages=${messages.length} ` +
      `docs=${docs.length} notebooks=${notebooks.length} todos=${todos.length} schedule=${schedule.length} ` +
      `focus_daily=${focus.length} owned=${owned.length}`
  );

  if (dryRun) {
    console.log("--dry-run: không ghi gì vào Postgres.");
    return;
  }

  const pool = DB.createPool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    if (fresh) {
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    }
    /* Tạo bảng nhưng KHÔNG gieo dữ liệu mẫu: bản SQLite đã có sẵn 6 phòng mẫu,
       gieo thêm sẽ tạo bản trùng. */
    await DB.initDatabase(pool, { seed: false });

    await client.query("BEGIN");

    const report = {};
    report.users = await insertRows(
      client,
      "users",
      [
        "id", "email", "pass_hash", "pass_salt", "name", "avatar", "bio", "grade", "exam", "exam_date",
        "target_school", "goal_hours", "accent", "theme", "stars", "streak", "reminders", "sounds",
        "heartbeat", "is_guest", "last_seen", "created_at",
      ],
      users.map((user) => [
        user.id,
        text(user.email),
        text(user.pass_hash),
        text(user.pass_salt),
        user.name || "Học sinh",
        user.avatar || "🦊",
        user.bio || "",
        user.grade || "12",
        user.exam || "THPT Quốc gia",
        user.exam_date || "",
        user.target_school || "",
        num(user.goal_hours) || 4,
        user.accent || "green",
        user.theme || "dark",
        num(user.stars),
        num(user.streak),
        bool(user.reminders),
        bool(user.sounds),
        bool(user.heartbeat),
        bool(user.is_guest),
        num(user.created_at),
        num(user.created_at),
      ])
    );

    report.rooms = await insertRows(
      client,
      "rooms",
      [
        "id", "name", "subject", "type", "topic", "host_name", "host_emoji", "capacity",
        "base_joined", "is_live", "created_by", "sort_order", "created_at",
      ],
      rooms.map((room) => [
        room.id,
        room.name,
        room.subject,
        room.type,
        room.topic || "",
        room.host_name,
        room.host_emoji,
        num(room.capacity) || 20,
        num(room.base_joined),
        bool(room.is_live),
        text(room.created_by),
        num(room.sort_order),
        num(room.created_at),
      ])
    );

    report.room_members = await insertRows(
      client,
      "room_members",
      ["room_id", "user_id", "seat", "role", "joined_at", "last_seen"],
      members.map((row) => [
        row.room_id,
        row.user_id,
        num(row.seat),
        row.role || "member",
        num(row.joined_at),
        num(row.last_seen),
      ])
    );

    report.messages = await insertRows(
      client,
      "messages",
      ["id", "room_id", "user_id", "author", "emoji", "text", "created_at"],
      messages.map((row) => [
        row.id,
        row.room_id,
        text(row.user_id),
        row.author,
        row.emoji || "🙂",
        row.text,
        num(row.created_at),
      ])
    );

    report.docs = await insertRows(
      client,
      "docs",
      ["id", "room_id", "title", "meta", "url", "icon", "created_by", "created_at"],
      docs.map((row) => [
        row.id,
        row.room_id,
        row.title,
        row.meta || "Tài liệu",
        row.url || "",
        row.icon || "file",
        text(row.created_by),
        num(row.created_at),
      ])
    );

    report.notebooks = await insertRows(
      client,
      "notebooks",
      ["room_id", "user_id", "content", "updated_at"],
      notebooks.map((row) => [row.room_id, row.user_id, row.content || "", num(row.updated_at)])
    );

    report.todos = await insertRows(
      client,
      "todos",
      ["user_id", "id", "text", "subject", "done", "position", "created_at"],
      todos.map((row) => [
        row.user_id,
        row.id,
        row.text,
        row.subject,
        bool(row.done),
        num(row.position),
        num(row.created_at),
      ])
    );

    report.schedule = await insertRows(
      client,
      "schedule",
      ["user_id", "id", "day", "start", "duration", "subject", "note", "created_at"],
      schedule.map((row) => [
        row.user_id,
        row.id,
        num(row.day),
        row.start,
        num(row.duration),
        row.subject,
        row.note || "",
        num(row.created_at),
      ])
    );

    report.focus_daily = await insertRows(
      client,
      "focus_daily",
      ["user_id", "day", "seconds", "by_subject", "by_hour"],
      focus.map((row) => [
        row.user_id,
        row.day,
        num(row.seconds),
        row.by_subject || "{}",
        row.by_hour || "{}",
      ])
    );

    report.owned = await insertRows(
      client,
      "owned",
      ["user_id", "item_id", "acquired_at"],
      owned.map((row) => [row.user_id, row.item_id, num(row.acquired_at)])
    );

    /* Đánh dấu đã có phòng mẫu để app không gieo lại lần khởi động sau. */
    await client.query(
      `INSERT INTO meta (key, value) VALUES ('seeded_rooms', '1')
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`
    );

    await client.query("COMMIT");

    console.log("Đã chuyển xong:");
    Object.entries(report).forEach(([table, count]) => console.log(`  ${table.padEnd(13)} +${count}`));
    console.log("\nKhởi động lại app để nạp state mới.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error("Chuyển dữ liệu thất bại:", err.message);
  process.exit(1);
});
