#!/usr/bin/env bash
# StudyWithMe — firewall cho VPS đứng sau Cloudflare proxy (A record mây vàng)
# Chỉ Cloudflare được kết nối tới cổng app; mọi IP khác bị chặn để không thể
# giả mạo header CF-Connecting-IP né rate limit.
set -euo pipefail

APP_PORT="${1:-3000}"   # cổng host mà container frontend đang nghe (compose: 3000:80)

command -v ufw >/dev/null || { echo "Cần ufw: apt install ufw"; exit 1; }

ufw default deny incoming
ufw allow 22/tcp                      # SSH — giữ từ trước

# Chỉ cho các dải IP của Cloudflare vào cổng app
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4); do
  ufw allow from "$ip" to any port "$APP_PORT" proto tcp comment "cloudflare"
done

ufw --force enable
ufw status numbered
echo "✓ Chỉ Cloudflare truy cập được cổng $APP_PORT. SSH giữ nguyên."
