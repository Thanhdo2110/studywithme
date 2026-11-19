# 01 - Project Analysis

## Kiến trúc
- Frontend: HTML/CSS/JavaScript thuần, nginx static host.
- Backend: Node.js HTTP server thuần.
- Database: PostgreSQL.
- Session/cache/rate limit: Redis, có fallback in-memory.
- Realtime: SSE.
- Deployment: Docker Compose.

## Vai trò
- Khách: dùng app, tạo phòng, chat, focus.
- Thành viên: tham gia/rời phòng.
- Chủ phòng: giải tán phòng.
- Tài khoản đã đăng ký: dùng authentication persistence.

## Module
- Trang giới thiệu.
- Authentication.
- Dashboard/Phòng cộng đồng.
- Phòng của tôi.
- Phòng học/chat/tài liệu/sổ nháp.
- Kế hoạch/to-do.
- Thống kê.
- Hồ sơ/cài đặt.
- Study Stars/shop.

## Risk
1. Quyền truy cập phòng.
2. Race condition sức chứa.
3. Session và authentication.
4. Dữ liệu cá nhân giả hoặc rời rạc.
5. Realtime/SSE.
6. Responsive và browser compatibility.

