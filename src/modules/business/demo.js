// Chế độ demo của Business: số liệu MẪU, cùng dạng với API thật, luôn kèm nhãn "Demo data".
// Chỉ dùng khi app chạy trên Claude (không có máy chủ) hoặc khi người dùng bật Demo mode trong Business settings.
import { addDay, daysOf, vnToday } from './metrics.js';

const rnd = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const now = Date.now();

export const DEMO_CONNECTIONS = [
  { id: 'demo-sales', type: 'sales', name: 'Mộc Linh Sales', accountName: 'Demo shop', tz: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'connected', lastOk: now - 60e3, syncEveryH: 0, openUrl: 'https://sales.moclinh.vn/', meta: {} },
  { id: 'demo-gads', type: 'google_ads', name: 'Google Ads · Demo', accountName: '123-456-7890', tz: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'connected', lastOk: now - 2 * 3600e3, syncEveryH: 3, openUrl: 'https://ads.google.com/aw/overview', meta: { hasConversions: true } },
  { id: 'demo-meta', type: 'meta_ads', name: 'Meta Ads · Demo', accountName: 'act_0000', tz: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'connected', lastOk: now - 1 * 3600e3, syncEveryH: 3, openUrl: 'https://adsmanager.facebook.com/', meta: { hasConversions: false } },
  { id: 'demo-ga4', type: 'ga4', name: 'Website · Demo', accountName: 'moclinh.vn', tz: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'connected', lastOk: now - 3 * 3600e3, syncEveryH: 3, openUrl: 'https://analytics.google.com/', meta: {} },
  { id: 'demo-yt', type: 'youtube', name: 'YouTube · Demo channel', accountName: 'Demo channel', tz: 'America/Los_Angeles', reportTz: 'America/Los_Angeles', lagDays: 3, currency: '', status: 'connected', lastOk: now - 5 * 3600e3, syncEveryH: 12, openUrl: 'https://www.youtube.com/', meta: { subscribers: 12840 } },
  { id: 'demo-tt', type: 'tiktok', name: 'TikTok · Demo', accountName: '@demo', tz: 'Asia/Ho_Chi_Minh', currency: '', status: 'needs_auth', error: 'Demo: access expired. Reconnect to continue.', lastOk: now - 30 * 3600e3, syncEveryH: 6, snapshot: true, openUrl: 'https://www.tiktok.com/', meta: { username: 'demo' } },
];

function dayRow(type, d) {
  const r = rnd(hash(type + d));
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  const w = dow === 0 || dow === 6 ? 0.75 : 1;
  if (type === 'sales') {
    if (r() < 0.06) return { d, revenue: 0, orders: 0, created: 0, canceled: 0, canceledValue: 0, discount: 0, shipping: 0 };
    const orders = Math.round((3 + r() * 6) * w), canceled = r() < 0.3 ? 1 : 0;
    const revenue = Math.round((orders * (2.2e6 + r() * 2.5e6)) / 1000) * 1000;
    return { d, revenue, orders, created: orders + canceled, canceled, canceledValue: canceled * 1.8e6, discount: Math.round(r() * 3) * 100000, shipping: orders * 30000 };
  }
  if (type === 'google_ads' || type === 'meta_ads') {
    const spend = Math.round((type === 'meta_ads' ? 1.6e6 : 0.9e6) * (0.7 + r() * 0.6) * w);
    const impressions = Math.round(spend / (type === 'meta_ads' ? 32 : 55));
    const clicks = Math.round(impressions * (0.011 + r() * 0.012));
    const conv = type === 'google_ads' ? Math.round(clicks * (0.03 + r() * 0.03)) : null;
    return { d, spend, impressions, clicks, conversions: conv, convValue: conv == null ? null : conv * 2.4e6, ...(type === 'meta_ads' ? { messaging: Math.round(clicks * 0.18) } : {}) };
  }
  if (type === 'ga4') {
    const sessions = Math.round((420 + r() * 260) * w);
    return { d, activeUsers: Math.round(sessions * 0.82), sessions, views: Math.round(sessions * 2.6), engagedSessions: Math.round(sessions * (0.48 + r() * 0.15)), keyEvents: Math.round(sessions * 0.02) };
  }
  if (type === 'youtube') {
    const views = Math.round((900 + r() * 1400) * w);
    return { d, views, watchMinutes: Math.round(views * (2.2 + r())), subsGained: Math.round(views / 140), subsLost: Math.round(views / 900) };
  }
  if (type === 'tiktok') {
    const base = 8200 + Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 864e5) * 11;
    return { d, followers: base + Math.round(r() * 20), likes: base * 14, videos: 140 };
  }
  return { d };
}

export function demoData(conn, from, to) {
  const today = vnToday();
  const lag = conn.lagDays ? addDay(today, -conn.lagDays) : today;
  const days = daysOf(from, to).filter((d) => d <= lag).map((d) => dayRow(conn.type, d));
  let extra = null;
  if (conn.type === 'sales') {
    const r = rnd(hash(from + to));
    const orders = days.reduce((a, x) => a + x.orders, 0), canceled = days.reduce((a, x) => a + x.canceled, 0);
    const split = [['dang_sx', 0.35], ['packing', 0.15], ['shipped', 0.2], ['delivered', 0.2], ['received_money', 0.1]];
    let left = orders;
    const statuses = split.map(([s, f], i) => { const n = i === split.length - 1 ? left : Math.round(orders * f); left -= n; return { status: s, n, value: n * 3.1e6, counted: true }; });
    if (canceled) statuses.push({ status: 'canceled', n: canceled, value: canceled * 1.8e6, counted: false });
    const names = ['Tranh trúc chỉ Sen vàng', 'Ban thờ gỗ gõ 1m27', 'Tranh Mã đáo thành công', 'Đèn thờ lưu ly', 'Tranh Cửu ngư quần hội', 'Lư hương đồng'];
    extra = { statuses, products: names.map((name, i) => ({ name, code: `SP${100 + i}`, qty: Math.max(1, Math.round((orders / (i + 2)) * (0.6 + r() * 0.5))), amount: Math.round((orders * 3.2e6) / (i + 1.6)) })), lastOrderAt: `${today} 14:20` };
  }
  return { connection: conn, days, complete: !conn.lagDays, fetchedAt: conn.lastOk, extra, demo: true };
}

export function demoExtra(conn, from, to) {
  const r = rnd(hash(conn.type + from + to));
  if (conn.type === 'ga4') return { extra: { uniqueUsers: Math.round(360 * Math.min(31, Math.max(1, (Date.parse(to) - Date.parse(from)) / 864e5 + 1)) * 0.7), channels: [['Organic Search', 0.42], ['Paid Social', 0.24], ['Direct', 0.18], ['Paid Search', 0.1], ['Referral', 0.06]].map(([name, f]) => ({ name, sessions: Math.round(9000 * f) })), landing: ['/', '/tranh-truc-chi', '/ban-tho', '/lien-he', '/blog/cach-chon-tranh'].map((path, i) => ({ path, sessions: Math.round(3000 / (i + 1)), engaged: Math.round(1700 / (i + 1)) })), keyEvents: [{ name: 'generate_lead', count: 86 }, { name: 'click_zalo', count: 142 }] }, fetchedAt: conn.lastOk, demo: true };
  const vids = Array.from({ length: 5 }, (_, i) => ({ id: `v${i}`, title: ['Cách treo tranh trúc chỉ hợp phong thủy', 'Quy trình làm ban thờ gỗ gõ', 'Review phòng thờ chung cư 70m²', 'Tranh Sen — từ phác thảo đến hoàn thiện', '5 lỗi khi chọn ban thờ'][i], thumb: '', published: `${addDay(to, -i * 5 - 2)}T03:00:00Z`, url: '', views: Math.round(12000 / (i + 1) * (0.8 + r() * 0.4)), watchMinutes: Math.round(30000 / (i + 1)), likes: Math.round(600 / (i + 1)), comments: Math.round(40 / (i + 1)), shares: Math.round(25 / (i + 1)), subsGained: Math.round(80 / (i + 1)) }));
  return { extra: { videos: vids, lifetime: conn.type === 'tiktok' }, fetchedAt: conn.lastOk, demo: true };
}
