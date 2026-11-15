// Lớp lưu trữ: đồng bộ mỗi module thành một tài liệu riêng trong kho dữ liệu
// riêng tư của người dùng (data/users/<id>/<moduleId>) khi app chạy trên Claude.
// Khi không có kho (mở file trực tiếp, chạy npm run dev), app chỉ lưu localStorage.

const WAIT_MS = 8000;

async function useCap(name) {
  try {
    if (!window.claude?.use) return null;
    return await Promise.race([window.claude.use(name), new Promise((r) => setTimeout(() => r(null), WAIT_MS))]);
  } catch { return null; }
}

/**
 * Kết nối tới kho dữ liệu. Trả về null nếu không có.
 * onRemote(id, slice) được gọi khi một module thay đổi từ thiết bị khác.
 * onReady(isEmpty) được gọi sau ảnh chụp đầu tiên đã xác nhận từ máy chủ.
 */
export async function connectSync({ onRemote, onReady, onStatus }) {
  const [db, user] = await Promise.all([useCap('db'), useCap('user')]);
  if (!db || !user) return null;
  let uid = null;
  try { uid = await user.id(); } catch { uid = null; }
  if (!uid) return null;

  const col = db.collection(`data/users/${uid}`);
  const known = new Map(); // id -> json đã khớp với máy chủ
  const queue = new Map(); // id -> json chờ ghi
  const busy = new Set();
  let ready = false;
  let timer = setTimeout(() => onStatus('slow'), 10000);

  const unsub = col.onSnapshot((snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') return;
      const body = ch.doc.data();
      if (!body || typeof body.json !== 'string') return;
      if (known.get(ch.doc.id) === body.json || queue.has(ch.doc.id)) return;
      known.set(ch.doc.id, body.json);
      try { onRemote(ch.doc.id, JSON.parse(body.json)); } catch { /* bỏ qua tài liệu hỏng */ }
    });
    if (!snap.metadata.fromCache) {
      clearTimeout(timer);
      if (!ready) { ready = true; onReady(snap.empty); }
      if (!queue.size && !busy.size) onStatus('synced');
    }
  }, () => { clearTimeout(timer); onStatus('error'); });

  async function flush(id) {
    if (busy.has(id) || !queue.has(id)) return;
    const json = queue.get(id);
    queue.delete(id);
    busy.add(id);
    onStatus('saving');
    try {
      await col.doc(id).set({ json, updatedAt: new Date().toISOString() });
      known.set(id, json);
    } catch (e) {
      onStatus(e?.code === 'quota_exceeded' ? 'full' : 'error');
    }
    busy.delete(id);
    if (queue.has(id)) flush(id);
    else if (!queue.size && !busy.size) onStatus('synced');
  }
  const debounce = new Map();
  function save(id, slice) {
    const json = JSON.stringify(slice);
    if (known.get(id) === json) return;
    queue.set(id, json);
    onStatus('saving');
    clearTimeout(debounce.get(id));
    debounce.set(id, setTimeout(() => flush(id), 700));
  }
  return { save, stop: unsub };
}
