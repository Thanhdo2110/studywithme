# StudyWithMe — Triển khai Public (Internet)

> Checklist bắt buộc trước khi mở app cho người dùng thật. Đọc cùng ARCHITECTURE.md.

## 1. HTTPS là bắt buộc (không thoã hiệp)

Cookie phiên bật `Secure` tự động khi request qua HTTPS — nhưng bản thân
app phải đứng sau một TLS terminator:

```yaml
# Ví dụ Caddy phía trước docker compose
yourdomain.com {
  reverse_proxy localhost:3000   # container frontend (nginx)
}
```

- Caddy/Traefik/Nginx/certbot — chọn 1, cấp cert Let's Encrypt tự động.
- Cấm expose trực tiếp cổng 3000 ra internet nếu chưa có TLS.

## 2. Đổi secrets mặc định

```bash
cp .env.example .env
# sinh mật khẩu mạnh:
openssl rand -hex 24   # → POSTGRES_PASSWORD
```

Backend đọc `DATABASE_URL` — khớp mật khẩu với `.env`. **Không** để
`swm/swm` khi public.

## 3. Ports không cần thiết → đóng hẳn

`docker-compose.yml` hiện bind Postgres/Redis về `127.0.0.1` (đã vá).
Trên VPS public có thể **xoá hẳn 2 block `ports:`** của postgres/redis —
backend kết nối qua docker network nội bộ, bạn quản trị DB bằng:
`docker compose exec postgres psql -U swm -d swm`.

Chỉ frontend (3000) và backend (127.0.0.1:3001) cần tồn tại; public chỉ
phải thấy **3000 qua TLS**.

## 4. Firewall (VPS)

```bash
ufw default deny incoming
ufw allow 22/tcp    # SSH (đổi port / theo key-only)
ufw allow 80,443/tcp
ufw enable
```

## 5. Backup định kỳ (Postgres volume `pgdata`)

```bash
# crontab -e — mỗi đêm 3h, giữ 14 ngày
0 3 * * * docker compose -f /path/docker-compose.yml exec -T postgres \
  pg_dump -U swm swm | gzip > /backups/swm-$(date +\%F).sql.gz
```

Redis mất không sao (chỉ session/rate-limit/credit — tự hồi phục).

## 6. Cấu hình app đã sẵn sàng cho public

| Hạng mục | Trạng thái |
|---|---|
| TRUST_PROXY=1 (tin XFF từ nginx) | ✅ đã có trong compose |
| Rate limit auth (40/5p/IP) + khóa tài khoản sai mật khẩu (10 lần/15p) | ✅ |
| Giới hạn tạo phòng 30/giờ, tin nhắn 200/giờ, SSE ≤ 8 kết nối/người | ✅ |
| Mật khẩu tối thiểu 8 ký tự, scrypt+salt | ✅ |
| Cookie HttpOnly/SameSite/Lax + Secure khi HTTPS | ✅ |
| CSRF chặn theo Origin cho mọi request ghi | ✅ |
| CSP, nosniff, frame-ancestors, Permissions-Policy | ✅ |
| Upload whitelist, 10MB cap, tên file do server sinh | ✅ |
| Guest: 14 ngày tự xoá + hạn mức theo IP | ✅ |

## 7. Giám sát tối thiểu

```bash
docker compose logs -f backend | grep -E "429|500|locked"   # dấu hiệu bị quét
```

Khuyến nghị gắn uptime monitor (UptimeRobot) vào `/api/health`.

## 8. Việc chưa làm (làm khi có người dùng thật)

- [ ] Xác thực email khi đăng ký (chặn spam tài khoản) — cần dịch vụ SMTP
- [ ] Backup khôi phục thử (restore drill) 1 lần/tháng
- [ ] Chuyển SSE sang Redis pub/sub nếu chạy >1 backend instance
- [ ] WAF/Cloudflare trước TLS terminator nếu bị DDoS
