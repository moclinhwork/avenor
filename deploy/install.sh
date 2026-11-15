#!/usr/bin/env bash
# Cài hoặc cập nhật Avenor trên Ubuntu (chạy bằng root):
#   bash install.sh [git-url]
# Nếu VPS đã có Caddy chạy sẵn (systemd), app chạy sau Caddy đó; nếu không, dùng Caddy trong Docker.
set -euo pipefail
REPO="${1:-https://github.com/moclinhwork/avenor.git}"
DIR=/opt/avenor

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo "==> Cài Docker"
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2 git curl
  systemctl enable --now docker
fi
command -v git >/dev/null || apt-get install -y git

if [ -d "$DIR/.git" ]; then
  echo "==> Cập nhật mã nguồn"
  git -C "$DIR" pull --ff-only
else
  echo "==> Tải mã nguồn"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"
[ -f .env ] || cp .env.example .env
grep -q '^APP_PORT=' .env || echo 'APP_PORT=8120' >> .env
mkdir -p data && chown 1000:1000 data
set -a; . ./.env; set +a

if systemctl is-active --quiet caddy; then
  echo "==> Dùng Caddy có sẵn trên VPS, app ở 127.0.0.1:$APP_PORT"
  docker compose -f deploy/compose.app-only.yml --env-file .env -p avenor up -d --build
  CF=/etc/caddy/Caddyfile
  if ! grep -q "^$DOMAIN {" "$CF"; then
    cp "$CF" "$CF.bak-avenor-$(date +%Y%m%d%H%M%S)"
    printf '\n%s {\n\tencode gzip\n\theader -Server\n\trequest_body {\n\t\tmax_size 10MB\n\t}\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$APP_PORT" >> "$CF"
    echo "==> Đã thêm $DOMAIN vào $CF (bản cũ lưu ở $CF.bak-avenor-*)"
  fi
  caddy validate --config "$CF" --adapter caddyfile
  systemctl reload caddy
else
  echo "==> Kiểm tra cổng 80/443"
  if ss -ltnp | grep -E ':(80|443)\s' | grep -v docker-proxy; then
    echo "!! Cổng 80 hoặc 443 đang được chương trình khác dùng. Dừng lại để tránh ảnh hưởng trang khác."
    exit 2
  fi
  docker compose -p avenor up -d --build
fi
sleep 5
docker ps --filter name=avenor
echo "==> Xong. Mở https://$DOMAIN"
