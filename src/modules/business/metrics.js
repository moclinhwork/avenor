// Business: quy tắc số liệu dùng chung cho thẻ tổng, biểu đồ và cảnh báo (thuần JS, kiểm thử được bằng node).
// - Múi giờ báo cáo Asia/Ho_Chi_Minh, tuần bắt đầu thứ Hai.
// - So sánh kỳ đang diễn ra với cùng khoảng thời gian của kỳ trước (Sales cắt đến cùng giờ phút).
// - Tỷ lệ tổng hợp (CTR, CPC, CPA, ROAS, AOV, Engagement rate) luôn tính từ tổng tử số / tổng mẫu số.
// - 0 là số liệu hợp lệ; thiếu số liệu là null và hiển thị "—".
export const TZ = 'Asia/Ho_Chi_Minh';

const fmtDay = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtTime = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const vnToday = (t = Date.now()) => fmtDay(TZ).format(new Date(t));
export const vnTime = (t = Date.now()) => fmtTime(TZ).format(new Date(t));
export const dayIn = (tz, t = Date.now()) => fmtDay(tz || TZ).format(new Date(t));

export const addDay = (d, k) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
export const span = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
export const daysOf = (a, b) => { const out = []; for (let d = a; d <= b; d = addDay(d, 1)) out.push(d); return out; };
const dow = (d) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = thứ Hai
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
export const isoDm = (d) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

/**
 * Kỳ báo cáo. key: today | week | month | custom. Trả về { key, from, to, live, cut, prev: { from, to, cut }, label, prevLabel }.
 * live = kỳ có chứa hôm nay (đang diễn ra). cut = giờ phút hiện tại, chỉ áp dụng cho ngày cuối của kỳ trước khi live.
 */
export function period(key, { from, to, now = Date.now() } = {}) {
  const today = vnToday(now);
  const time = vnTime(now);
  let p;
  if (key === 'today') p = { from: today, to: today, prev: { from: addDay(today, -1), to: addDay(today, -1) }, label: 'Today', prevLabel: 'yesterday' };
  else if (key === 'week') {
    const mon = addDay(today, -dow(today));
    p = { from: mon, to: today, prev: { from: addDay(mon, -7), to: addDay(today, -7) }, label: 'This week', prevLabel: 'same days last week' };
  } else if (key === 'month') {
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), d = Number(today.slice(8, 10));
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    const pd = Math.min(d, monthEnd(py, pm));
    const pmS = `${py}-${String(pm).padStart(2, '0')}`;
    // Ngày hôm nay lớn hơn số ngày của tháng trước (vd 31/3): kỳ trước là cả tháng trước, không cắt giờ.
    p = { from: `${today.slice(0, 7)}-01`, to: today, prev: { from: `${pmS}-01`, to: `${pmS}-${String(pd).padStart(2, '0')}`, full: d > pd }, label: 'This month', prevLabel: 'same days last month' };
  } else {
    let a = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : today, b = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : a;
    if (b > today) b = today;
    if (a > b) a = b;
    const n = span(a, b);
    p = { from: a, to: b, prev: { from: addDay(a, -n), to: addDay(a, -1) }, label: a === b ? isoDm(a) : `${isoDm(a)} – ${isoDm(b)}`, prevLabel: `previous ${n} day${n > 1 ? 's' : ''}` };
    key = 'custom';
  }
  p.key = key;
  p.live = p.to === today;
  p.cut = p.live ? time : null;
  if (p.live && !p.prev.full) p.prev.cut = time;
  p.days = span(p.from, p.to);
  return p;
}

/** Tổng một chỉ số trên danh sách ngày. null nếu không ngày nào có chỉ số này (khác 0). */
export function total(days, k) {
  if (!days) return null;
  let s = 0, any = false;
  for (const d of days) { const v = d[k]; if (v != null && !Number.isNaN(v)) { s += v; any = true; } }
  if (!any) return days.length && days.every((d) => Object.keys(d).length === 1) ? 0 : null; // ngày rỗng = 0 hợp lệ
  return s;
}
export const ratio = (a, b, mult = 1) => (a == null || b == null || b === 0 ? null : (a / b) * mult);

/** Chênh lệch so với kỳ trước. Kỳ trước = 0: trả chênh lệch tuyệt đối, không phần trăm. */
export function delta(cur, prev) {
  if (cur == null || prev == null) return null;
  if (prev === 0) return cur === 0 ? { kind: 'same', abs: 0 } : { kind: 'fromZero', abs: cur };
  return { kind: 'pct', abs: cur - prev, pct: ((cur - prev) / prev) * 100 };
}

/** Chuỗi ngày đầy đủ cho biểu đồ (ngày thiếu = null, ngày rỗng = 0), cùng định nghĩa với thẻ tổng. */
export function series(days, from, to, k) {
  const by = new Map((days || []).map((d) => [d.d, d]));
  return daysOf(from, to).map((d) => {
    const row = by.get(d);
    if (!row) return { d, v: null };
    if (Object.keys(row).length === 1) return { d, v: 0 };
    return { d, v: row[k] == null ? null : row[k] };
  });
}

/** Chỉ số quảng cáo của một kỳ (Google Ads / Meta Ads). */
export function adsTotals(days) {
  const spend = total(days, 'spend'), impressions = total(days, 'impressions'), clicks = total(days, 'clicks');
  const conversions = total(days, 'conversions'), convValue = total(days, 'convValue');
  return {
    spend, impressions, clicks, conversions, convValue,
    ctr: ratio(clicks, impressions, 100), cpc: ratio(spend, clicks),
    cpa: conversions ? ratio(spend, conversions) : null,
    // ROAS chỉ khi có giá trị chuyển đổi hợp lệ (> 0).
    roas: convValue ? ratio(convValue, spend) : null,
    messaging: total(days, 'messaging'),
  };
}
export function salesTotals(days) {
  const revenue = total(days, 'revenue'), orders = total(days, 'orders');
  return { revenue, orders, created: total(days, 'created'), canceled: total(days, 'canceled'), canceledValue: total(days, 'canceledValue'), discount: total(days, 'discount'), shipping: total(days, 'shipping'), aov: ratio(revenue, orders) };
}
export function webTotals(days) {
  const sessions = total(days, 'sessions'), engaged = total(days, 'engagedSessions');
  return { activeUsersDaily: total(days, 'activeUsers'), sessions, views: total(days, 'views'), engagedSessions: engaged, engagement: ratio(engaged, sessions, 100), keyEvents: total(days, 'keyEvents') };
}
export function ytTotals(days) {
  const g = total(days, 'subsGained'), l = total(days, 'subsLost');
  const w = total(days, 'watchMinutes');
  return { views: total(days, 'views'), watchHours: w == null ? null : w / 60, subsGained: g, subsLost: l, net: g == null || l == null ? null : g - l };
}
/** TikTok: số theo dõi chụp mỗi ngày. Thay đổi trong kỳ = ảnh chụp cuối − ảnh chụp ngày trước kỳ (hoặc đầu kỳ). */
export function ttTotals(days, from) {
  const snaps = (days || []).filter((d) => d.followers != null).sort((a, b) => a.d.localeCompare(b.d));
  const last = snaps.at(-1) || null;
  const before = snaps.filter((d) => d.d < from).at(-1) || snaps.find((d) => d.d >= from);
  return { followers: last?.followers ?? null, likes: last?.likes ?? null, videos: last?.videos ?? null, change: last && before && before !== last ? last.followers - before.followers : null, since: before?.d || null, at: last?.d || null };
}

/** Chỉ cộng chi phí quảng cáo cùng tiền tệ. Trả về { total, currency, parts, skipped }. */
export function sumSpend(parts, currency = 'VND') {
  const same = parts.filter((p) => p.currency === currency && p.spend != null);
  const skipped = parts.filter((p) => p.currency !== currency);
  return { total: same.length ? same.reduce((a, p) => a + p.spend, 0) : null, currency, parts: same, skipped, tzMismatch: same.filter((p) => p.tz && p.tz !== TZ) };
}

/** Tiến độ mục tiêu doanh số tháng. Vượt mục tiêu vẫn giữ số thực tế. */
export function goalProgress(target, achieved, today = vnToday()) {
  if (!target) return null;
  const a = achieved || 0;
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), d = Number(today.slice(8, 10));
  const days = monthEnd(y, m);
  const expected = (target * d) / days;
  return { target, achieved: a, remaining: Math.max(0, target - a), over: Math.max(0, a - target), pct: (a / target) * 100, expected, pace: expected ? a / expected : null, day: d, days };
}

const H = 3600e3;
/** Danh sách "Needs attention": lỗi kết nối, dữ liệu cũ, chỉ số vượt ngưỡng người dùng đặt, chậm tiến độ mục tiêu. */
export function attention({ connections = [], values = {}, thresholds = [], goal = null, now = Date.now() }) {
  const out = [];
  for (const c of connections) {
    if (c.status === 'needs_auth') out.push({ id: `auth-${c.id}`, level: 'bad', title: `${c.name} needs authorization`, reason: c.error || 'Access expired or was revoked.', action: 'Reconnect', to: { v: 'connections', id: c.id } });
    else if (c.status === 'error') out.push({ id: `err-${c.id}`, level: 'bad', title: `${c.name}: sync failed`, reason: c.error || 'The last sync did not finish.', action: 'Open connection', to: { v: 'connections', id: c.id } });
    else if (c.syncEveryH && c.lastOk && now - c.lastOk > Math.max(6, c.syncEveryH * 2) * H) out.push({ id: `old-${c.id}`, level: 'warn', title: `${c.name}: data is out of date`, reason: `Last successful sync ${Math.round((now - c.lastOk) / H)} hours ago.`, action: 'Sync now', to: { v: 'connections', id: c.id } });
    else if (c.syncEveryH && !c.lastOk && c.status !== 'syncing') out.push({ id: `none-${c.id}`, level: 'warn', title: `${c.name}: no data yet`, reason: 'No successful sync so far.', action: 'Open connection', to: { v: 'connections', id: c.id } });
  }
  for (const t of thresholds) {
    const v = values[t.metric];
    if (v == null || t.value == null || t.value === '') continue;
    const hit = t.op === 'below' ? v < Number(t.value) : v > Number(t.value);
    if (hit) out.push({ id: `th-${t.id}`, level: 'warn', title: `${METRIC_LABEL[t.metric] || t.metric} ${t.op === 'below' ? 'below' : 'above'} your limit`, reason: `${fmtMetric(t.metric, v)} vs limit ${fmtMetric(t.metric, Number(t.value))} (${values.periodLabel || 'selected period'}).`, action: 'Open', to: { tab: METRIC_TAB[t.metric] || 'overview' } });
  }
  if (goal && goal.pace != null && goal.pace < 0.8 && goal.achieved < goal.target && goal.day >= 5) {
    out.push({ id: 'goal-pace', level: 'warn', title: 'Behind monthly sales target', reason: `${Math.round(goal.pct)}% reached on day ${goal.day}/${goal.days}; on pace would be ${Math.round((goal.expected / goal.target) * 100)}%.`, action: 'Open Sales', to: { tab: 'sales' } });
  }
  return out;
}
export const METRIC_LABEL = { revenue: 'Revenue', orders: 'Orders', adsSpend: 'Ads spend', cpc: 'CPC', cpa: 'CPA', ctr: 'CTR', canceled: 'Canceled / returned orders' };
const METRIC_TAB = { revenue: 'sales', orders: 'sales', canceled: 'sales', adsSpend: 'marketing', cpc: 'marketing', cpa: 'marketing', ctr: 'marketing' };

// ---------- định dạng ----------
const nf = (d = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const dash = '—';
export const fmtInt = (v) => (v == null ? dash : nf(0).format(Math.round(v)));
export const fmtNum = (v, d = 1) => (v == null ? dash : nf(d).format(v));
export const fmtPct = (v, d = 1) => (v == null ? dash : `${nf(d).format(v)}%`);
export function fmtMoney(v, cur = 'VND') {
  if (v == null) return dash;
  if (cur === 'VND' || !cur) return `${nf(0).format(Math.round(v))} ₫`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(v);
}
export function fmtMoneyShort(v, cur = 'VND') {
  if (v == null) return dash;
  if (cur && cur !== 'VND') return fmtMoney(v, cur);
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}${nf(2).format(a / 1e9)} tỷ`;
  if (a >= 1e6) return `${s}${nf(1).format(a / 1e6)} tr`;
  if (a >= 1e3) return `${s}${nf(0).format(Math.round(a / 1e3))}k`;
  return `${s}${nf(0).format(a)} ₫`;
}
export function fmtMetric(k, v, cur) {
  if (['revenue', 'adsSpend', 'cpc', 'cpa'].includes(k)) return fmtMoney(v, cur);
  if (k === 'ctr') return fmtPct(v, 2);
  return fmtInt(v);
}
export function fmtDelta(dl, kind = 'int', cur) {
  if (!dl) return null;
  if (dl.kind === 'same') return 'No change';
  const sign = dl.abs > 0 ? '+' : dl.abs < 0 ? '−' : '';
  const absTxt = kind === 'money' ? fmtMoneyShort(Math.abs(dl.abs), cur) : kind === 'pct' ? `${nf(1).format(Math.abs(dl.abs))} pts` : fmtNum(Math.abs(dl.abs), 1);
  if (dl.kind === 'fromZero') return `${sign}${absTxt} (from 0)`;
  return `${sign}${nf(1).format(Math.abs(dl.pct))}%`;
}
export function ago(t, now = Date.now()) {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
export const fmtStamp = (t) => (t ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)) : dash);
