"use strict";

/* Tạo lại toàn bộ schema Postgres với dữ liệu sạch.
   Dùng khi muốn bắt đầu lại từ đầu (dữ liệu hiện có sẽ mất). */

const DB = require("./db");

const databaseUrl = process.env.DATABASE_URL || "postgres://swm:swm@localhost:5433/swm";

(async () => {
  if (!/test|dev|local/i.test(databaseUrl)) {
    console.warn(
      "Cảnh báo: DATABASE_URL không chứa 'test'/'dev'/'local'. Vẫn tiếp tục xoá schema sau 3 giây (Ctrl+C để huỷ)…"
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const pool = DB.createPool({ connectionString: databaseUrl });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await DB.initDatabase(pool);
    console.log("Đã tạo lại schema và dữ liệu sạch.");
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error("Không đặt lại được cơ sở dữ liệu:", err.message);
  process.exit(1);
});
