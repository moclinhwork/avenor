#!/usr/bin/env bash
# Bật đăng nhập Google và chỉ cho các email được liệt kê vào app.
#   bash /opt/avenor/deploy/set-google.sh <client-id> <client-secret> <email>
set -euo pipefail
cd /opt/avenor
[ $# -eq 3 ] || { echo "Cách dùng: bash deploy/set-google.sh <client-id> <client-secret> <email>"; exit 1; }
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAILS; do grep -q "^$k=" .env || echo "$k=" >> .env; done
sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$1|; s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$2|; s|^ALLOWED_EMAILS=.*|ALLOWED_EMAILS=$3|" .env
bash /opt/avenor/deploy/install.sh
echo "Đã bật đăng nhập Google cho $3."
