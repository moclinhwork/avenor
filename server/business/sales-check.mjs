// Chạy trong container: node server/business/sales-check.mjs  (xem deploy/sales-check.sh)
import { salesInfo, salesRange } from './sales.mjs';
import { dayIn, addDay } from './index.mjs';

try {
  const info = salesInfo();
  console.log('Tep du lieu   :', info.db);
  console.log('Bang don      :', info.orders, '| bang chi tiet:', info.items || '(khong thay)');
  console.log('Cot           :', JSON.stringify(info.columns));
  console.log('Mau ngay      :', info.dateSample);
  console.log('Khong tinh DS :', info.exclude.join(', '), '| nhap:', info.draft.join(', '));
  console.log('So don theo trang thai (toan bo):');
  for (const s of info.statuses) console.log(`  ${(s.status || '(trong)').padEnd(16)} ${s.n}`);
  const to = process.env.TO || dayIn('Asia/Ho_Chi_Minh');
  const from = process.env.FROM || addDay(to, -29);
  const r = salesRange(from, to);
  const sum = (k) => r.days.reduce((a, d) => a + (d[k] || 0), 0);
  console.log(`Tu ${from} den ${to}: doanh so ${sum('revenue').toLocaleString('vi-VN')} d, don tinh DS ${sum('orders')}, don tao moi ${sum('created')}, huy/hoan ${sum('canceled')}`);
  console.log('Trang thai trong ky:', r.extra.statuses.map((s) => `${s.status}=${s.n}`).join(' '));
  console.log('San pham ban chay :', r.extra.products ? r.extra.products.slice(0, 3).map((p) => `${p.name} (${p.qty})`).join(' | ') : '(khong co bang chi tiet)');
  console.log('Don moi nhat luc  :', r.extra.lastOrderAt);
} catch (e) {
  console.log('LOI:', e.message, e.detail || '');
  if (e.message === 'sales_db_missing') console.log('Kiem tra SALES_DATA_DIR trong /opt/avenor/.env (mac dinh /opt/sothuchi/data) roi chay lai bash deploy/install.sh');
  if (e.message === 'sales_db_unreadable') console.log('Container chay bang uid 1000: cap quyen doc, vi du  setfacl -m u:1000:rx /opt/sothuchi/data && setfacl -m u:1000:r /opt/sothuchi/data/ketoan.db*');
  process.exitCode = 1;
}
