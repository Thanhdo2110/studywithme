# StudyWithMe — Kiến trúc & Bản đồ hệ thống

> Cập nhật: 2026-11. Đọc 5 phút để nắm toàn bộ luồng dữ liệu trước khi sửa code.

## 1. Tổng quan

Ứng dụng **multi-page vanilla JS** (không framework) + **REST API** Node thuần
+ **Postgres** (dữ liệu) + **Redis** (phiên / rate-limit / tín dụng focus).
Đóng gói Docker: `swm-frontend` (nginx tĩnh + proxy), `swm-backend` (API),
`swm-postgres`, `swm-redis`.

Chọn vanilla stack để giữ bản nhẹ, không build-step, dễ mang đi thi demo.

## 2. Lớp server (server/)

| File | Vai trò | Ranh giới |
|---|---|---|
| `index.js` | HTTP layer: route, parse body, cookie/session, SSE | KHÔNG viết SQL trực tiếp — gọi `service.js` |
| `service.js` | Nghiệp vụ: phòng, thành viên, chat, docs, focus, garden, profile | duy nhất nơi viết SQL |
| `util.js` | Hằng số & helper dùng chung (ROOM_TYPES, GARDEN_COSTS, cleanText…) | không I/O |
| `db.js` | Pool Postgres + migration bảng | — |
| `kv.js` | Redis: session, rate-limit, focus-credit | TTL mọi key |
| `api.test.js` (tests/) | 24 test API chạy trên server thật | `npm test` |

Luồng request: `index.js` (xác thực qua Redis `swm:sess:*`) → `service.js`
(BEGIN/COMMIT trên Postgres) → SSE broadcast cho phòng liên quan.

## 3. Lớp frontend (assets/js/)

| File | Vai trò |
|---|---|
| `data.js` | **Nguồn sự thật client**: state, gọi API, persist profile/todos/schedule |
| `ui.js` | Bootstrap, toast, modal, icons, đăng nhập/đăng ký |
| `shell.js` | Sidebar + topbar dùng chung mọi trang |
| `room.js` | Trang phòng: timer, chat, docs, thành viên, mục tiêu, heartbeat |
| `dashboard.js` / `myroom.js` / `planner.js` / `stats.js` / `profile.js` / `garden.js` / `music.js` / `landing.js` | Mỗi trang một module, IIFE độc lập |

Luồng dữ liệu: trang tải → `bootstrap` (state ban đầu) → render →
SSE `/api/events` cập nhật realtime (chat, docs, presence, focus) →
`Store.persist()` đẩy thay đổi profile/todos về `PUT /api/me/state`.

## 4. Nguyên tắc đã chốt (đừng phá khi refactor)

1. **Giờ học = chỉ khi đồng hồ chạy**; chống gian lận bằng credit Redis (~thời gian thực).
2. **Presence**: heartbeat/SSE mỗi 75s; im lặng 2 phút = trả ghế; tư cách thành viên
   chỉ mất khi bấm "Rời phòng" (xóa `room_members`).
3. **Phòng không gắn môn** — tên phòng tự nói nội dung; môn chỉ tồn tại ở Kế hoạch học.
4. **Hằng số chơi game** (`GARDEN_COSTS`, `GARDEN_PET_COSTS = COSTS × 3`, `MAX_LEVEL = 6`)
   nằm ở `server/util.js` — server là nguồn sự thật, client chỉ hiển thị.
5. **Cache-busting** `?v=N` trên mọi link CSS/JS trong HTML — bump N khi đổi code.

## 5. Chỉ mục dữ liệu chính

- `users` — hồ sơ, stars, streak, theme…
- `rooms`, `room_members` (ghế + last_seen), `messages`, `docs`, `notebooks`
- `todos` (mục tiêu trong phòng), `schedule` (kế hoạch tuần)
- `focus_daily` (user_id, day) + `by_subject`/`by_hour` jsonb — nguồn mọi thống kê
- `gardens` (data jsonb: cây + thú cưng, cấp ≤ 6)
- Redis: `swm:sess:*` (30 ngày), `swm:rl:*` (rate limit), `swm:focus:*` (credit, TTL ngắn)

## 6. Chạy & kiểm thử

```bash
docker compose up -d --build        # cả 4 container
npm test                            # 24 API tests (node --test)
docker compose up -d --build frontend   # chỉ frontend
docker compose up -d --build backend frontend   # server + frontend
```

Frontend đổi HTML/CSS/JS chỉ cần build frontend + refresh (đã có cache-busting).
Server đổi bắt buộc build backend (SSE sẽ tự nối lại sau ~10–20s).

## 7. Lộ trình mở rộng (khi cần)

- Tách `service.js` theo domain (rooms / focus / garden / profile) khi vượt ~2k dòng.
- Tách `room.js` thành module nhỏ (timer / chat / docs / members) — cần thiết lập
  window-level namespace trước, mỗi module một file IIFE.
- Đưa presence sang Redis pub/sub nếu sau này chạy nhiều instance backend.
