import { useState } from 'react';
import { uid } from '../../core/format.js';
import { Card } from '../../ui/common.jsx';
import Icon from '../../ui/Icon.jsx';

// Vlog YouTube và album ảnh (Google Drive, OneDrive, Google Photos…) của một chuyến đi.

export function youtubeId(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (h.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch { /* không phải URL */ }
  return null;
}

const PROVIDERS = [
  [/drive\.google\.com|docs\.google\.com/, 'Google Drive'],
  [/photos\.google\.com|photos\.app\.goo\.gl|goo\.gl\/photos/, 'Google Photos'],
  [/onedrive\.live\.com|1drv\.ms|sharepoint\.com/, 'OneDrive'],
  [/icloud\.com/, 'iCloud'],
  [/dropbox\.com/, 'Dropbox'],
  [/flickr\.com/, 'Flickr'],
  [/facebook\.com|fb\.watch/, 'Facebook'],
];
export const providerOf = (url) => {
  try { const h = new URL(url).hostname; const hit = PROVIDERS.find(([re]) => re.test(h)); return hit ? hit[1] : h.replace(/^www\./, ''); } catch { return 'Liên kết'; }
};

const normUrl = (s) => {
  let x = s.trim();
  if (!x) return null;
  if (!/^https?:\/\//i.test(x)) x = `https://${x}`;
  try { const u = new URL(x); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null; } catch { return null; }
};

function LinkForm({ kind, initial = {}, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ url: initial.url || '', title: initial.title || '' });
  const [bad, setBad] = useState('');
  const [ask, setAsk] = useState(false);
  const isVideo = kind === 'video';
  return (
    <form className="card glow" style={{ display: 'grid', gap: 10, padding: 14 }} onSubmit={(e) => {
      e.preventDefault();
      const url = normUrl(f.url);
      if (!url) return setBad('Link chưa đúng, hãy dán nguyên đường dẫn (bắt đầu bằng https://).');
      if (isVideo && !youtubeId(url)) return setBad('Đây không phải link video YouTube. Hãy mở video, bấm Chia sẻ → Sao chép đường liên kết.');
      onSave({ url, title: f.title.trim() });
    }}>
      <div className="field"><label htmlFor={`lk-url-${kind}`}>{isVideo ? 'Link video YouTube' : 'Link album ảnh'}</label>
        <input id={`lk-url-${kind}`} className="input" inputMode="url" value={f.url} onChange={(e) => { setF({ ...f, url: e.target.value }); setBad(''); }} placeholder={isVideo ? 'https://youtu.be/…' : 'https://drive.google.com/… hoặc https://1drv.ms/…'} required autoFocus />
      </div>
      <div className="field"><label htmlFor={`lk-title-${kind}`}>Tên (không bắt buộc)</label>
        <input id={`lk-title-${kind}`} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={isVideo ? 'Ví dụ: Vlog ngày 1 – Săn mây' : 'Ví dụ: Ảnh gốc cả chuyến'} />
      </div>
      {bad && <div className="row-sub rose">{bad}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn sm" type="submit"><Icon name="check" size={15} />Lưu</button>
        <button className="btn sm ghost" type="button" onClick={onCancel}>Hủy</button>
        {onDelete && <span style={{ marginLeft: 'auto' }}>{ask
          ? <span style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="btn sm" style={{ background: 'var(--rose)' }} onClick={onDelete}>Xóa hẳn</button><button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Không</button></span>
          : <button type="button" className="btn sm ghost" style={{ color: 'var(--rose)' }} onClick={() => setAsk(true)}><Icon name="trash" size={14} />Xóa</button>}</span>}
      </div>
    </form>
  );
}

function VideoCard({ v, onEdit }) {
  const id = youtubeId(v.url);
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ position: 'relative', display: 'block', borderRadius: 14, overflow: 'hidden', background: '#1c1512', aspectRatio: '16 / 9' }} aria-label={`Mở video ${v.title || ''} trên YouTube`}>
        {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 56, height: 40, borderRadius: 12, background: '#ff0033', display: 'grid', placeItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      </a>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-title" style={{ overflowWrap: 'anywhere' }}>{v.title || 'Vlog YouTube'}</div>
          <div className="row-sub">YouTube</div>
        </div>
        <button type="button" className="icon-btn" aria-label="Sửa video" onClick={onEdit} style={{ width: 34, height: 34 }}><Icon name="pen" size={15} /></button>
      </div>
    </div>
  );
}

function PhotoRow({ p, onEdit }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span className="icon-tile lav" style={{ width: 38, height: 38 }}><Icon name="file" size={17} /></span>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="row-main" style={{ minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
        <div className="row-title" style={{ overflowWrap: 'anywhere' }}>{p.title || `Album ảnh trên ${providerOf(p.url)}`}</div>
        <div className="row-sub" style={{ overflowWrap: 'anywhere' }}>{providerOf(p.url)} · bấm để mở</div>
      </a>
      <button type="button" className="icon-btn" aria-label="Sửa link ảnh" onClick={onEdit} style={{ width: 34, height: 34 }}><Icon name="pen" size={15} /></button>
    </div>
  );
}

export function MediaEditor({ trip, update, notify }) {
  const [editing, setEditing] = useState(null); // { kind, id|'new' }
  const videos = trip.videos || [];
  const photos = trip.photoLinks || [];
  const field = (kind) => (kind === 'video' ? 'videos' : 'photoLinks');
  const save = (kind, id, data) => {
    const k = field(kind);
    update((t) => ({ ...t, [k]: id === 'new' ? [...(t[k] || []), { id: uid(), ...data }] : (t[k] || []).map((x) => (x.id === id ? { ...x, ...data } : x)) }));
    setEditing(null);
    notify(kind === 'video' ? 'Đã lưu vlog' : 'Đã lưu link ảnh');
  };
  const remove = (kind, id) => { const k = field(kind); update((t) => ({ ...t, [k]: (t[k] || []).filter((x) => x.id !== id) })); setEditing(null); notify('Đã xóa link'); };
  const is = (kind, id) => editing && editing.kind === kind && editing.id === id;

  return (
    <div className="stack">
      <Card title={`Vlog YouTube${videos.length ? ` (${videos.length})` : ''}`} icon="star" action={!is('video', 'new') && <button className="btn sm" onClick={() => setEditing({ kind: 'video', id: 'new' })}><Icon name="plus" size={15} />Thêm vlog</button>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {is('video', 'new') && <LinkForm kind="video" onCancel={() => setEditing(null)} onSave={(d) => save('video', 'new', d)} />}
          {videos.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
              {videos.map((v) => (is('video', v.id)
                ? <LinkForm key={v.id} kind="video" initial={v} onCancel={() => setEditing(null)} onSave={(d) => save('video', v.id, d)} onDelete={() => remove('video', v.id)} />
                : <VideoCard key={v.id} v={v} onEdit={() => setEditing({ kind: 'video', id: v.id })} />))}
            </div>
          )}
          {!videos.length && !is('video', 'new') && <div className="empty">Chưa có vlog. Bấm “Thêm vlog” rồi dán link YouTube của video.</div>}
        </div>
      </Card>

      <Card title={`Ảnh của chuyến đi${photos.length ? ` (${photos.length})` : ''}`} icon="file" action={!is('photo', 'new') && <button className="btn sm" onClick={() => setEditing({ kind: 'photo', id: 'new' })}><Icon name="plus" size={15} />Thêm link ảnh</button>}>
        <div style={{ display: 'grid', gap: 10 }}>
          {is('photo', 'new') && <LinkForm kind="photo" onCancel={() => setEditing(null)} onSave={(d) => save('photo', 'new', d)} />}
          {photos.length > 0 && (
            <div className="list">
              {photos.map((p) => (is('photo', p.id)
                ? <LinkForm key={p.id} kind="photo" initial={p} onCancel={() => setEditing(null)} onSave={(d) => save('photo', p.id, d)} onDelete={() => remove('photo', p.id)} />
                : <PhotoRow key={p.id} p={p} onEdit={() => setEditing({ kind: 'photo', id: p.id })} />))}
            </div>
          )}
          {!photos.length && !is('photo', 'new') && <div className="empty">Chưa có link ảnh. Trên Google Drive hoặc OneDrive, bấm Chia sẻ → Sao chép liên kết rồi dán vào đây.</div>}
          <div className="row-sub">Mẹo: đặt quyền “Bất kỳ ai có đường liên kết” thì mở được trên mọi máy. Avenor chỉ lưu link, ảnh vẫn nằm ở Drive/OneDrive của bạn.</div>
        </div>
      </Card>
    </div>
  );
}
