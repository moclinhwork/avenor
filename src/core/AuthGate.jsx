import { createContext, useContext, useEffect, useState } from 'react';
import { api, SERVER } from './platform.js';
import { Logo } from '../ui/Icon.jsx';

// Chỉ dùng ở bản VPS: bắt đăng nhập trước khi mở app.
const Ctx = createContext(null);
export const useAccount = () => useContext(Ctx);

const ERR = {
  bad_login: 'Sai tên đăng nhập hoặc mật khẩu.',
  too_many: 'Bạn nhập sai quá nhiều lần. Thử lại sau 15 phút.',
  taken: 'Tên đăng nhập này đã có người dùng.',
  bad_username: 'Tên đăng nhập 3–40 ký tự, chỉ gồm chữ, số và . _ @ -',
  weak_password: 'Mật khẩu cần ít nhất 8 ký tự.',
  signup_closed: 'Máy chủ này không mở đăng ký tài khoản mới.',
};

export function logoutCleanup() {
  try { localStorage.removeItem('avenor-vps-data-v1'); } catch { /* bỏ qua */ }
}

export default function AuthGate({ children }) {
  const [me, setMe] = useState(SERVER ? null : { user: null });
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', password2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/api/me').then((r) => { setMe(r); setMode(r.canSignup && !r.user ? 'signup' : 'login'); setFailed(false); }, () => setFailed(true));
  useEffect(() => { if (SERVER) load(); }, []);

  if (!SERVER) return children;
  if (me?.user) return <Ctx.Provider value={{ ...me, logout: async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); logoutCleanup(); location.reload(); } }}>{children}</Ctx.Provider>;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (mode === 'signup' && form.password !== form.password2) return setErr('Hai lần nhập mật khẩu không khớp.');
    setBusy(true);
    try {
      await api(mode === 'signup' ? '/api/signup' : '/api/login', { method: 'POST', body: { username: form.username, password: form.password } });
      logoutCleanup();
      await load();
    } catch (x) { setErr(ERR[x.code] || 'Không kết nối được máy chủ, thử lại sau.'); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <form className="card glow auth-card" onSubmit={submit}>
        <div className="brand" style={{ fontSize: 22 }}><Logo size={30} />Avenor</div>
        {failed ? (
          <>
            <p className="muted">Không kết nối được máy chủ Avenor.</p>
            <button className="btn block" type="button" onClick={load}>Thử lại</button>
          </>
        ) : !me ? <p className="muted">Đang tải…</p> : (
          <>
            <div>
              <h1 style={{ fontSize: 22, margin: '6px 0 4px' }}>{mode === 'signup' ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
              <p className="muted" style={{ fontSize: 13.5 }}>{mode === 'signup' ? (me.canSignup && !me.user ? 'Tài khoản đầu tiên sẽ là chủ của máy chủ này.' : '') : 'Dữ liệu của bạn được lưu trên máy chủ riêng và đồng bộ giữa các thiết bị.'}</p>
            </div>
            <div className="field"><label htmlFor="a-user">Tên đăng nhập</label><input id="a-user" className="input" autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
            <div className="field"><label htmlFor="a-pass">Mật khẩu</label><input id="a-pass" className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            {mode === 'signup' && <div className="field"><label htmlFor="a-pass2">Nhập lại mật khẩu</label><input id="a-pass2" className="input" type="password" autoComplete="new-password" value={form.password2} onChange={(e) => setForm({ ...form, password2: e.target.value })} required /></div>}
            {err && <div className="chip rose" style={{ justifySelf: 'start', whiteSpace: 'normal' }}>{err}</div>}
            <button className="btn block" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'signup' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
            {me.canSignup && (
              <button type="button" className="btn ghost block" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(''); }}>
                {mode === 'signup' ? 'Đã có tài khoản? Đăng nhập' : 'Tạo tài khoản mới'}
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
