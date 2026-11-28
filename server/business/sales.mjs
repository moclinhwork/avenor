// Business → Sales: đọc dữ liệu đơn hàng của hệ thống Sales (sales.moclinh.vn) ở chế độ CHỈ ĐỌC.
// Sales và Kế toán chạy trên cùng VPS và dùng chung bảng đơn `tt_don` trong /opt/sothuchi/data/ketoan.db
// (Mộc Linh Ads cũng đọc bảng này). Thư mục đó được gắn vào container ở /sales (chỉ đọc), xem deploy/compose.app-only.yml.
//
// Quy tắc doanh số (đối chiếu với API báo cáo của Sales /api/tk/kinhdoanh ngày 28/11/2026):
// - Doanh số = tổng cột `tong` của đơn trong kỳ, trừ đơn có trạng thái huỷ / hoàn (canceled, returned, returning, removed).
// - `tong` = tiền hàng − giảm giá (`giam`) + phí ship thu của khách (`phi_ship`). Không có cột thuế; hoàn tiền một phần không được ghi riêng.
// - Thời điểm ghi nhận = cột `ngay` của đơn (giờ Việt Nam, "YYYY-MM-DD HH:MM").
// - Đơn tính doanh số = đơn không huỷ / hoàn. Đơn tạo mới = mọi đơn có `ngay` trong kỳ (kể cả huỷ / hoàn), không gồm đơn nháp.
// - Giá trị đơn trung bình = doanh số / số đơn tính doanh số.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const env = (k, d = '') => process.env[k] || d;
export const SALES_DB = env('SALES_DB', '/sales/ketoan.db');
export const SALES_URL = env('SALES_URL', 'https://sales.moclinh.vn/');
const list = (s) => String(s).split(',').map((x) => x.trim()).filter((x) => x !== undefined);
export const EXCLUDE = list(env('SALES_EXCLUDE', 'canceled,returned,returning,removed')).filter(Boolean);
export const DRAFT = list(env('SALES_DRAFT', 'nhap,draft')).filter(Boolean);

let schemaCache = null;
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;

function open() {
  if (!fs.existsSync(SALES_DB)) { const e = new Error('sales_db_missing'); e.detail = SALES_DB; throw e; }
  try { fs.accessSync(SALES_DB, fs.constants.R_OK); } catch { const e = new Error('sales_db_unreadable'); e.detail = SALES_DB; throw e; }
  return new DatabaseSync(SALES_DB, { readOnly: true, timeout: 5000 });
}

// Tìm bảng đơn và bảng chi tiết đơn theo tên cột (không phụ thuộc cứng vào tên bảng).
function detect(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  const cols = (t) => db.prepare(`PRAGMA table_info(${qi(t)})`).all().map((c) => c.name);
  const want = env('SALES_TABLE');
  const orders = want && tables.includes(want) ? want
    : tables.includes('tt_don') && ['ngay', 'tong', 'trang_thai'].every((c) => cols('tt_don').includes(c)) ? 'tt_don'
      : tables.find((t) => ['ngay', 'tong', 'trang_thai'].every((c) => cols(t).includes(c)));
  if (!orders) throw new Error('sales_schema');
  const oc = cols(orders);
  const wantItems = env('SALES_ITEMS_TABLE');
  const items = wantItems && tables.includes(wantItems) ? wantItems
    : tables.find((t) => t !== orders && ['don_id', 'so_luong', 'thanh_tien'].every((c) => cols(t).includes(c)) && (cols(t).includes('ten_hang') || cols(t).includes('ma_hang')));
  const ic = items ? cols(items) : [];
  return {
    orders, items: items || null,
    has: { giam: oc.includes('giam'), ship: oc.includes('phi_ship'), xoa: oc.includes('xoa'), id: oc.includes('id'), ten: ic.includes('ten_hang'), ma: ic.includes('ma_hang') },
  };
}

function schema(db) {
  if (!schemaCache || Date.now() - schemaCache.at > 10 * 60e3) schemaCache = { at: Date.now(), s: detect(db) };
  return schemaCache.s;
}

// `ngay` có thể là "YYYY-MM-DD HH:MM" hoặc "DD/MM/YYYY HH:MM": chuẩn hoá về dạng đầu.
const NGAY = "(CASE WHEN o.ngay LIKE '__/__/____%' THEN substr(o.ngay,7,4)||'-'||substr(o.ngay,4,2)||'-'||substr(o.ngay,1,2)||substr(o.ngay,11) ELSE o.ngay END)";
const ph = (a) => a.map(() => '?').join(',');

/**
 * Số liệu Sales trong khoảng [from, to] (ngày VN). cutTime "HH:MM" (tuỳ chọn) cắt ngày cuối tại giờ đó,
 * dùng để so sánh kỳ đang diễn ra với cùng khoảng thời gian của kỳ trước.
 */
export function salesRange(from, to, cutTime) {
  const db = open();
  try {
    const s = schema(db);
    const ex = EXCLUDE.length ? EXCLUDE : ['__none__'];
    const dr = DRAFT.length ? DRAFT : ['__none__'];
    const st = "COALESCE(o.trang_thai,'')";
    const end = cutTime ? `${to} ${cutTime}` : `${to} 99`;
    const base = `FROM ${qi(s.orders)} o WHERE ${NGAY} >= ? AND ${NGAY} <= ? AND ${st} NOT IN (${ph(dr)})${s.has.xoa ? ' AND COALESCE(o.xoa,0) = 0' : ''}`;
    const args = [from, end, ...dr];
    const counted = `${st} NOT IN (${ph(ex)})`;
    const rows = db.prepare(`SELECT substr(${NGAY},1,10) AS d, COUNT(*) AS created,
        SUM(CASE WHEN ${counted} THEN 1 ELSE 0 END) AS orders,
        SUM(CASE WHEN ${counted} THEN COALESCE(o.tong,0) ELSE 0 END) AS revenue,
        SUM(CASE WHEN ${counted} THEN 0 ELSE 1 END) AS canceled,
        SUM(CASE WHEN ${counted} THEN 0 ELSE COALESCE(o.tong,0) END) AS canceledValue
        ${s.has.giam ? `, SUM(CASE WHEN ${counted} THEN COALESCE(o.giam,0) ELSE 0 END) AS discount` : ''}
        ${s.has.ship ? `, SUM(CASE WHEN ${counted} THEN COALESCE(o.phi_ship,0) ELSE 0 END) AS shipping` : ''}
        ${base} GROUP BY 1 ORDER BY 1`).all(...ex, ...ex, ...ex, ...ex, ...(s.has.giam ? ex : []), ...(s.has.ship ? ex : []), ...args);
    const statuses = db.prepare(`SELECT ${st} AS status, COUNT(*) AS n, SUM(COALESCE(o.tong,0)) AS value ${base} GROUP BY 1 ORDER BY 2 DESC`).all(...args)
      .map((r) => ({ status: r.status || 'unknown', n: r.n, value: r.value || 0, counted: !EXCLUDE.includes(r.status) }));
    let products = null;
    if (s.items && s.has.id) {
      const name = s.has.ten ? 'i.ten_hang' : 'i.ma_hang';
      products = db.prepare(`SELECT ${name} AS name, ${s.has.ma ? 'MAX(i.ma_hang)' : 'NULL'} AS code, SUM(COALESCE(i.so_luong,0)) AS qty, SUM(COALESCE(i.thanh_tien,0)) AS amount
          FROM ${qi(s.items)} i JOIN ${qi(s.orders)} o ON o.id = i.don_id
          WHERE ${NGAY} >= ? AND ${NGAY} <= ? AND ${st} NOT IN (${ph(dr)}) AND ${counted}${s.has.xoa ? ' AND COALESCE(o.xoa,0) = 0' : ''}
          GROUP BY ${name} ORDER BY amount DESC LIMIT 8`).all(from, end, ...dr, ...ex)
        .map((r) => ({ name: r.name || '—', code: r.code || '', qty: r.qty || 0, amount: r.amount || 0 }));
    }
    const last = db.prepare(`SELECT MAX(${NGAY}) AS t FROM ${qi(s.orders)} o`).get()?.t || null;
    return {
      days: rows.map((r) => ({ d: r.d, revenue: r.revenue || 0, orders: r.orders || 0, created: r.created || 0, canceled: r.canceled || 0, canceledValue: r.canceledValue || 0, ...(s.has.giam ? { discount: r.discount || 0 } : {}), ...(s.has.ship ? { shipping: r.shipping || 0 } : {}) })),
      extra: { statuses, products, lastOrderAt: last },
    };
  } finally { db.close(); }
}

// Mô tả cấu trúc dữ liệu (không có thông tin khách hàng) cho màn Connections và deploy/sales-check.sh.
export function salesInfo() {
  const db = open();
  try {
    const s = detect(db);
    schemaCache = { at: Date.now(), s };
    const statuses = db.prepare(`SELECT COALESCE(trang_thai,'') AS status, COUNT(*) AS n FROM ${qi(s.orders)} GROUP BY 1 ORDER BY 2 DESC`).all();
    const fmt = db.prepare(`SELECT ngay FROM ${qi(s.orders)} WHERE ngay IS NOT NULL ORDER BY rowid DESC LIMIT 1`).get()?.ngay || '';
    return { db: SALES_DB, orders: s.orders, items: s.items, columns: s.has, statuses, dateSample: String(fmt).slice(0, 16), exclude: EXCLUDE, draft: DRAFT };
  } finally { db.close(); }
}
