// Business: lấy số liệu qua máy chủ Avenor (/api/business/*), có bộ nhớ đệm ngắn ở trình duyệt để chuyển tab không gọi lại.
// Chế độ demo (bản Claude không có máy chủ, hoặc bật Demo mode) dùng demo.js với cùng dạng dữ liệu.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SERVER } from '../../core/platform.js';
import { DEMO_CONNECTIONS, demoData, demoExtra } from './demo.js';
import { addDay, daysOf, vnToday } from './metrics.js';

const cache = new Map();
const TTL = 60e3;
const cached = async (key, fn, force) => {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.v;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
};
export const clearCache = () => cache.clear();
const listeners = new Set();
export const notifyChange = () => { clearCache(); listeners.forEach((f) => f()); };

/** Danh sách kết nối + cấu hình nhà cung cấp. */
export function useConnections(demo) {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async (force) => {
    if (demo || !SERVER) { setSt({ loading: false, error: null, data: { connections: DEMO_CONNECTIONS, providers: DEMO_PROVIDERS, demo: true, today: vnToday() } }); return; }
    setSt((s) => ({ ...s, loading: !s.data }));
    try { setSt({ loading: false, error: null, data: await cached('conns', () => api('/api/business/connections'), force) }); }
    catch (e) { setSt((s) => ({ loading: false, data: s.data, error: e.code || 'error' })); }
  }, [demo]);
  useEffect(() => { load(); const f = () => load(true); listeners.add(f); return () => listeners.delete(f); }, [load]);
  return { ...st, reload: () => load(true) };
}

// Sales trả về đầy đủ: ngày không có đơn = 0. Nguồn khác: máy chủ đã ghi ngày rỗng, ngày chưa có số liệu để trống (null).
function fill(r, from, to) {
  if (!r?.days || !r.complete) return r;
  const today = vnToday();
  const have = new Set(r.days.map((d) => d.d));
  const add = daysOf(from, to).filter((d) => d <= today && !have.has(d)).map((d) => ({ d }));
  return { ...r, days: [...r.days, ...add].sort((a, b) => a.d.localeCompare(b.d)) };
}

/** Số liệu theo ngày của một kết nối trong [from, to]. Tự hỏi lại khi máy chủ đang lấy bổ sung ngày thiếu. */
export function useRange(conn, from, to, cut, demo) {
  const [st, setSt] = useState({ loading: !!conn, data: null, error: null });
  const tries = useRef(0);
  const key = conn ? `d|${conn.id}|${from}|${to}|${cut || ''}` : '';
  const load = useCallback(async (force) => {
    if (!conn) { setSt({ loading: false, data: null, error: null }); return; }
    if (demo || !SERVER || conn.id.startsWith('demo-')) { setSt({ loading: false, error: null, data: fill(demoData(conn, from, to), from, to) }); return; }
    setSt((s) => ({ ...s, loading: true }));
    try {
      const q = new URLSearchParams({ id: conn.id, from, to, ...(cut ? { cut } : {}) });
      const r = await cached(key, () => api(`/api/business/data?${q}`), force);
      setSt({ loading: false, error: r.error || null, data: fill(r, from, to) });
    } catch (e) { setSt((s) => ({ loading: false, data: s.data, error: e.code || 'error' })); }
  }, [key, demo]);
  useEffect(() => { tries.current = 0; load(); }, [load]);
  // Máy chủ đang lấy thêm ngày thiếu: hỏi lại sau vài giây (tối đa 6 lần).
  useEffect(() => {
    const d = st.data;
    if (!d || d.complete || !d.missing || tries.current >= 6) return undefined;
    const t = setTimeout(() => { tries.current += 1; cache.delete(key); load(true); }, 4000);
    return () => clearTimeout(t);
  }, [st.data, key, load]);
  return { ...st, reload: () => load(true) };
}

export function useExtra(conn, from, to, demo) {
  const [st, setSt] = useState({ loading: !!conn, data: null, error: null });
  const key = conn ? `x|${conn.id}|${from}|${to}` : '';
  const load = useCallback(async (force) => {
    if (!conn) { setSt({ loading: false, data: null, error: null }); return; }
    if (demo || !SERVER || conn.id.startsWith('demo-')) { setSt({ loading: false, error: null, data: demoExtra(conn, from, to) }); return; }
    setSt((s) => ({ ...s, loading: true }));
    try { const r = await cached(key, () => api(`/api/business/extra?${new URLSearchParams({ id: conn.id, from, to })}`), force); setSt({ loading: false, data: r, error: r.error || null }); }
    catch (e) { setSt((s) => ({ loading: false, data: s.data, error: e.code || 'error' })); }
  }, [key, demo]);
  useEffect(() => { load(); }, [load]);
  return { ...st, reload: () => load(true) };
}

// ---------- thao tác kết nối ----------
export const startOAuth = (provider, type, credId) => { window.location.href = `/api/business/oauth/${provider}/start?${new URLSearchParams({ type, ...(credId ? { cred: credId } : {}) })}`; };
export const listAccounts = (type, cred) => api(`/api/business/accounts?${new URLSearchParams({ type, ...(cred ? { cred } : {}) })}`);
export const createConnection = (body) => api('/api/business/connections', { method: 'POST', body }).then((r) => { notifyChange(); return r; });
export const syncConnection = (id, wait) => api(`/api/business/connections/${id}/sync${wait ? '?wait=1' : ''}`, { method: 'POST', body: {} }).then((r) => { notifyChange(); return r; });
export const updateConnection = (id, body) => api(`/api/business/connections/${id}`, { method: 'PATCH', body }).then((r) => { notifyChange(); return r; });
export const deleteConnection = (id) => api(`/api/business/connections/${id}`, { method: 'DELETE' }).then((r) => { notifyChange(); return r; });

export const DEMO_PROVIDERS = {
  sales: { configured: true, missing: [], url: 'https://sales.moclinh.vn/' },
  google_ads: { label: 'Google Ads', provider: 'google', configured: true, missing: [], syncEveryH: 3 },
  meta_ads: { label: 'Meta Ads', provider: 'meta', configured: true, missing: [], syncEveryH: 3 },
  ga4: { label: 'Website · GA4', provider: 'google', configured: true, missing: [], syncEveryH: 3 },
  youtube: { label: 'YouTube', provider: 'google', configured: true, missing: [], syncEveryH: 12, reportTz: 'America/Los_Angeles' },
  tiktok: { label: 'TikTok', provider: 'tiktok', configured: true, missing: [], syncEveryH: 6 },
};
export { addDay };
