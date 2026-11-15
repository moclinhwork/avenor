// Đồng bộ với máy chủ Avenor trên VPS: mỗi module là một tài liệu JSON của tài khoản.
// Thiết bị khác thấy thay đổi qua việc hỏi lại máy chủ định kỳ và khi quay lại tab.
import { api } from './platform.js';

const POLL_MS = 20000;

export async function connectServerSync({ onRemote, onReady, onStatus }) {
  const known = new Map();
  const queue = new Map();
  const busy = new Set();
  const debounce = new Map();
  let since = 0;
  let stopped = false;

  async function pull(first) {
    try {
      const r = await api(`/api/data?since=${first ? 0 : since}`);
      since = r.now;
      r.docs.forEach((d) => {
        if (known.get(d.id) === d.json || queue.has(d.id) || busy.has(d.id)) return;
        known.set(d.id, d.json);
        try { onRemote(d.id, JSON.parse(d.json)); } catch { /* bỏ qua tài liệu hỏng */ }
      });
      // Gọi sau khi connectServerSync trả về, để store đã có đối tượng đồng bộ.
      if (first) setTimeout(() => onReady(r.total === 0), 0);
      if (!queue.size && !busy.size) onStatus('synced');
      return true;
    } catch (e) {
      if (e.status === 401) { location.reload(); return false; }
      onStatus('slow');
      return false;
    }
  }

  async function flush(id) {
    if (busy.has(id) || !queue.has(id)) return;
    const json = queue.get(id);
    queue.delete(id);
    busy.add(id);
    onStatus('saving');
    try {
      await api(`/api/data/${id}`, { method: 'PUT', body: { json } });
      known.set(id, json);
    } catch (e) {
      onStatus(e.status === 413 ? 'full' : 'error');
      if (!queue.has(id)) queue.set(id, json); // thử lại ở lần lưu sau
      busy.delete(id);
      setTimeout(() => flush(id), 5000);
      return;
    }
    busy.delete(id);
    if (queue.has(id)) flush(id);
    else if (!queue.size && !busy.size) onStatus('synced');
  }

  function save(id, slice) {
    const json = JSON.stringify(slice);
    if (known.get(id) === json) return;
    queue.set(id, json);
    onStatus('saving');
    clearTimeout(debounce.get(id));
    debounce.set(id, setTimeout(() => flush(id), 700));
  }

  await pull(true);
  const timer = setInterval(() => { if (!document.hidden && !stopped) pull(false); }, POLL_MS);
  const onVis = () => { if (!document.hidden) pull(false); };
  document.addEventListener('visibilitychange', onVis);
  return { save, stop: () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); } };
}
