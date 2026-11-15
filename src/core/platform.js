// Avenor chạy ở hai nơi: trên Claude (artifact) hoặc trên VPS riêng (máy chủ trong server/).
// Bản cho VPS được build với VITE_SERVER=1.
export const SERVER = import.meta.env.VITE_SERVER === '1';

export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const init = { method, credentials: 'same-origin', headers: { 'X-Avenor': '1', ...headers } };
  if (body !== undefined) {
    if (body instanceof Blob) { init.body = body; init.headers['Content-Type'] = body.type; }
    else { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  }
  const r = await fetch(path, init);
  if (raw) return r;
  let j = null;
  try { j = await r.json(); } catch { /* không có nội dung JSON */ }
  if (!r.ok) { const e = new Error(j?.error || `http_${r.status}`); e.code = j?.error || `http_${r.status}`; e.status = r.status; throw e; }
  return j;
}
