# StudyWithMe

Không gian tự học trực tuyến dành cho học sinh THPT: phòng học tập trung, time-blocking, thống kê tiến độ và Study Stars.
Giao diện tối giản theo tinh thần [qoder.com](https://qoder.com/): nền tối `#121212` (hoặc sáng `#f6f6f1`), font **Instrument Sans**, điểm nhấn xanh lá `#6ad86c`, đường viền mảnh và nhiều khoảng thở.

Kiến trúc hiện tại (v3):

- **Frontend** = container nginx phục vụ HTML/CSS/JS và reverse proxy `/api` (kèm SSE) sang backend.
- **Backend** = container Node.js HTTP server thuần (không Express) chỉ phục vụ REST API + SSE.
- **Postgres 16** là nơi lưu dữ liệu bền vững (hồ sơ, phòng, ghế, chat, sổ nháp, tài liệu, lịch, to-do, giờ học, Sao, vườn cây & thú cưng).
- **Redis 7** giữ phiên đăng nhập (TTL tự dọn), rate limit đăng nhập và credit giờ học.
- **Docker Compose** dựng cả bốn dịch vụ (`frontend`, `backend`, `postgres`, `redis`) bằng một lệnh.

## Chạy nhanh bằng Docker Compose

```bash
docker compose up -d --build
```

Mở **http://localhost:3000**. Lần đầu chạy, app tự tạo schema Postgres và gieo dữ liệu mẫu.

| Container | Vai trò | Địa chỉ trên máy |
| --- | --- | --- |
| `swm-frontend` | nginx: giao diện tĩnh + proxy `/api` | http://localhost:3000 |
| `swm-backend` | Node.js: REST API + SSE | http://127.0.0.1:3001 (chỉ loopback) |
| `swm-postgres` | Postgres 16 | `localhost:5433` — user/pass/db: `swm` / `swm` / `swm` |
| `swm-redis` | Redis 7 | `localhost:6380` — db `0` cho app, db `1` cho test |

Trình duyệt chỉ cần mở **http://localhost:3000**; nginx chuyển tiếp `/api/*` sang backend nên cookie phiên vẫn cùng origin.

Cổng host dùng 5433/6380 để không đụng Postgres/Redis cài sẵn trên máy.

Các lệnh thường dùng:

```bash
docker compose ps                          # trạng thái + healthcheck
docker compose logs -f backend             # log API
docker compose logs -f frontend            # log nginx (access/error)
docker compose exec backend npm test       # chạy 23 bài test trong container
docker compose exec backend npm run reset-db   # xoá schema và gieo lại dữ liệu mẫu
docker compose down                        # dừng (giữ dữ liệu trong volume)
docker compose down -v                     # dừng và xoá sạch dữ liệu Postgres/Redis
```

`npm test` mặc định trỏ vào `swm_test` (database riêng, bị xoá schema mỗi lần chạy) và Redis db `1`, nên không làm hỏng dữ liệu dev.

## Chạy trực tiếp trên máy (không Docker cho app)

Yêu cầu **Node.js >= 20.11**; vẫn cần Postgres và Redis, ví dụ chỉ chạy hai dịch vụ nền bằng compose:

```bash
docker compose up -d postgres redis
cp .env.example .env            # hoặc export tay các biến bên dưới
npm install
npm start                       # http://localhost:3000
```

```bash
npm run dev                     # tự khởi động lại khi sửa server
npm test                        # cần Postgres/Redis đang chạy (xem .env.example)
npm run reset-db                # xoá schema Postgres, lần chạy sau gieo lại mẫu
```

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://swm:swm@localhost:5433/swm` | Chuỗi kết nối Postgres |
| `REDIS_URL` | *(rỗng)* | Để trống sẽ dùng bộ nhớ trong tiến trình thay cho Redis |
| `PORT` | `3000` | Cổng HTTP |
| `HOST` | `0.0.0.0` | Địa chỉ lắng nghe |
| `GUEST_RETENTION_DAYS` | `14` | Số ngày giữ tài khoản khách không hoạt động |
| `SERVE_STATIC` | `true` | `false` = chỉ phục vụ `/api` (chế độ container backend) |
| `TRUST_PROXY` | *(tắt)* | `1` = tin `X-Forwarded-For` khi đứng sau nginx |
| `TEST_DATABASE_URL` | `postgres://swm:swm@localhost:5433/swm_test` | Database cho `npm test` (bắt buộc tên chứa "test") |
| `TEST_REDIS_URL` | *(rỗng)* | Redis db riêng cho test |

> Không cấu hình `REDIS_URL` thì phiên/rate limit/credit nằm trong RAM: tiện cho dev một tiến trình, **không** dùng khi chạy nhiều instance.

### Mở trực tiếp bằng `file://`

Vẫn mở được các trang HTML để xem giao diện, nhưng khi đó ứng dụng chạy ở **chế độ chỉ-đọc**: dùng dữ liệu mẫu trong bộ nhớ, không đăng nhập và không lưu thay đổi.

## Tài khoản & phiên làm việc

- Lần đầu tải `/api/bootstrap.js`, server tạo **phiên khách** và gắn cookie `swm_sid` (30 ngày, `HttpOnly`, `SameSite=Lax`; thêm `Secure` khi chạy HTTPS).
- Phiên nằm trong Redis với TTL 30 ngày — không cần bảng `sessions`, không có rác tích luỹ.
- Khách dùng được toàn bộ tính năng: tạo phòng, chat, học, tích Sao…
- **Đăng ký** nâng cấp chính tài khoản khách đang dùng, giữ nguyên dữ liệu đã tạo.
- **Đăng nhập** chuyển sang tài khoản đã có; **Đăng xuất** xoá phiên và quay về trang giới thiệu.
- Tài khoản khách không hoạt động quá `GUEST_RETENTION_DAYS` được dọn tự động (mỗi 6 giờ), dữ liệu con xoá theo khoá ngoại `ON DELETE CASCADE`.

## Các trang

| Trang | File | Nội dung |
| --- | --- | --- |
| Trang giới thiệu | `index.html` | Hero, 3 chế độ phòng, tính năng, quy trình, đánh giá, FAQ, CTA, đăng nhập/đăng ký |
| Sảnh chính | `dashboard.html` | D-Day, KPI thật, danh sách phòng cộng đồng, lọc/tìm phòng và tạo phòng Cộng đồng / Nhóm / Cá nhân |
| Phòng của tôi | `myroom.html` | Danh sách phòng đã tạo/đã tham gia, lọc chủ phòng/thành viên, Vào phòng, Rời/Giải tán |
| Kế hoạch học | `planner.html` | Time-blocking theo tuần, thêm/xoá ca học, danh sách việc cần làm |
| Phòng học | `room.html` | Thành viên + số ghế, Pomodoro/đếm xuôi, heartbeat, mục tiêu, ghim tệp từ máy/điện thoại hoặc URL, chat realtime/sổ nháp, Rời phòng / Giải tán nhóm |
| Thống kê | `stats.html` | Heatmap 90/180/365 ngày, KPI, phân bố môn, khung giờ, chuỗi ngày, thành tích |
| Hồ sơ & cài đặt | `profile.html` | Thông tin học tập, avatar, màu nhấn, sáng/tối, nhắc nhở, Vườn học tập (cây trồng & thú cưng nuôi bằng Study Stars), tài khoản, đặt lại dữ liệu |

## Cấu trúc

```text
StudyWithMe/
├─ index.html … profile.html
├─ server/
│  ├─ index.js      # HTTP server, REST API, SSE, file tĩnh, nén gzip, ETag
│  ├─ service.js    # nghiệp vụ: phiên, phòng, chat, focus, cửa hàng
│  ├─ db.js         # schema Postgres, dữ liệu mẫu, tổng hợp tiến độ
│  ├─ kv.js         # Redis + fallback bộ nhớ cho phiên/rate limit/credit
│  ├─ util.js       # băm mật khẩu (scrypt async), kiểm tra dữ liệu, seed
│  ├─ migrate-sqlite.js  # chuyển dữ liệu từ SQLite v2 sang Postgres
│  └─ reset-db.js
├─ tests/
│  └─ api.test.js   # 23 bài test tích hợp trên Postgres thật
├─ docker/
│  └─ postgres-init.sql   # tạo database swm_test
├─ Dockerfile            # image backend (Node)
├─ Dockerfile.frontend   # image frontend (nginx + static)
├─ docker/nginx.conf     # cấu hình nginx + proxy /api
├─ docker-compose.yml, .env.example
├─ data/            # (cũ) SQLite của v2 — không còn dùng, đã nằm trong .gitignore
└─ assets/
   ├─ css/          # base.css, landing.css, app.css
   └─ js/           # data.js (Store nối API), ui.js, shell.js, từng trang
```

`assets/js/data.js` giữ hợp đồng cũ (`window.DATA`, `window.Store.state` đồng bộ) để các trang không phải viết lại. Dữ liệu khởi tạo do server sinh tại `/api/bootstrap.js` và gán vào `window.__SWM_BOOTSTRAP__` trước khi `data.js` chạy; các thao tác ghi đi qua REST và cập nhật lạc quan trên giao diện. Sổ nháp chỉ gửi lên server phần thực sự thay đổi.

## API

Tất cả phản hồi là JSON (trừ `/api/bootstrap.js` và SSE). Phiên xác thực bằng cookie.

| Phương thức | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` | `/api/health` | Trạng thái app + Postgres + Redis (dùng cho healthcheck) |
| `GET` | `/api/bootstrap.js` | Script khởi tạo: tài khoản + toàn bộ state cho giao diện |
| `POST` | `/api/auth/register` | Đăng ký (nâng cấp phiên khách nếu có) |
| `POST` | `/api/auth/login` | Đăng nhập |
| `POST` | `/api/auth/guest` | Tạo/giữ phiên khách |
| `POST` | `/api/auth/logout` | Đăng xuất |
| `GET` | `/api/me` | Tài khoản + state mới nhất |
| `PUT` | `/api/me/state` | Lưu hồ sơ, to-do, lịch, sổ nháp |
| `GET` | `/api/me/rooms` | "Phòng của tôi": phòng đã tạo + đã tham gia (kèm `role`, `active`) |
| `POST` | `/api/me/reset` | Đặt lại dữ liệu về bộ mẫu |
| `GET` | `/api/stats?days=90` | Heatmap, phân bố môn, khung giờ, chuỗi ngày |
| `GET` | `/api/rooms` | Danh sách phòng người dùng thấy |
| `POST` | `/api/rooms` | Tạo phòng `community` / `group` / `solo` |
| `GET` | `/api/rooms/:id` | Chi tiết phòng, thành viên, chat, tài liệu, sổ nháp |
| `DELETE` | `/api/rooms/:id` | Giải tán nhóm (chỉ chủ phòng) — xoá phòng và dữ liệu đi kèm |
| `POST` | `/api/rooms/:id/join` | Vào phòng, nhận ghế |
| `POST` | `/api/rooms/:id/leave` | Rời phòng, trả ghế (chủ phòng phải giải tán: `409 OWNER_CANNOT_LEAVE`) |
| `POST` | `/api/rooms/:id/messages` | Gửi tin nhắn (tối đa 1 tin/giây; không dùng cho phòng cá nhân) |
| `POST` | `/api/rooms/:id/docs` | Ghim tài liệu (thành viên trong phòng) |
| `POST` | `/api/rooms/:id/docs` multipart | Tải tệp lên từ máy/điện thoại (tối đa 10 MB) |
| `GET` | `/api/uploads/:docId` | Tải hoặc mở tệp đã ghim (chỉ thành viên/chủ phòng) |
| `GET` | `/api/events?room=:id` | SSE: `message`, `presence`, `focus`, `closed` |
| `POST` | `/api/focus` | Ghi nhận giờ học tập trung (server xác thực) |
| `GET` | `/api/shop` | Danh mục + vật phẩm đã sở hữu |
| `POST` | `/api/shop/buy` | Mua vật phẩm bằng Study Stars |
| `GET` | `/api/garden` | Trạng thái vườn học tập (cây, thú cưng, cấp) |
| `POST` | `/api/garden/choose` | Chọn cây trồng hoặc thú cưng đồng hành |
| `POST` | `/api/garden/tend` | Tưới cây / cho ăn, trừ Sao và lên cấp |

### Điểm đáng chú ý

- **Giờ học do server quyết định**: mỗi request tối đa 300 giây, hạn mức tích luỹ theo thời gian thực (~1,25 giây công cho mỗi giây trôi qua), lưu trong Redis nên sống sót khi restart app. Mỗi phút trọn vẹn = 1 Study Star. Ghi giờ học và trừ Sao chạy trong transaction.
- **Phòng có sức chứa thật**: ghế cấp tuần tự, chống trùng; người không hoạt động quá 30 phút được trả ghế và rời khỏi danh sách "đang trong phòng"; phòng đầy trả `409 ROOM_FULL`.
- **Tư cách thành viên bền**: `room_members` là "đã tham gia" nên còn nguyên sau khi đóng tab — cơ sở cho "Phòng của tôi". Chỉ `POST /:id/leave` (hoặc phòng bị giải tán/xoá) mới bỏ tư cách; chủ phòng giải tán bằng `DELETE /api/rooms/:id`, các client trong phòng nhận sự kiện SSE `closed`.
- **Realtime**: chat, hiện diện và cập nhật giờ học qua SSE, có ping giữ kết nối. Presence tính một lần cho cả phòng thay vì mỗi client một query.
- **Bảo mật**: mật khẩu `scrypt` **async** + salt riêng, so sánh thời gian hằng; cookie `HttpOnly`, thêm `Secure` khi HTTPS; rate limit đăng nhập theo IP lưu trong Redis; kiểm tra `Origin` cho mọi request ghi; CSP và các header bảo mật cơ bản; ẩn chi tiết lỗi 5xx khỏi client; chặn truy cập `/server/`, `/tests/`, `/data/`, file ẩn, `package.json`/`README.md`/`Dockerfile`; kiểm tra path traversal.
- **Tải trang**: HTML/JS/CSS được nén gzip và trả `ETag` (304 khi chưa đổi), nên không bị chạy JS cũ sau khi cập nhật.
- **Dữ liệu cộng đồng mẫu**: các phòng cộng đồng seed để người dùng khám phá. Tài khoản mới bắt đầu rỗng, không có to-do, lịch cá nhân, lịch sử focus, Sao hoặc chuỗi ngày giả.

## Kiểm thử

```bash
docker compose exec backend npm test
```

23 bài test tích hợp chạy trên Postgres thật (và Redis db riêng nếu có):

1. Bootstrap tạo phiên khách và trả đủ dữ liệu.
2. Lưu bền vững hồ sơ, lịch, to-do.
3. Tạo phòng, chat, ghim tài liệu, sổ nháp.
4. Focus được xác thực phía server và cộng Sao.
5. Vườn học tập trừ Sao khi tưới cây/cho ăn trong transaction, chặn chăm sóc khi đã ở mốc cuối (6 mốc: hạt → nảy mầm → thân → phân cành → tán lá → kết quả).
6. Đăng ký nâng cấp khách → đăng xuất → đăng nhập lại.
7. Thống kê heatmap/chuỗi ngày.
8. Đặt lại dữ liệu về bộ mẫu.
9. Quyền riêng tư phòng cá nhân.
10. Phòng Nhóm riêng tư nhưng vào được bằng link.
11. Static, chặn dữ liệu nhạy cảm, API lạ, healthcheck.
12. Từ chối request ghi từ `Origin` khác.
13. Phòng đầy trả 409 cho người vào sau.
14. "Phòng của tôi": gồm phòng đã tạo/đã tham gia, mất phòng khi rời, chủ phòng không rời được, người khác không giải tán được.
15. Tư cách thành viên còn sau 2 giờ không hoạt động (ghế thì được trả lại).
16. SSE mở được và trả luồng sự kiện.

Giao diện **chưa** có test tự động (không có Playwright/E2E trong repo); mọi thay đổi UI cần kiểm tra thủ công trên trình duyệt.

## Ghi chú thiết kế

- Palette và typography nằm trong `assets/css/base.css` dưới dạng CSS custom properties.
- Màu nhấn đổi qua `data-accent="green|blue|violet|amber"` trên thẻ `<html>` và được lưu trong hồ sơ.
- Giao diện đổi qua `data-theme="dark|light"`, lưu trong `profile.theme`. Script nhỏ trong `<head>` áp dụng theme trước khi CSS tải để tránh nháy màu; sau đó `data.js` đồng bộ lại từ hồ sơ trên server.
- Phòng học **không dùng không gian 2D/chibi**: workspace 3 cột gồm thành viên & số ghế, đồng hồ tập trung, chat/sổ nháp.
- Toàn bộ copy bằng tiếng Việt, hướng tới học sinh THPT và kỳ thi tốt nghiệp/ĐGNL.
- Container đặt `TZ=Asia/Ho_Chi_Minh` để mốc "hôm nay" của heatmap/chuỗi ngày khớp giờ Việt Nam.

## Chuyển dữ liệu từ v2 (SQLite) sang Postgres

Script `server/migrate-sqlite.js` copy **toàn bộ** bảng (users, rooms, room_members, messages, docs, notebooks, todos, schedule, focus_daily, owned) và giữ nguyên id, token, mốc thời gian.

```bash
# chỉ xem số dòng, không ghi
docker compose up -d postgres
DATABASE_URL=postgres://swm:swm@localhost:5433/swm npm run migrate:sqlite -- --dry-run

# chuyển thật (mặc định xoá schema Postgres rồi nạp lại từ đầu)
DATABASE_URL=postgres://swm:swm@localhost:5433/swm npm run migrate:sqlite

# thêm vào database đang có thay vì làm lại từ đầu
npm run migrate:sqlite -- --no-fresh
```

Sau khi chuyển, khởi động lại backend (`docker compose restart backend`). File SQLite gốc vẫn được giữ nguyên trong `data/` (đã nằm trong `.gitignore`) để đối chiếu; xoá đi nếu không cần.

> Dữ liệu mẫu trong SQLite trùng với bộ seed của v3 nên script tạo bảng **không gieo seed**, tránh nhân đôi phòng/tin nhắn.

## Giới hạn đã biết

- Toàn bộ to-do/lịch được gửi theo kiểu "thay thế cả danh sách": hai tab cùng sửa sẽ ghi đè nhau (last-write-wins).
- Thành viên mẫu trong phòng (`base_joined`) là dữ liệu trang trí, không phải người thật; chúng chiếm ghế nên phòng mẫu có thể đầy nhanh.
- Dự án chưa có migration tool: thay đổi schema cần viết SQL bổ sung hoặc chạy `reset-db`.
- Danh sách "Bạn học đang online" ở cột phải Sảnh chính vẫn là dữ liệu trang trí, chưa nối vào presence thật.
- Tạo tài khoản khách bị giới hạn 120 lượt/IP/giờ; vượt hạn mức thì giao diện chạy ở chế độ xem thử (không ghi dữ liệu).
