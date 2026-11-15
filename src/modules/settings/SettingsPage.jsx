import { useRef, useState } from 'react';
import { useStore } from '../../core/store.jsx';
import { todayIso } from '../../core/format.js';
import { Card, PageHead } from '../../ui/common.jsx';
import Icon from '../../ui/Icon.jsx';
import { MODULES } from '../registry.js';
import { api, SERVER } from '../../core/platform.js';
import { useAccount } from '../../core/AuthGate.jsx';

function AccountCard({ notify }) {
  const acc = useAccount();
  const [pw, setPw] = useState(null);
  if (!acc?.user) return null;
  const change = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return notify('Mật khẩu mới cần ít nhất 8 ký tự');
    try { await api('/api/password', { method: 'POST', body: pw }); setPw(null); notify('Đã đổi mật khẩu'); }
    catch (x) { notify(x.code === 'bad_login' ? 'Mật khẩu hiện tại không đúng' : 'Không đổi được mật khẩu'); }
  };
  return (
    <Card title="Tài khoản" icon="users">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div><div className="muted" style={{ fontSize: 12.5 }}>Đang đăng nhập</div><b>{acc.user.username}</b></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => setPw(pw ? null : { current: '', next: '' })}>Đổi mật khẩu</button>
          <button className="btn ghost" onClick={acc.logout}>Đăng xuất</button>
        </div>
      </div>
      {pw && (
        <form onSubmit={change} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div className="field"><label htmlFor="pw-cur">Mật khẩu hiện tại</label><input id="pw-cur" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw-new">Mật khẩu mới</label><input id="pw-new" className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <button className="btn" type="submit">Lưu mật khẩu</button>
        </form>
      )}
    </Card>
  );
}

export const SYNC_TEXT = {
  connecting: ['Đang kết nối…', ''],
  synced: ['Đã đồng bộ', 'mint'],
  saving: ['Đang lưu…', 'lav'],
  slow: ['Chưa kết nối được máy chủ', 'amber'],
  error: ['Lỗi đồng bộ, dữ liệu vẫn lưu trên máy này', 'rose'],
  full: ['Kho dữ liệu đã đầy', 'rose'],
  local: ['Chỉ lưu trên trình duyệt này', 'amber'],
};

export default function SettingsPage() {
  const { state, sync, reset, replaceAll, notify } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const applyTheme = (t) => {
    if (t === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('avenor-theme', t); } catch { /* bỏ qua */ }
    setTheme(t);
  };
  const [backup, setBackup] = useState('');
  const fileRef = useRef(null);
  const [label, tone] = SYNC_TEXT[sync] || SYNC_TEXT.connecting;
  const json = () => JSON.stringify({ app: 'avenor', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);

  const exportFile = async () => {
    const text = json();
    if (SERVER) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `avenor-sao-luu-${todayIso}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      notify('Đã tải file sao lưu');
      return;
    }
    try {
      const dl = window.claude?.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: `avenor-sao-luu-${todayIso}.json`, data: text }); notify('Đã tạo file sao lưu'); return; }
    } catch (e) { if (e?.code === 'not_granted' || e?.code === 'dismissed') return; }
    setBackup(text);
  };
  const importFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed?.app !== 'avenor' || typeof parsed.data !== 'object') throw new Error('bad');
      replaceAll(parsed.data, 'Đã khôi phục từ file sao lưu');
    } catch { notify('File không phải bản sao lưu Avenor hợp lệ'); }
  };

  return (
    <div className="fade-in">
      <PageHead title="Cài đặt & dữ liệu" subtitle="Đồng bộ, sao lưu và khôi phục dữ liệu của bạn." />
      <div className="grid g-main">
        <div className="stack">
          {SERVER && <AccountCard notify={notify} />}
          <Card title="Giao diện" icon="sparkle" glow>
            <div className="tabs" style={{ margin: 0, maxWidth: 360 }}>
              {[['light', 'Sáng'], ['dark', 'Tối']].map(([k, l]) => <button key={k} className={`tab ${theme === k ? 'active' : ''}`} aria-pressed={theme === k} onClick={() => applyTheme(k)}>{l}</button>)}
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>Lựa chọn được nhớ riêng trên từng thiết bị.</p>
          </Card>
          <Card title="Đồng bộ" icon="refresh">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`chip ${tone}`}>{label}</span>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
              {SERVER ? 'Dữ liệu lưu trên máy chủ riêng của bạn (avenor.moclinh.vn) theo tài khoản. Đăng nhập trên điện thoại hay máy tính đều thấy cùng dữ liệu; các thiết bị khác tự cập nhật sau khoảng 20 giây.' : sync === 'local'
                ? 'Bạn đang mở app ngoài Claude (hoặc chưa đăng nhập), nên dữ liệu chỉ nằm trong trình duyệt này. Mở app qua đường link trên Claude để đồng bộ giữa các thiết bị.'
                  : 'Dữ liệu lưu riêng cho tài khoản của bạn: chỉ bạn xem được, kể cả khi bạn chia sẻ đường link app cho người khác. Mở app trên điện thoại hay máy tính đều thấy cùng dữ liệu.'}
            </p>
          </Card>
          <Card title="Sao lưu" icon="file">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Tải toàn bộ dữ liệu của {MODULES.filter((m) => m.initial).length} module về một file JSON, hoặc khôi phục từ file đã lưu.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportFile}><Icon name="down" size={17} />Tải file sao lưu</button>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="up" size={17} />Khôi phục từ file</button>
              <input ref={fileRef} id="import-file" type="file" accept="application/json,.json" hidden onChange={importFile} />
            </div>
            {backup && (
              <div style={{ marginTop: 12 }}>
                <div className="field"><label htmlFor="backup-text">Không tải file được ở đây. Sao chép nội dung này và lưu thành file .json:</label>
                  <textarea id="backup-text" className="input" rows={6} readOnly value={backup} onFocus={(e) => e.target.select()} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} /></div>
                <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(backup).then(() => notify('Đã sao chép'), () => notify('Hãy chọn và sao chép thủ công'))}>Sao chép</button>
              </div>
            )}
          </Card>
        </div>
        <Card title="Dữ liệu mẫu" icon="sparkle">
          <p className="muted" style={{ fontSize: 13 }}>Đưa toàn bộ app về dữ liệu mẫu ban đầu. Mọi thay đổi của bạn sẽ bị thay thế, trên mọi thiết bị.</p>
          {!confirm ? (
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setConfirm(true)}><Icon name="refresh" size={16} />Khôi phục dữ liệu mẫu</button>
          ) : (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <span className="chip rose" style={{ justifySelf: 'start' }}>Thao tác này không hoàn tác được</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ background: 'var(--rose)' }} onClick={() => { reset(); setConfirm(false); }}>Thay bằng dữ liệu mẫu</button>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Hủy</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
