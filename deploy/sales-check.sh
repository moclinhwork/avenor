#!/usr/bin/env bash
# Kiểm tra Business → Sales đọc được dữ liệu đơn hàng: in cấu trúc bảng, số đơn theo trạng thái và doanh số 30 ngày gần nhất.
# Không in thông tin khách hàng. Dùng để đối chiếu với trang Hiệu quả KD / Đơn hàng của Sales.
#   bash /opt/avenor/deploy/sales-check.sh [tu-ngay den-ngay]
set -euo pipefail
cd /opt/avenor
C="$(docker ps --filter name=avenor --format '{{.Names}}' | grep -E 'app' | head -1)"
[ -n "$C" ] || { echo "Khong thay container Avenor dang chay"; exit 1; }
docker exec -e FROM="${1:-}" -e TO="${2:-}" "$C" node server/business/sales-check.mjs
