import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MODULES } from '../modules/registry.js';
import { connectSync } from './sync.js';
import { connectServerSync } from './serverSync.js';
import { SERVER } from './platform.js';

// Kho dữ liệu chung: mỗi module sở hữu một "lát" (slice) riêng theo id.
// Bản sao luôn lưu localStorage (mở nhanh, dùng ngoại tuyến); khi chạy trên Claude
// thì đồng bộ thêm lên kho dữ liệu riêng của tài khoản (xem core/sync.js).
const KEY = SERVER ? 'avenor-vps-data-v1' : 'avenor-data-v1';
const Ctx = createContext(null);

export const seed = () => Object.fromEntries(MODULES.filter((m) => m.initial).map((m) => [m.id, m.initial]));
const ids = () => MODULES.filter((m) => m.initial).map((m) => m.id);

function load() {
  const base = seed();
  try {
    const raw = localStorage.getItem(KEY) || (SERVER ? null : localStorage.getItem('avenor-demo-v1'));
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch { /* bộ nhớ trình duyệt không khả dụng: dùng dữ liệu mẫu */ }
  return base;
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [toast, setToast] = useState(null);
  const [sync, setSync] = useState('connecting'); // connecting | local | synced | saving | slow | error | full
  const syncRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* bỏ qua */ }
  }, [state]);

  useEffect(() => {
    let alive = true;
    (SERVER ? connectServerSync : connectSync)({
      onRemote: (id, slice) => { if (ids().includes(id)) setState((s) => ({ ...s, [id]: slice })); },
      onReady: (empty) => {
        // Lần đầu dùng trên tài khoản này: đưa dữ liệu hiện có lên máy chủ.
        if (empty) ids().forEach((id) => syncRef.current?.save(id, stateRef.current[id]));
      },
      onStatus: (s) => alive && setSync(s),
    }).then((c) => {
      if (!alive) { c?.stop(); return; }
      syncRef.current = c;
      if (!c) setSync('local');
    });
    return () => { alive = false; syncRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const update = useCallback((id, fn) => {
    setState((s) => {
      const next = typeof fn === 'function' ? fn(s[id]) : fn;
      syncRef.current?.save(id, next);
      return { ...s, [id]: next };
    });
  }, []);
  const replaceAll = useCallback((data, msg) => {
    const next = { ...seed(), ...data };
    ids().forEach((id) => syncRef.current?.save(id, next[id]));
    setState(next);
    if (msg) setToast(msg);
  }, []);
  const reset = useCallback(() => replaceAll(seed(), 'Đã khôi phục dữ liệu mẫu'), [replaceAll]);
  const value = useMemo(() => ({ state, update, reset, replaceAll, sync, notify: setToast }), [state, update, reset, replaceAll, sync]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);

/** Hook cho một module: trả về [dữ liệu, hàm cập nhật]. */
export function useModule(id) {
  const { state, update } = useStore();
  const set = useCallback((fn) => update(id, fn), [id, update]);
  return [state[id], set];
}
export const useNotify = () => useStore().notify;
