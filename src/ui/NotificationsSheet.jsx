import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, testPush } from '../core/notifications.js';
import Icon from './Icon.jsx';

const when = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

const PUSH_TEXT = {
  on: 'Thiết bị này đang nhận thông báo kể cả khi đã tắt Avenor.',
  off: 'Bật để thiết bị này báo ngay khi có đơn mới, kể cả khi đã tắt Avenor.',
  denied: 'Trình duyệt đang chặn thông báo của Avenor. Mở cài đặt trang (biểu tượng ổ khóa cạnh địa chỉ) để cho phép.',
  unsupported: 'Trình duyệt này không hỗ trợ thông báo đẩy. Trên điện thoại, hãy mở avenor.moclinh.vn bằng Chrome (Android) hoặc thêm vào Màn hình chính (iPhone).',
};

export default function NotificationsSheet({ data, onClose }) {
  const { items, unread, markRead } = data;
  const [push, setPush] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { pushState().then(setPush, () => setPush('unsupported')); }, []);

  const toggle = async () => {
    setBusy(true); setMsg('');
    try { setPush(push === 'on' ? await disablePush() : await enablePush()); } catch (e) { setMsg(`Chưa bật được: ${e.message}`); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg('');
    try { const r = await testPush(); setMsg(`Đã gửi thử tới ${r.devices} thiết bị.`); } catch { setMsg('Gửi thử không thành công.'); }
    setBusy(false);
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet nt-sheet" role="dialog" aria-label="Thông báo">
        <div className="sheet-grip" />
        <div className="nt-head">
          <h3 style={{ fontSize: 17 }}>Thông báo</h3>
          {unread > 0 && <button className="btn ghost sm" onClick={() => markRead(null)}>Đánh dấu đã đọc hết</button>}
          <button className="bare-btn" onClick={onClose} aria-label="Đóng"><Icon name="close" size={20} /></button>
        </div>

        {push && (
          <div className="nt-push">
            <Icon name="bell" size={18} />
            <div style={{ flex: 1 }}>
              <div>{PUSH_TEXT[push]}</div>
              {msg && <div className="muted" style={{ marginTop: 4 }}>{msg}</div>}
            </div>
            {(push === 'on' || push === 'off') && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {push === 'on' && <button className="btn ghost sm" disabled={busy} onClick={test}>Gửi thử</button>}
                <button className={`btn sm ${push === 'on' ? 'ghost' : ''}`} disabled={busy} onClick={toggle}>{push === 'on' ? 'Tắt' : 'Bật thông báo'}</button>
              </div>
            )}
          </div>
        )}

        <div className="nt-list">
          {items.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>Chưa có thông báo nào. Đơn tranh mới từ trucchi.moclinh.vn sẽ hiện ở đây.</p>}
          {items.map((n) => (
            <article key={n.id} className={`nt-item ${n.read ? '' : 'unread'}`} onClick={() => !n.read && markRead([n.id])}>
              <div className="nt-title">
                <Icon name="bag" size={16} />
                <strong>{n.title}</strong>
                <span className="muted nt-time">{when(n.created)}</span>
              </div>
              {n.data?.hoTen ? (
                <div className="nt-body">
                  <div><b>{n.data.hoTen}</b> · <a href={`tel:${n.data.soDienThoai.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>{n.data.soDienThoai}</a></div>
                  {n.data.luaChon?.length > 0 && <div className="nt-chips">{n.data.luaChon.map((c, i) => <span key={i} className="chip">{c.nhom}: {c.ten}</span>)}</div>}
                  {n.data.ghiChu && <div className="muted">“{n.data.ghiChu}”</div>}
                </div>
              ) : <div className="nt-body" style={{ whiteSpace: 'pre-line' }}>{n.body}</div>}
              {n.url && <a className="nt-link" href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Mở trang quản trị đơn <Icon name="external" size={14} /></a>}
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
