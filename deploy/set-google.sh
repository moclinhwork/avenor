#!/usr/bin/env bash
# Bật đăng nhập Google và chỉ cho email được liệt kê vào app.
#   bash /opt/avenor/deploy/set-google.sh <client-id> <email>
# Client secret được hỏi riêng (không hiện trên màn hình, không lưu vào lịch sử lệnh).
# Email không có "@" sẽ được hiểu là @gmail.com.
set -euo pipefail
cd /opt/avenor
[ $# -ge 2 ] || { echo "Cách dùng: bash deploy/set-google.sh <client-id> <email>"; exit 1; }
ID="$1"; EMAIL="$2"
case "$EMAIL" in *@*) ;; *) EMAIL="$EMAIL@gmail.com" ;; esac
if [ $# -ge 3 ]; then SECRET="$3"; else read -rsp "Dán Client secret rồi bấm Enter: " SECRET; echo; fi
[ -n "$SECRET" ] || { echo "Chưa nhập Client secret"; exit 1; }
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAILS; do grep -q "^$k=" .env || echo "$k=" >> .env; done
sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$ID|; s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$SECRET|; s|^ALLOWED_EMAILS=.*|ALLOWED_EMAILS=$EMAIL|" .env
chmod 600 .env
bash /opt/avenor/deploy/install.sh
echo "Đã bật đăng nhập Google cho $EMAIL."
