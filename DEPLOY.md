# StudyWithMe — Triển khai Public (Internet)

> Checklist bắt buộc trước khi mở app cho người dùng thật. Đọc cùng ARCHITECTURE.md.

## 1. HTTPS là bắt buộc (không thoả hiệp)

### Phương án khuyên dùng: Cloudflare Tunnel (đã cài Cloudflare)

Origin **không mở bất kỳ cổng public nào** — không 80/443, không bị scan:

```bash
# trên VPS, 1 lần:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared tunnel login
cloudflared tunnel create studywithme

# /etc/cloudflared/config.yml:
# tunnel: <tunnel-id>
# credentials-file: /root/.cloudflared/<tunnel-id>.json
# ingress:
#   - hostname: yourdomain.com
#     service: http://localhost:3000
#   - service: http_status:404

cloudflared tunnel route dns studywithme yourdomain.com
cloudflared service install   # chạy như systemd service
```

Firewall lúc này chặn **toàn bộ** incoming, chỉ giữ SSH:
`ufw default deny incoming; ufw allow 22/tcp; ufw enable`.

App đã sẵn sàng cho CF:
- `CF-Connecting-IP` được server ưu tiên dùng làm IP thật cho rate limit
  (origin chỉ nhận từ tunnel nên header không thể giả mạo).
- Đặt `COOKIE_SECURE=1` trong `.env` — cookie bặt `Secure` dù origin nhận
  HTTP nội bộ từ tunnel.
- SSE ping 25s/lần giữ kết nối sống qua CF proxy (timeout idle 100s).
- Upload 10MB < giới hạn 100MB của gói CF free.

### Bật trong dashboard Cloudflare

| Setting | Giá trị | Lý do |
|---|---|---|
| SSL/TLS → Always Use HTTPS | **ON** | ép mọi request qua TLS |
| SSL/TLS mode | Full (tunnel không cần origin cert) | — |
| Security → Bot Fight Mode | **ON** | chặn bot quét miễn phí |
| Security → WAF rate limiting | rule trên `/api/auth/*` (ví dụ 20 req/phút/IP) | lớp ngoài cho rate limit app |
| Caching | giữ mặc định (API trả `no-store`, HTML `no-cache` — CF không cache nhầm) | — |
| Network → WebSockets | ON (mặc định) | SSE đi qua HTTP/1.1 proxy bình thường |

### Phương án thay thế: CF proxy về origin IP (không tunnel)

DNS A record bật proxy (mây vàng) + origin cert của CF trên Caddy/nginx,
SSL mode **Full (strict)**, firewall chỉ mở 80/443 cho
`https://www.cloudflare.com/ips-v4` — nếu mở cho cả internet thì kẻ xấu
kết nối thẳng origin và **giả CF-Connecting-IP** né rate limit.

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
