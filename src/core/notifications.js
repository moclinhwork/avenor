// Thông báo từ máy chủ (đơn tranh mới...): hỏi máy chủ định kỳ, và bật Web Push để báo cả khi đã tắt app.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SERVER } from './platform.js';

const POLL_MS = 30000;

export function useNotifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const seen = useRef(null);
  const [fresh, setFresh] = useState(null);

  const load = useCallback(async () => {
    if (!SERVER) return;
    try {
      const r = await api('/api/notifications');
      setItems(r.items);
      setUnread(r.unread);
      const ids = new Set(r.items.map((n) => n.id));
      if (seen.current) {
        const added = r.items.filter((n) => !seen.current.has(n.id) && !n.read);
        if (added.length) setFresh(added[0]);
      }
      seen.current = ids;
    } catch { /* thử lại ở lần sau */ }
  }, []);

  useEffect(() => {
    if (!SERVER) return undefined;
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    const onMsg = (e) => { if (e.data?.type === 'avenor:notifications') load(); };
    document.addEventListener('visibilitychange', onVis);
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); navigator.serviceWorker?.removeEventListener('message', onMsg); };
  }, [load]);

  const markRead = useCallback(async (ids) => {
    setItems((list) => list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    await api('/api/notifications/read', { method: 'POST', body: ids ? { ids } : { all: true } }).catch(() => {});
    load();
  }, [load]);

  return { items, unread, fresh, clearFresh: () => setFresh(null), reload: load, markRead };
}

// ---------- Web Push ----------
export const pushSupported = () => SERVER && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = reg && await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { key } = await api('/api/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) {
    await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

export const testPush = () => api('/api/push/test', { method: 'POST', body: {} });

// Đăng ký lại service worker mỗi lần mở app (để cập nhật bản mới) và gửi lại đăng ký đẩy lên máy chủ nếu đã bật.
export async function refreshPush() {
  if (!pushSupported()) return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch { /* bỏ qua */ }
}
