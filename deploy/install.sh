#!/usr/bin/env bash
# Cài hoặc cập nhật Avenor trên Ubuntu. Chạy bằng root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/<owner>/avenor/main/deploy/install.sh) <git-url>
set -euo pipefail
REPO="${1:-}"
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
  [ -n "$REPO" ] || { echo "Thiếu địa chỉ repo git"; exit 1; }
  echo "==> Tải mã nguồn"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"
[ -f .env ] || cp .env.example .env
mkdir -p data && chown 1000:1000 data

echo "==> Kiểm tra cổng 80/443"
if ss -ltnp | grep -E ':(80|443)\s' | grep -v docker-proxy; then
  echo "!! Cổng 80 hoặc 443 đang được chương trình khác dùng (xem dòng trên). Dừng lại để tránh ảnh hưởng trang khác."
  exit 2
fi
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp; ufw allow 443/tcp
fi

echo "==> Build và chạy"
docker compose up -d --build
sleep 5
docker compose ps
echo "==> Xong. Mở https://$(grep ^DOMAIN= .env | cut -d= -f2)"
