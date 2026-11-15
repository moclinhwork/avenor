# Avenor — Quản lý cá nhân

Ứng dụng React + Vite, tông nâu bã trầu. Mỗi chức năng là một module độc lập.

## Chạy thử
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bản build thường vào dist/
SINGLEFILE=1 npm run build   # gộp toàn bộ vào một file dist/index.html
```

## Cấu trúc
```
src/
  core/        theme.css, store.jsx (kho dữ liệu theo module), router.js (#hash),
               agenda.js (gom việc & lịch từ mọi module), format.js (ngày, tiền VND)
  ui/          charts.jsx (Line, Bar, Donut, Ring, Radar, Sparkline), common.jsx, Icon.jsx
  modules/
    registry.js          danh sách module + nhóm hiển thị
    overview/            Tổng quan (chỉ đọc dữ liệu các module khác)
    today/               Lịch & Việc cần làm (màn hình Hôm nay)
    health/ goals/ finance/ travel/ books/           6 module chính
    habits/ documents/ journal/ learning/            4 module bổ sung
```

## Hợp đồng của một module (`modules/<id>/index.js`)
```js
export default {
  id: 'health', title: 'Sức khỏe', short?: 'Sức khỏe', icon: 'heart',
  group: 'main' | 'core' | 'extra',
  Page,                 // component React của module
  initial,              // dữ liệu mẫu ban đầu (state riêng của module)
  agenda?(slice, dateIso, isToday) => [{ id, title, sub, kind, icon, done, overdue, toggle(slice) }],
  events?(slice) => [{ date, title, time?, kind }],   // hiện trên lịch tuần & "Sắp tới"
}
```
- `agenda` đưa việc của module lên màn hình Hôm nay; `toggle` trả về state mới khi tích xong.
- Trong component, đọc/ghi dữ liệu bằng `const [data, set] = useModule('<id>')`.
- Thêm module mới: tạo thư mục, viết `index.js` theo hợp đồng trên, khai báo trong `registry.js`.

Dữ liệu hiện là dữ liệu mẫu, lưu ở localStorage của trình duyệt ("Khôi phục dữ liệu mẫu" để làm lại).
Ngày "hôm nay" của demo cố định là 12/11/2026 trong `core/format.js` (`TODAY`).

## Lưu trữ & đồng bộ
- `core/store.jsx` giữ state, luôn ghi một bản sao vào localStorage.
- `core/sync.js` là lớp đồng bộ: khi app chạy trên Claude (artifact khai báo `db` + `user`),
  mỗi module là một tài liệu riêng tư `data/users/<id>/<moduleId>` = `{ json, updatedAt }`,
  nghe thay đổi trực tiếp để mọi thiết bị thấy cùng dữ liệu. Muốn chuyển sang backend riêng,
  chỉ cần viết lại `connectSync` với cùng giao diện `{ save(id, slice), stop() }`.
- Trang Cài đặt: trạng thái đồng bộ, tải/khôi phục file sao lưu JSON, khôi phục dữ liệu mẫu.

## Chạy trên VPS riêng (avenor.moclinh.vn)
Bản VPS gồm giao diện (build với `VITE_SERVER=1`) và máy chủ `server/index.mjs` (Node 22, SQLite có sẵn, không cần thư viện ngoài):
đăng nhập bằng tài khoản, dữ liệu mỗi module lưu trong `data/avenor.db`, ảnh trong `data/photos/`, Strava qua Strava API.

Cài lần đầu trên Ubuntu (chạy bằng root):
```bash
curl -fsSL https://raw.githubusercontent.com/moclinhwork/avenor/main/deploy/install.sh | bash -s https://github.com/moclinhwork/avenor.git
```
Cập nhật phiên bản mới: chạy lại `bash /opt/avenor/deploy/install.sh`.

Cấu hình ở `/opt/avenor/.env` (xem `.env.example`), sửa xong chạy `docker compose up -d` trong `/opt/avenor`.
- `DOMAIN`: tên miền đã trỏ về VPS; Caddy tự cấp HTTPS.
- `ALLOW_SIGNUP=1` nếu muốn cho người khác tự tạo tài khoản (mặc định chỉ tài khoản đầu tiên).
- Strava: tạo app tại https://www.strava.com/settings/api, *Authorization Callback Domain* = tên miền, rồi điền `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`.

Sao lưu: thư mục `/opt/avenor/data`.

Chạy thử bản VPS trên máy: `VITE_SERVER=1 npx vite build && STATIC_DIR=dist DATA_DIR=./data node server/index.mjs`.
