"use strict";

/* ==========================================================================
   Kiểm thử API + xác thực + phòng học + focus + cửa hàng trên Postgres thật.
   Cần Postgres (và tuỳ chọn Redis) đang chạy — xem `docker compose up -d`.

   npm test
   TEST_DATABASE_URL=postgres://swm:swm@localhost:5433/swm_test
   ========================================================================== */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../server/index");
const DB = require("../server/db");

const DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://swm:swm@localhost:5433/swm_test";
const REDIS_URL = process.env.TEST_REDIS_URL || "";

let app;
let base;

function makeClient() {
  let cookie = "";
  const request = async function request(urlPath, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.cookie = cookie;
    let body;
    if (options.body !== undefined) {
      if (typeof FormData !== "undefined" && options.body instanceof FormData) {
        body = options.body;
      } else {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.body);
      }
    }
    const res = await fetch(base + urlPath, {
      method: options.method || "GET",
      headers,
      body,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return res;
  };
  request.cookie = () => cookie;
  return request;
}

async function json(res) {
  return res.json();
}

async function bootstrapData(request) {
  const res = await request("/api/bootstrap.js");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /^window\.__SWM_BOOTSTRAP__ = /);
  return JSON.parse(text.replace(/^window\.__SWM_BOOTSTRAP__ = /, "").replace(/;$/, ""));
}

let registeredSeq = 0;

/* Đăng ký tài khoản trên phiên hiện tại (nâng cấp phiên khách nếu có).
   Tạo phòng và vào phòng chỉ dành cho tài khoản đã đăng ký. */
async function registerAccount(request, name = "Học sinh QA") {
  const email = `qa-${Date.now()}-${++registeredSeq}@example.com`;
  const res = await request("/api/auth/register", {
    method: "POST",
    body: { name, email, password: "matkhau123" },
  });
  assert.equal(res.status, 201, "đăng ký phải thành công");
  return email;
}

test.before(async () => {
  const url = new URL(DATABASE_URL);
  assert.match(url.pathname, /test/i, "TEST_DATABASE_URL phải trỏ tới một database có tên chứa 'test'");

  /* Mỗi lượt chạy bắt đầu từ schema trắng để test độc lập. */
  const resetPool = DB.createPool({ connectionString: DATABASE_URL });
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await resetPool.end();

  /* Test kiểm tra cả file tĩnh nên bật lại dù container đặt SERVE_STATIC=false. */
  app = await createApp({ databaseUrl: DATABASE_URL, redisUrl: REDIS_URL, serveStatic: true });
  if (typeof app.kv.flush === "function") await app.kv.flush();
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

test.after(async () => {
  await app.close();
});

test("bootstrap tạo phiên khách với dữ liệu cá nhân sạch", async () => {
  const request = makeClient();
  const payload = await bootstrapData(request);
  assert.equal(payload.account.isGuest, true);
  assert.equal(payload.state.rooms.length, 0);
  assert.equal(payload.state.todos.length, 0);
  assert.equal(payload.state.schedule.length, 0);
  assert.equal(payload.state.profile.stars, 0);
  assert.equal(payload.state.profile.streak, 0);
  assert.equal(payload.state.profile.name, "Khách");
  assert.equal(payload.state.profile.grade, "");
  assert.equal(payload.state.profile.exam, "");
  assert.equal(payload.state.profile.targetSchool, "");
  assert.deepEqual(payload.state.owned, []);
  assert.equal(payload.state.shop.length, 3);
});

test("user mới không có phòng cộng đồng hoặc phòng của tôi", async () => {
  const request = makeClient();
  const payload = await bootstrapData(request);

  assert.equal(payload.state.myRooms.length, 0);
  assert.equal(payload.state.rooms.length, 0);
  assert.deepEqual(payload.state.myRooms, []);

  const mine = await json(await request("/api/me/rooms"));
  assert.deepEqual(mine.rooms, []);
});

test("phòng cộng đồng công khai hiện cho người khác nhưng chưa nằm trong phòng của tôi", async () => {
  const owner = makeClient();
  await bootstrapData(owner);
  await registerAccount(owner);
  const created = await json(await owner("/api/rooms", {
    method: "POST",
    body: { name: "Phòng cộng đồng QA", subject: "toan", type: "community" },
  }));

  const newcomer = makeClient();
  const newcomerBoot = await bootstrapData(newcomer);
  await registerAccount(newcomer);
  assert.ok(newcomerBoot.state.rooms.some((room) => room.id === created.room.id));
  assert.equal(newcomerBoot.state.myRooms.length, 0);

  const joined = await newcomer(`/api/rooms/${created.room.id}/join`, { method: "POST" });
  assert.equal(joined.status, 200);

  const afterJoin = await json(await newcomer("/api/rooms"));
  assert.ok(afterJoin.rooms.some((room) => room.id === created.room.id));

  const mine = await json(await newcomer("/api/me/rooms"));
  assert.ok(mine.rooms.some((room) => room.id === created.room.id));
});

test("cập nhật hồ sơ, lịch và to-do được lưu bền vững", async () => {
  const request = makeClient();
  await bootstrapData(request);

  const res = await request("/api/me/state", {
    method: "PUT",
    body: {
      profile: { name: "Trần Minh Khoa", theme: "light", accent: "violet", goalHours: 6, examDate: "" },
      todos: [{ id: "x1", text: "Ôn tập chương 1", subject: "ly", done: true }],
      schedule: [{ id: "y1", day: 2, start: "20:15", duration: 45, subject: "hoa", note: "Ôn este" }],
      notebooks: {},
    },
  });
  assert.equal(res.status, 200);
  const saved = await json(res);
  assert.equal(saved.profile.name, "Trần Minh Khoa");
  assert.equal(saved.profile.theme, "light");
  assert.equal(saved.profile.examDate, "");
  assert.equal(saved.todos.length, 1);

  const payload = await bootstrapData(request);
  assert.equal(payload.state.profile.name, "Trần Minh Khoa");
  assert.equal(payload.state.profile.theme, "light");
  assert.equal(payload.state.profile.examDate, "");
  assert.equal(payload.state.todos[0].done, true);
  assert.equal(payload.state.schedule[0].start, "20:15");
});

test("tạo phòng, gửi tin nhắn, ghim tài liệu và sổ nháp", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await registerAccount(request);

  const create = await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng kiểm thử", subject: "toan", type: "community", topic: "Kiểm thử API" },
  });
  assert.equal(create.status, 201);
  const { room } = await json(create);
  assert.equal(room.joined, 1);
  assert.equal(room.capacity, 20);

  const join = await request(`/api/rooms/${room.id}/join`, { method: "POST" });
  assert.equal(join.status, 200);
  const detail = await json(join);
  assert.equal(detail.members.length, 1);
  assert.equal(detail.members[0].me, true);

  const send = await request(`/api/rooms/${room.id}/messages`, {
    method: "POST",
    body: { text: "Xin chào phòng học!" },
  });
  assert.equal(send.status, 201);
  const message = (await json(send)).message;
  assert.equal(message.text, "Xin chào phòng học!");
  assert.equal(message.me, true);

  const doc = await request(`/api/rooms/${room.id}/docs`, {
    method: "POST",
    body: { title: "Đề ôn tập", meta: "PDF · 1 MB" },
  });
  assert.equal(doc.status, 201);

  await request("/api/me/state", {
    method: "PUT",
    body: { notebooks: { [room.id]: "Ghi chú quan trọng" } },
  });

  const again = await json(await request(`/api/rooms/${room.id}`, { method: "GET" }));
  assert.equal(again.messages.at(-1).text, "Xin chào phòng học!");
  assert.equal(again.docs[0].title, "Đề ôn tập");
  assert.equal(again.notebook, "Ghi chú quan trọng");

  const list = await json(await request("/api/rooms"));
  assert.ok(list.rooms.some((item) => item.id === room.id && item.mine));
});

test("ghim và tải tài liệu từ tệp máy tính", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await registerAccount(request);
  const created = await json(await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng upload", subject: "toan", type: "community" },
  }));
  const room = created.room;

  const form = new FormData();
  form.append("title", "Đề kiểm tra");
  form.append("meta", "PDF · 12 KB");
  form.append("file", new Blob(["%PDF-1.4 upload-test"], { type: "application/pdf" }), "de-kiem-tra.pdf");

  const upload = await request(`/api/rooms/${room.id}/docs`, {
    method: "POST",
    body: form,
  });
  assert.equal(upload.status, 201);
  const doc = (await json(upload)).doc;
  assert.equal(doc.title, "Đề kiểm tra");
  assert.match(doc.url, /^\/api\/uploads\//);

  const download = await request(`/api/uploads/${doc.id}`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-type"), /pdf/);
  const bytes = await download.arrayBuffer();
  assert.equal(Buffer.from(bytes).toString("utf8"), "%PDF-1.4 upload-test");

  const other = makeClient();
  await bootstrapData(other);
  await registerAccount(other);
  await other(`/api/rooms/${room.id}/join`, { method: "POST" });
  const denied = await other(`/api/rooms/${room.id}/docs/${doc.id}`, { method: "DELETE" });
  assert.equal(denied.status, 403);
  assert.equal((await json(denied)).code, "NOT_DOC_OWNER");

  const deleted = await request(`/api/rooms/${room.id}/docs/${doc.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);

  const gone = await request(`/api/uploads/${doc.id}`);
  assert.equal(gone.status, 404);
});

test("môn học tự nhập được giữ nguyên khi tạo phòng", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await registerAccount(request);
  const create = await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng Sinh học", subject: "custom:Sinh học", type: "community" },
  });
  assert.equal(create.status, 201);
  const { room } = await json(create);
  assert.equal(room.subject, "custom:Sinh học");
});

test("phòng chưa mở chặn người khác tham gia", async () => {
  const now = Date.now();
  await app.pool.query(
    `INSERT INTO rooms
     (id, name, subject, type, topic, host_name, host_emoji, capacity, base_joined, is_live, created_by, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NULL, 0, $10)`,
    ["qa-not-open", "Phòng chưa mở", "toan", "community", "Kiểm thử trạng thái", "Host", "🙂", 20, 0, now]
  );
  const user = makeClient();
  await bootstrapData(user);
  await registerAccount(user);
  const join = await user("/api/rooms/qa-not-open/join", { method: "POST" });
  assert.equal(join.status, 409);
  assert.equal((await json(join)).code, "ROOM_NOT_OPEN");
});

test("khách không tạo hoặc vào được phòng — bắt buộc đăng ký", async () => {
  const guest = makeClient();
  const boot = await bootstrapData(guest);
  assert.equal(boot.account.isGuest, true);

  const create = await guest("/api/rooms", {
    method: "POST",
    body: { name: "Phòng của khách", subject: "toan", type: "community" },
  });
  assert.equal(create.status, 403);
  assert.equal((await json(create)).code, "REGISTRATION_REQUIRED");

  /* Vào phòng bằng link mời cũng bị chặn khi còn là khách. */
  const now = Date.now();
  await app.pool.query(
    `INSERT INTO rooms
     (id, name, subject, type, topic, host_name, host_emoji, capacity, base_joined, is_live, created_by, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NULL, 0, $10)`,
    ["qa-guest-block", "Phòng chặn khách", "toan", "community", "Kiểm thử chặn khách", "Host", "🙂", 20, 0, now]
  );
  const denied = await guest("/api/rooms/qa-guest-block/join", { method: "POST" });
  assert.equal(denied.status, 403);
  assert.equal((await json(denied)).code, "REGISTRATION_REQUIRED");

  /* Sau khi đăng ký (nâng cấp phiên khách) thì vào được bình thường. */
  await registerAccount(guest);
  const ok = await guest("/api/rooms/qa-guest-block/join", { method: "POST" });
  assert.equal(ok.status, 200);
  assert.equal((await json(ok)).room.id, "qa-guest-block");
});

test("focus được xác thực phía máy chủ và cộng Sao", async () => {
  const request = makeClient();
  const boot = await bootstrapData(request);
  await registerAccount(request);
  const created = await json(await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng focus kiểm thử", subject: "toan", type: "community" },
  }));
  const before = boot.state.profile.stars;
  const todayBefore = boot.state.todayMinutes;

  const res = await request("/api/focus", {
    method: "POST",
    body: { seconds: 120, roomId: created.room.id },
  });
  assert.equal(res.status, 200);
  const result = await json(res);
  assert.ok(result.awardedSeconds > 0 && result.awardedSeconds <= 120);
  assert.equal(result.todayMinutes, todayBefore + Math.floor(result.awardedSeconds / 60));

  const after = await bootstrapData(request);
  assert.equal(after.state.profile.stars, before + result.awardedStars);
});

test("ngày thi được lưu độc lập khi kỳ thi và khối lớp để trống", async () => {
  const request = makeClient();
  await bootstrapData(request);
  const res = await request("/api/me/state", {
    method: "PUT",
    body: { profile: { examDate: "2026-12-31", exam: "", grade: "" } },
  });
  assert.equal(res.status, 200);
  const saved = await json(res);
  assert.equal(saved.profile.examDate, "2026-12-31");

  const payload = await bootstrapData(request);
  assert.equal(payload.state.profile.examDate, "2026-12-31");
});

test("dưới 60 giây focus không tạo chuỗi ngày", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await registerAccount(request);
  const created = await json(await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng focus ngắn", subject: "toan", type: "community" },
  }));
  const res = await request("/api/focus", {
    method: "POST",
    body: { seconds: 2, roomId: created.room.id },
  });
  assert.equal(res.status, 200);
  const result = await json(res);
  assert.equal(result.streak, 0);
  assert.equal(result.todayMinutes, 0);
});

test("cửa hàng không cho mua khi tài khoản mới chưa có Sao", async () => {
  const request = makeClient();
  await bootstrapData(request);
  const shop = await json(await request("/api/shop"));
  const neon = shop.items.find((item) => item.id === "neon");
  const before = shop.stars;
  assert.equal(before, 0);

  const buy = await request("/api/shop/buy", { method: "POST", body: { id: "neon" } });
  assert.equal(buy.status, 402);
  const result = await json(buy);
  assert.equal(result.code, "NOT_ENOUGH_STARS");
});

test("đăng ký nâng cấp phiên khách, đăng xuất và đăng nhập lại", async () => {
  const request = makeClient();
  await bootstrapData(request);
  const email = `hocsinh${Date.now()}@example.com`;

  const register = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Nguyễn Hải Yến", email, password: "matkhau123" },
  });
  assert.equal(register.status, 201);
  const created = await json(register);
  assert.equal(created.account.isGuest, false);
  assert.equal(created.account.email, email);

  const logout = await request("/api/auth/logout", { method: "POST" });
  assert.equal(logout.status, 200);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "matkhau123" },
  });
  assert.equal(login.status, 200);
  assert.equal((await json(login)).account.email, email);

  const bad = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "sai-mat-khau" },
  });
  assert.equal(bad.status, 401);

  const payload = await bootstrapData(request);
  assert.equal(payload.account.email, email);
  assert.equal(payload.account.isGuest, false);
});

test("thống kê trả dữ liệu heatmap và chuỗi ngày", async () => {
  const request = makeClient();
  await bootstrapData(request);
  const res = await request("/api/stats?days=90");
  assert.equal(res.status, 200);
  const stats = await json(res);
  assert.equal(stats.days, 90);
  assert.equal(Object.keys(stats.daily).length, 0);
  assert.equal(stats.totalMinutes, 0);
  assert.equal(typeof stats.streak, "number");
  assert.equal(stats.hours.length, 24);
});

test("đặt lại dữ liệu trả về trạng thái trắng sạch", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await request("/api/me/state", {
    method: "PUT",
    body: { todos: [{ id: "only", text: "Một việc duy nhất", subject: "toan", done: true }] },
  });
  const reset = await request("/api/me/reset", { method: "POST" });
  assert.equal(reset.status, 200);
  const payload = await bootstrapData(request);
  assert.equal(payload.state.todos.length, 0);
  assert.equal(payload.state.schedule.length, 0);
  assert.equal(payload.state.profile.stars, 0);
  assert.equal(payload.state.profile.streak, 0);
});

test("phòng cá nhân chỉ chủ sở hữu truy cập được", async () => {
  const owner = makeClient();
  await bootstrapData(owner);
  await registerAccount(owner);
  const solo = await json(await owner("/api/rooms", { method: "POST", body: { type: "solo", subject: "toan" } }));

  const stranger = makeClient();
  await bootstrapData(stranger);
  const denied = await stranger(`/api/rooms/${solo.room.id}`, { method: "GET" });
  assert.equal(denied.status, 404);
});

test("phòng Nhóm riêng tư không lộ trong danh sách nhưng vào được bằng link", async () => {
  const owner = makeClient();
  await bootstrapData(owner);
  await registerAccount(owner);
  const created = await json(
    await owner("/api/rooms", {
      method: "POST",
      body: { name: "Nhóm kín QA", subject: "ly", type: "group" },
    })
  );
  const room = created.room;

  const stranger = makeClient();
  await bootstrapData(stranger);
  await registerAccount(stranger);
  const before = await json(await stranger("/api/rooms"));
  assert.ok(!before.rooms.some((item) => item.id === room.id));

  const ownerList = await json(await owner("/api/rooms"));
  assert.ok(ownerList.rooms.some((item) => item.id === room.id));

  const join = await stranger(`/api/rooms/${room.id}/join`, { method: "POST" });
  assert.equal(join.status, 200);
  assert.equal((await json(join)).room.id, room.id);

  const after = await json(await stranger("/api/rooms"));
  assert.ok(after.rooms.some((item) => item.id === room.id));
});

test("static, chặn truy cập dữ liệu nhạy cảm và API lạ", async () => {
  const anonymous = makeClient();
  /* Trang HTML không còn tự tạo phiên khách: API riêng tư phải trả 401. */
  assert.equal((await anonymous("/api/khong-ton-tai")).status, 401);

  const request = makeClient();
  await bootstrapData(request);
  const page = await request("/dashboard.html");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);

  for (const blocked of ["/data/studywithme.db", "/package.json", "/server/db.js", "/README.md"]) {
    const res = await fetch(base + blocked);
    assert.equal(res.status, 404, `${blocked} phải bị chặn`);
  }

  const unknown = await request("/api/khong-ton-tai");
  assert.equal(unknown.status, 404);

  const health = await json(await request("/api/health"));
  assert.equal(health.ok, true);
});

test("từ chối request ghi dữ liệu từ Origin khác", async () => {
  const request = makeClient();
  await bootstrapData(request);

  const blocked = await request("/api/me/state", {
    method: "PUT",
    headers: { origin: "http://evil.example" },
    body: { profile: { name: "Kẻ lạ" } },
  });
  assert.equal(blocked.status, 403);
  assert.equal((await json(blocked)).code, "BAD_ORIGIN");

  const payload = await bootstrapData(request);
  assert.notEqual(payload.state.profile.name, "Kẻ lạ");
});

test("phòng đầy trả 409 cho người vào sau", async () => {
  const now = Date.now();
  await app.pool.query(
    `INSERT INTO rooms
      (id, name, subject, type, topic, host_name, host_emoji, capacity, base_joined, is_live, created_by, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NULL, 0, $10)`,
    ["qa-full-room", "Phòng QA đầy", "toan", "community", "Kiểm thử sức chứa", "Host", "🙂", 2, 1, now]
  );

  const first = makeClient();
  await bootstrapData(first);
  await registerAccount(first);
  const ok = await first("/api/rooms/qa-full-room/join", { method: "POST" });
  assert.equal(ok.status, 200);

  const second = makeClient();
  await bootstrapData(second);
  await registerAccount(second);
  const full = await second("/api/rooms/qa-full-room/join", { method: "POST" });
  assert.equal(full.status, 409);
  assert.equal((await json(full)).code, "ROOM_FULL");

  const message = await second("/api/rooms/qa-full-room/messages", {
    method: "POST",
    body: { text: "Cho mình vào với" },
  });
  assert.equal(message.status, 403);
  assert.equal((await json(message)).code, "NOT_ROOM_MEMBER");
});

test("\"Phòng của tôi\" gồm phòng đã tạo, đã tham gia và loại phòng đã rời", async () => {
  const owner = makeClient();
  await bootstrapData(owner);
  await registerAccount(owner);
  const created = (
    await json(
      await owner("/api/rooms", {
        method: "POST",
        body: { name: "Nhóm kiểm thử phòng của tôi", subject: "toan", type: "group" },
      })
    )
  ).room;

  const member = makeClient();
  await bootstrapData(member);
  await registerAccount(member);
  assert.equal((await member(`/api/rooms/${created.id}/join`, { method: "POST" })).status, 200);

  let mine = (await json(await member("/api/me/rooms"))).rooms;
  assert.ok(mine.some((room) => room.id === created.id && room.role === "member"));

  const leave = await member(`/api/rooms/${created.id}/leave`, { method: "POST" });
  assert.equal(leave.status, 200);
  mine = (await json(await member("/api/me/rooms"))).rooms;
  assert.ok(!mine.some((room) => room.id === created.id), "phòng đã rời không còn trong danh sách");

  const ownerRooms = (await json(await owner("/api/me/rooms"))).rooms;
  assert.ok(ownerRooms.some((room) => room.id === created.id && room.role === "host"));

  /* Chủ phòng không "rời" mà phải „giải tán nhóm“ để tránh phòng mồ côi. */
  const ownerLeave = await owner(`/api/rooms/${created.id}/leave`, { method: "POST" });
  assert.equal(ownerLeave.status, 409);
  assert.equal((await json(ownerLeave)).code, "OWNER_CANNOT_LEAVE");

  const stranger = makeClient();
  await bootstrapData(stranger);
  const denied = await stranger(`/api/rooms/${created.id}`, { method: "DELETE" });
  assert.equal(denied.status, 403);
  assert.equal((await json(denied)).code, "NOT_ROOM_OWNER");

  const dissolved = await owner(`/api/rooms/${created.id}`, { method: "DELETE" });
  assert.equal(dissolved.status, 200);
  assert.equal((await owner(`/api/rooms/${created.id}`)).status, 404);
  const after = (await json(await owner("/api/me/rooms"))).rooms;
  assert.ok(!after.some((room) => room.id === created.id));
});

test("thành viên được giữ trong phòng dù lâu không hoạt động", async () => {
  const owner = makeClient();
  await bootstrapData(owner);
  await registerAccount(owner);
  const created = (
    await json(
      await owner("/api/rooms", {
        method: "POST",
        body: { name: "Nhóm ít hoạt động", subject: "ly", type: "group" },
      })
    )
  ).room;

  const member = makeClient();
  await bootstrapData(member);
  await registerAccount(member);
  const joined = await json(await member(`/api/rooms/${created.id}/join`, { method: "POST" }));
  const memberId = joined.members.find((item) => item.me).id;

  /* Giả lập lần cuối hoạt động là 2 giờ trước. */
  await app.pool.query("UPDATE room_members SET last_seen = $1 WHERE room_id = $2 AND user_id = $3", [
    Date.now() - 2 * 3600 * 1000,
    created.id,
    memberId,
  ]);

  const list = (await json(await member("/api/me/rooms"))).rooms;
  const room = list.find((item) => item.id === created.id);
  assert.ok(room, "vẫn phải nằm trong Phòng của tôi");
  assert.equal(room.active, false);

  /* Không còn chiếm ghế trong danh sách người đang ở phòng. */
  const detail = await json(await owner(`/api/rooms/${created.id}`));
  assert.ok(!detail.members.some((item) => item.id === memberId));

  await owner(`/api/rooms/${created.id}`, { method: "DELETE" });
});

test("SSE mở được và trả về luồng sự kiện", async () => {
  const request = makeClient();
  await bootstrapData(request);
  await registerAccount(request);
  const created = await json(await request("/api/rooms", {
    method: "POST",
    body: { name: "Phòng SSE kiểm thử", subject: "toan", type: "community" },
  }));
  const controller = new AbortController();
  const res = await fetch(`${base}/api/events?room=${created.room.id}`, {
    headers: { cookie: request.cookie(), accept: "text/event-stream" },
    signal: controller.signal,
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /event-stream/);
  const reader = res.body.getReader();
  const chunk = await reader.read();
  const text = new TextDecoder().decode(chunk.value || new Uint8Array());
  assert.match(text, /retry:/);
  controller.abort();
});
