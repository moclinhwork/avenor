// Ngày hôm nay theo đồng hồ thiết bị (tính lúc mở app).
const now = new Date();
export const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate());
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const ym = (d = TODAY) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthLabel = (key) => `T${Number(key.slice(5, 7))}`;

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DOW_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a, b) => Math.round((parse(iso(b)) - parse(iso(a))) / 86400000);
export const daysFromToday = (s) => daysBetween(TODAY, parse(s));
export const todayIso = iso(TODAY);

export const dow = (d) => DOW[d.getDay()];
export const dowLong = (d) => DOW_LONG[d.getDay()];
export const dm = (s) => { const d = typeof s === 'string' ? parse(s) : s; return `${d.getDate()}/${d.getMonth() + 1}`; };
export const dmy = (s) => { const d = typeof s === 'string' ? parse(s) : s; return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
export const longDate = (d) => `${dowLong(d)}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;

// Tuần bắt đầu từ thứ Hai
export const weekStart = (d) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
export const weekDays = (d = TODAY) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));

// Tiền tệ
export const vnd = (n) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;
export const vndShort = (n) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}${(a / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3).toLocaleString('vi-VN')}k`;
  return `${sign}${a}`;
};
export const num = (n, d = 1) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export const relDays = (s) => {
  const n = daysFromToday(s);
  if (n === 0) return 'Hôm nay';
  if (n === 1) return 'Ngày mai';
  if (n === -1) return 'Hôm qua';
  if (n < 0) return `Quá hạn ${-n} ngày`;
  return `Còn ${n} ngày`;
};
export const uid = () => Math.random().toString(36).slice(2, 9);

// Bộ sinh số ngẫu nhiên cố định (để dữ liệu mẫu ổn định giữa các lần tải).
export function seeded(seed = 7) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
