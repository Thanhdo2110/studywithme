"use strict";

/* ==========================================================================
   StudyWithMe — schema Postgres, dữ liệu mẫu và các hàm dữ liệu dùng chung.
   Mọi hàm nhận `queryable` là Pool hoặc PoolClient để dùng được trong
   transaction. Phiên đăng nhập KHÔNG nằm ở đây — chúng ở Redis (server/kv.js).
   ========================================================================== */

const { Pool, types } = require("pg");

const U = require("./util");

const SCHEMA_VERSION = "2";

/* BIGINT (OID 20) mặc định trả về string; cột thời gian của mình là mili-giây
   nên luôn nằm dưới 2^53 — đổi sang number để tránh lỗi so sánh kiểu. */
types.setTypeParser(20, (value) => Number(value));

const DEFAULT_TODOS = [
  { text: "Giải 20 câu cực trị hàm số", subject: "toan", done: true },
  { text: "Ôn lại bảng biến thiên & tiệm cận", subject: "toan", done: true },
  { text: "Làm đề sóng cơ 40 câu", subject: "ly", done: false },
  { text: "Học thuộc dãy đồng đẳng este", subject: "hoa", done: false },
  { text: "Viết lại 5 câu Writing Task 2", subject: "anh", done: false },
  { text: "Đọc 2 bài nghị luận mẫu", subject: "van", done: true },
  { text: "Luyện 30 câu logic ĐGNL", subject: "dgnl", done: false },
];

const DEFAULT_SCHEDULE = [
  { day: 0, start: "19:00", duration: 90, subject: "toan", note: "Hàm số & đồ thị" },
  { day: 0, start: "20:40", duration: 60, subject: "ly", note: "Sóng cơ" },
  { day: 1, start: "18:30", duration: 60, subject: "hoa", note: "Este – lipit" },
  { day: 1, start: "20:00", duration: 90, subject: "toan", note: "Luyện đề 90 phút" },
  { day: 2, start: "19:00", duration: 60, subject: "anh", note: "Writing Task 2" },
  { day: 2, start: "20:20", duration: 60, subject: "dgnl", note: "Đọc hiểu" },
  { day: 3, start: "19:30", duration: 60, subject: "van", note: "Nghị luận xã hội" },
  { day: 4, start: "18:00", duration: 120, subject: "toan", note: "Đề minh họa 2026" },
  { day: 4, start: "20:30", duration: 60, subject: "ly", note: "Điện xoay chiều" },
  { day: 5, start: "08:00", duration: 120, subject: "dgnl", note: "Thi thử trên máy" },
  { day: 5, start: "14:00", duration: 90, subject: "anh", note: "Listening + Writing" },
  { day: 6, start: "09:00", duration: 90, subject: "hoa", note: "Tổng ôn hữu cơ" },
  { day: 6, start: "19:00", duration: 60, subject: "toan", note: "Chữa lỗi sai" },
];

const SEED_DOCS = [
  { title: "Đề minh họa 2026 — Bộ GD&ĐT", meta: "PDF · 2.4 MB", icon: "file" },
  { title: "Công thức trọng tâm cần nhớ", meta: "Ghi chú · 12 phút đọc", icon: "book" },
  { title: "Checklist ôn thi 30 ngày cuối", meta: "Bảng tính", icon: "file" },
];

const SEED_ROOMS = [
  {
    id: "toan-12-ham-so",
    name: "Ôn Toán 12 · Chuyên đề Hàm số",
    subject: "toan",
    type: "community",
    host: "Minh Anh",
    emoji: "🌙",
    capacity: 20,
    base: 14,
    topic: "Luyện 50 câu cực trị & tương giao đồ thị",
    live: true,
    messages: [
      ["Minh Anh", "🌙", "Mọi người bắt đầu ca 50/10 nhé, mình bật đồng hồ trước 🔥"],
      ["Bảo Nam", "🐧", "Ok, mình đang mở đề Toán, ai cần chữa câu nào cứ gửi lên."],
      ["Khánh Linh", "🌿", "Cho mình xin link đề minh họa với, mình vào sau 2 phút."],
      ["Minh Anh", "🌙", "Mình ghim ở bảng tài liệu bên trái rồi nha."],
    ],
  },
  {
    id: "ly-12-song-co",
    name: "Vật lý · Sóng cơ & Điện xoay chiều",
    subject: "ly",
    type: "community",
    host: "Gia Huy",
    emoji: "⚡",
    capacity: 20,
    base: 12,
    topic: "Chữa đề giữa kỳ, tập trung phần sóng dừng",
    live: true,
    messages: [
      ["Gia Huy", "⚡", "Cả phòng ơi, mình bắt đầu chữa 10 câu sóng dừng trước nhé."],
      ["Thu Trang", "🍊", "Mình gửi đáp án câu 3 rồi, bạn nào lệch thì hỏi lại nha."],
    ],
  },
  {
    id: "hoa-huu-co",
    name: "Hóa hữu cơ · Cấp tốc 45 phút",
    subject: "hoa",
    type: "community",
    host: "Khánh Linh",
    emoji: "🌿",
    capacity: 20,
    base: 8,
    topic: "Dãy đồng đẳng, este và bài tập đốt cháy",
    live: true,
    messages: [
      ["Khánh Linh", "🌿", "Mình dùng ca 45 phút, ai vào muộn cứ bắt nhịp từ câu 5."],
      ["Đức Anh", "🦉", "Bảng đồng đẳng mình vừa ghim lên, cả nhà xem chung nha."],
    ],
  },
  {
    id: "dgnl-doc-hieu",
    name: "Luyện đề ĐGNL · Đọc hiểu",
    subject: "dgnl",
    type: "community",
    host: "Thu Trang",
    emoji: "🍊",
    capacity: 20,
    base: 11,
    topic: "20 câu đọc hiểu, chữa kỹ lỗi suy luận",
    live: true,
    messages: [
      ["Thu Trang", "🍊", "Làm 20 câu trong 25 phút, sau đó chữa từng lỗi suy luận nhé."],
      ["Ngọc Mai", "🌸", "Mình vừa xong, câu 14 mình bị bẫy từ “không”."],
    ],
  },
  {
    id: "anh-writing",
    name: "Tiếng Anh · Writing Task 2",
    subject: "anh",
    type: "group",
    host: "Ngọc Mai",
    emoji: "🌸",
    capacity: 8,
    base: 5,
    topic: "Viết 2 bài argument essay, chữa chéo",
    live: true,
    messages: [
      ["Ngọc Mai", "🌸", "Nhóm mình chữa chéo nhé, mỗi người gửi 1 mở bài trước."],
      ["Hoàng Long", "🐯", "Mình gửi mở bài về giáo dục đại học rồi đó."],
    ],
  },
  {
    id: "van-nghi-luan",
    name: "Ngữ văn · Nghị luận xã hội",
    subject: "van",
    type: "community",
    host: "Hà My",
    emoji: "🫧",
    capacity: 20,
    base: 9,
    topic: "Lập dàn ý cho 3 đề thi thử",
    live: false,
    messages: [
      ["Hà My", "🫧", "Phòng sẽ mở lại lúc 20:00, mọi người chuẩn bị 3 đề trong checklist nha."],
    ],
  },
];

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    pass_hash TEXT,
    pass_salt TEXT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🦊',
    bio TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '12',
    exam TEXT NOT NULL DEFAULT '',
    exam_date TEXT NOT NULL DEFAULT '',
    target_school TEXT NOT NULL DEFAULT '',
    goal_hours INTEGER NOT NULL DEFAULT 4,
    accent TEXT NOT NULL DEFAULT 'green',
    theme TEXT NOT NULL DEFAULT 'light',
    stars INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    reminders BOOLEAN NOT NULL DEFAULT TRUE,
    sounds BOOLEAN NOT NULL DEFAULT TRUE,
    heartbeat BOOLEAN NOT NULL DEFAULT TRUE,
    is_guest BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    type TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    host_name TEXT NOT NULL,
    host_emoji TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    base_joined INTEGER NOT NULL DEFAULT 0,
    is_live BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    emoji TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT 'Tài liệu',
    url TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'file',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notebooks (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    text TEXT NOT NULL,
    subject TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE IF NOT EXISTS schedule (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    day INTEGER NOT NULL,
    start TEXT NOT NULL,
    duration INTEGER NOT NULL,
    subject TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE IF NOT EXISTS focus_daily (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    by_subject JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_hour JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS gardens (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at BIGINT NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS owned (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    acquired_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_members_room ON room_members(room_id);
  CREATE INDEX IF NOT EXISTS idx_members_seen ON room_members(last_seen);
  CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id, position);
  CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule(user_id, day);
  CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_daily(user_id, day);
  CREATE INDEX IF NOT EXISTS idx_docs_room ON docs(room_id);
  CREATE INDEX IF NOT EXISTS idx_users_guest ON users(is_guest, last_seen);
`;

function createPool(config = {}) {
  const pool = new Pool({
    connectionString: config.connectionString || process.env.DATABASE_URL,
    max: config.max || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...(config.ssl ? { ssl: config.ssl } : {}),
  });
  pool.on("error", (err) => console.error("[StudyWithMe][pg]", err.message));
  return pool;
}

async function initDatabase(pool, { seed = true } = {}) {
  await pool.query(SCHEMA_SQL);
  if (seed) await seedGlobal(pool);
}

/* Chèn nhiều dòng trong ít lệnh — tránh 400 round-trip khi gieo dữ liệu mẫu. */
async function insertRows(queryable, table, columns, rows) {
  if (!rows.length) return;
  const chunkSize = Math.max(1, Math.floor(60000 / columns.length));
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
    await queryable.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")}`,
      params
    );
  }
}

async function seedGlobal(pool) {
  // Không seed phòng cộng đồng mẫu. Chỉ phòng do tài khoản người dùng tạo
  // mới được đưa vào danh sách Phòng đang mở.
  await pool.query(
    "DELETE FROM rooms WHERE created_by IS NULL AND id = ANY($1::text[])",
    [SEED_ROOMS.map((room) => room.id)]
  );

  await pool.query(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    ["seeded_rooms", "0"]
  );
  await pool.query(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    ["schema_version", SCHEMA_VERSION]
  );
}

function defaultProfile() {
  const today = new Date();
  return {
    name: "Khách",
    grade: "",
    exam: "",
    examDate: "",
    targetSchool: "",
    goalHours: 4,
    avatar: "🦊",
    accent: "green",
    theme: "light",
    bio: "",
    stars: 0,
    reminders: true,
    sounds: true,
    heartbeat: true,
  };
}

async function createUser(pool, { email = null, name = null, password = null, isGuest = true } = {}) {
  const p = defaultProfile();
  const id = U.newId("usr");
  let salt = null;
  let hash = null;
  if (password) {
    const result = await U.hashPassword(password);
    salt = result.salt;
    hash = result.hash;
  }

  await pool.query(
    `INSERT INTO users
      (id, email, pass_hash, pass_salt, name, avatar, bio, grade, exam, exam_date,
       target_school, goal_hours, accent, theme, stars, streak, reminders, sounds, heartbeat, is_guest, last_seen, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, $16, $17, $18, $19, $20, $21)`,
    [
      id,
      email,
      hash,
      salt,
      name || p.name,
      p.avatar,
      p.bio,
      p.grade,
      p.exam,
      p.examDate,
      p.targetSchool,
      p.goalHours,
      p.accent,
      p.theme,
      p.stars,
      p.reminders,
      p.sounds,
      p.heartbeat,
      Boolean(isGuest),
      Date.now(),
      Date.now(),
    ]
  );

  await seedUserContent(pool, id);
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
}

async function seedUserContent(pool, userId) {
  // Tài khoản mới không được cấp dữ liệu cá nhân có sẵn.
}

async function resetUser(pool, user) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query("SELECT id FROM rooms WHERE created_by = $1", [user.id]);
    for (const room of created.rows) {
      /* Tin nhắn/tài liệu/thành viên/sổ nháp của phòng xoá theo FK CASCADE. */
      await client.query("DELETE FROM rooms WHERE id = $1", [room.id]);
    }
    await client.query("DELETE FROM room_members WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM notebooks WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM todos WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM schedule WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM focus_daily WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM owned WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM gardens WHERE user_id = $1", [user.id]);

    const p = defaultProfile();
    await client.query(
      `UPDATE users SET
        name = $1, grade = $2, exam = $3, exam_date = $4, target_school = $5, goal_hours = $6,
        avatar = $7, accent = $8, theme = $9, bio = $10, stars = $11, reminders = $12,
        sounds = $13, heartbeat = $14, streak = 0
       WHERE id = $15`,
      [
        user.is_guest ? p.name : user.name,
        p.grade,
        p.exam,
        "",
        p.targetSchool,
        p.goalHours,
        p.avatar,
        p.accent,
        p.theme,
        p.bio,
        p.stars,
        p.reminders,
        p.sounds,
        p.heartbeat,
        user.id,
      ]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await seedUserContent(pool, user.id);
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [user.id]);
  return rows[0];
}

async function computeStreak(queryable, userId) {
  const rows = await queryable.query(
    "SELECT day, seconds FROM focus_daily WHERE user_id = $1 AND day >= $2 AND seconds > 0",
    [userId, U.iso(U.addDays(new Date(), -366))]
  );
  const studied = new Set(rows.rows
    .filter((row) => Number(row.seconds) >= 60)
    .map((row) => row.day));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (studied.has(U.iso(U.addDays(today, -i)))) streak += 1;
    else break;
  }
  return streak;
}

async function dailyTotals(queryable, userId, days = 400) {
  const from = U.iso(U.addDays(new Date(), -(days - 1)));
  const { rows } = await queryable.query(
    "SELECT day, seconds, by_subject, by_hour FROM focus_daily WHERE user_id = $1 AND day >= $2 ORDER BY day",
    [userId, from]
  );
  return rows;
}

function asObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

async function focusSummary(queryable, userId, days = 400) {
  const rows = await dailyTotals(queryable, userId, days);
  const daily = {};
  const bySubject = {};
  const hours = Array.from({ length: 24 }, () => 0);
  let totalSeconds = 0;

  rows.forEach((row) => {
    totalSeconds += Number(row.seconds);
    daily[row.day] = Math.round(Number(row.seconds) / 60);

    Object.entries(asObject(row.by_subject)).forEach(([key, value]) => {
      bySubject[key] = (bySubject[key] || 0) + Number(value || 0);
    });

    Object.entries(asObject(row.by_hour)).forEach(([key, value]) => {
      const hour = Number(key);
      if (hour >= 0 && hour < 24) hours[hour] += Number(value || 0);
    });
  });

  const subjectMinutes = {};
  Object.entries(bySubject).forEach(([key, value]) => {
    subjectMinutes[key] = Math.round(value / 60);
  });

  return {
    daily,
    bySubject: subjectMinutes,
    hours: hours.map((seconds) => Math.round(seconds / 60)),
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
  };
}

/* Dọn tài khoản khách không hoạt động — nội dung của họ xoá theo FK CASCADE. */
async function purgeStaleGuests(pool, retentionDays = 14) {
  const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
  const { rowCount } = await pool.query(
    "DELETE FROM users WHERE is_guest = TRUE AND last_seen > 0 AND last_seen < $1",
    [cutoff]
  );
  return rowCount;
}

async function touchUser(pool, userId) {
  await pool.query("UPDATE users SET last_seen = $1 WHERE id = $2", [Date.now(), userId]);
}

async function pingDatabase(pool) {
  await pool.query("SELECT 1");
}

module.exports = {
  createPool,
  initDatabase,
  seedGlobal,
  defaultProfile,
  createUser,
  seedUserContent,
  resetUser,
  computeStreak,
  dailyTotals,
  focusSummary,
  purgeStaleGuests,
  touchUser,
  pingDatabase,
  SEED_ROOMS,
};
