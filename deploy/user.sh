#!/usr/bin/env bash
# Tạo tài khoản hoặc đặt lại mật khẩu (mật khẩu gõ ẩn, không lưu vào lịch sử lệnh):
#   bash /opt/avenor/deploy/user.sh <tên-đăng-nhập>
# Xem danh sách tài khoản:
#   bash /opt/avenor/deploy/user.sh
set -euo pipefail
C=$(docker ps --filter name=avenor-app --format '{{.Names}}' | head -1)
[ -n "$C" ] || { echo "App chưa chạy"; exit 1; }
if [ $# -eq 0 ]; then docker exec "$C" node server/admin.mjs list; exit 0; fi
read -rsp "Mật khẩu mới cho $1 (ít nhất 8 ký tự): " P1; echo
read -rsp "Gõ lại mật khẩu: " P2; echo
[ "$P1" = "$P2" ] || { echo "Hai lần gõ không khớp, chạy lại lệnh nhé."; exit 1; }
printf '%s' "$P1" | docker exec -i "$C" node server/admin.mjs set-password "$1"
