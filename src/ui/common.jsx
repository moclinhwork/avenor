import { useId, useRef, useState } from 'react';
import { deletePhoto, uploadPhoto } from '../core/photos.js';
import Icon from './Icon.jsx';

export function PageHead({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </header>
  );
}

export function Card({ title, icon, action, children, className = '', style, glow }) {
  return (
    <section className={`card ${glow ? 'glow' : ''} ${className}`} style={style}>
      {(title || action) && (
        <div className="card-head">
          {title && <h3 className="card-title">{icon && <Icon name={icon} size={18} />}{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ icon, tone = '', label, value, unit, foot, children, onClick }) {
  return (
    <section className="card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span className={`icon-tile ${tone}`}><Icon name={icon} size={19} /></span>
        {children}
      </div>
      <div className="stat-value" style={{ marginTop: 12 }}>{value}{unit && <small>{unit}</small>}</div>
      <div className="stat-label" style={{ marginTop: 2 }}>{label}</div>
      {foot && <div style={{ marginTop: 8 }}>{foot}</div>}
    </section>
  );
}

export function Check({ on, onClick, label }) {
  return (
    <button className={`check ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on && <Icon name="check" size={14} stroke={2.6} />}
    </button>
  );
}

export function Delta({ value, unit = '', good = 'down' }) {
  const isGood = good === 'down' ? value <= 0 : value >= 0;
  return (
    <span className={`chip ${isGood ? 'good' : 'rose'}`}>
      <Icon name={value <= 0 ? 'down' : 'up'} size={12} stroke={2.4} />
      {value > 0 ? '+' : ''}{String(value).replace('.', ',')}{unit}
    </span>
  );
}

/* ---------- Ảnh minh họa phong cảnh (SVG), thay cho ảnh chụp ---------- */
const SKIES = {
  dawn: ['#1b2f3a', '#3f6a6d', '#9cc7b6'],
  night: ['#0b0f2a', '#2a1f4f', '#7b4a6e'],
  day: ['#143247', '#2f7f9e', '#8fd3d6'],
  dusk: ['#1c1633', '#5a3a5e', '#e09a6e'],
  polar: ['#04101c', '#0b3b4a', '#1b6a6a'],
};

export function Scene({ kind = 'mountain', sky = 'dawn', height = 160, children, radius }) {
  const id = useId().replace(/:/g, '');
  const [s0, s1, s2] = SKIES[sky] || SKIES.dawn;
  return (
    <div className="cover" style={{ height, borderRadius: radius }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <defs>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s0} /><stop offset="0.6" stopColor={s1} /><stop offset="1" stopColor={s2} />
          </linearGradient>
          <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s2} stopOpacity="0.55" /><stop offset="1" stopColor={s0} />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill={`url(#s${id})`} />
        {kind === 'mountain' && (<>
          <circle cx="250" cy="92" r="18" fill="#f6e7c8" opacity="0.45" />
          <path d="M0 120 60 70 110 105 170 55 240 110 300 72 360 100 400 80V200H0Z" fill="#2c4a4a" opacity="0.7" />
          <path d="M0 140 50 112 100 132 160 98 220 135 290 105 350 130 400 115V200H0Z" fill="#1b3433" />
          <rect y="128" width="400" height="18" fill="#cfe8e0" opacity="0.12" />
          {Array.from({ length: 22 }, (_, i) => { const x = i * 19 + 4; const h = 18 + ((i * 37) % 17); return <path key={i} d={`M${x} ${172 - h} ${x - 7} 172h14Z`} fill="#0f2422" />; })}
          <path d="M0 168h400v32H0Z" fill={`url(#w${id})`} />
        </>)}
        {kind === 'karst' && (<>
          <path d="M0 140C20 60 45 60 55 140M70 140c10-90 40-90 50 0M150 140c15-70 40-70 52 0M230 140c12-100 45-100 55 0M310 140c10-75 38-75 48 0M350 140c12-55 40-55 50 0" fill="#204038" />
          <path d="M-10 150c25-60 50-60 60 0M90 150c20-50 45-50 60 0M190 150c15-75 45-75 55 0M270 150c20-55 45-55 60 0" fill="#173029" />
          <rect y="148" width="400" height="52" fill={`url(#w${id})`} />
          <path d="M150 168h50l-6 6h-38Z" fill="#c4553e" /><path d="M172 150v18" stroke="#e8d5a3" strokeWidth="1.5" />
        </>)}
        {kind === 'lantern' && (<>
          <path d="M0 112h400v60H0Z" fill="#241a2a" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 46 - 4} 112 l23 -22 23 22Z`} fill="#3a2433" />)}
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 46 + 6} y="124" width="12" height="16" fill="#ffcc7a" opacity="0.75" />)}
          {Array.from({ length: 14 }, (_, i) => <ellipse key={i} cx={i * 30 + 12} cy={84 + (i % 3) * 7} rx="6.5" ry="8" fill={['#ff9a4d', '#ffd166', '#ff6b6b'][i % 3]} style={{ filter: 'drop-shadow(0 0 6px #ffb36b)' }} />)}
          <rect y="172" width="400" height="28" fill="#120d1c" />
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 46 + 8} y={176 + (i % 2) * 6} width="8" height="18" fill="#ffcc7a" opacity="0.25" />)}
        </>)}
        {kind === 'sea' && (<>
          <circle cx="150" cy="112" r="18" fill="#fff4d6" opacity="0.55" />
          {[260, 285, 305, 330, 352].map((x, i) => <rect key={x} x={x} y={70 + (i % 3) * 12} width="18" height={70 - (i % 3) * 12} fill="#2a4b63" />)}
          <path d="M0 140h400v60H0Z" fill="#1f6f8b" />
          <path d="M0 150c40-8 80 8 120 0s80 8 120 0 80 8 160 0v50H0Z" fill="#2c8aa6" opacity="0.7" />
          <path d="M0 176c60-10 140 6 220 0s120-6 180 0v24H0Z" fill="#e7d5a8" />
        </>)}
        {kind === 'temple' && (<>
          <path d="M90 120h220v40H90Z" fill="#3b2a24" />
          <path d="M70 122 200 78 330 122Z" fill="#5a2f25" />
          <path d="M140 92 200 62 260 92Z" fill="#6d3528" />
          <path d="M175 70 200 48 225 70Z" fill="#7d3c2b" />
          {[120, 160, 200, 240, 280].map((x) => <rect key={x} x={x - 6} y="130" width="12" height="30" fill="#e2b46a" opacity="0.65" />)}
          <path d="M0 160h400v40H0Z" fill="#1f2c22" />
          {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={i * 44 + 10} cy={156} r="14" fill="#1a3a2a" />)}
        </>)}
        {kind === 'aurora' && (<>
          <path d="M0 70c80-40 160 30 240-10s120-20 160 0" stroke="#5ef2c4" strokeWidth="26" fill="none" opacity="0.35" style={{ filter: 'blur(6px)' }} />
          <path d="M0 95c90-30 170 20 260-15s100-10 140 5" stroke="#b59cff" strokeWidth="16" fill="none" opacity="0.3" style={{ filter: 'blur(6px)' }} />
          {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 53) % 400} cy={(i * 29) % 70} r="1" fill="#fff" opacity="0.6" />)}
          <path d="M0 150 70 110 130 140 210 95 280 138 350 112 400 130V200H0Z" fill="#dfe9ef" opacity="0.85" />
          <path d="M0 170 80 145 160 165 260 140 340 160 400 150V200H0Z" fill="#0d1a24" />
        </>)}
        {kind === 'fuji' && (<>
          <path d="M80 160 200 60 320 160Z" fill="#3c4f73" />
          <path d="M170 85 200 60 230 85 215 92 200 84 185 93Z" fill="#f4f6fb" />
          <path d="M0 160h400v40H0Z" fill="#1b2a2a" />
          {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={20 + i * 52} cy={150} r="16" fill="#f3a6c4" opacity="0.75" />)}
        </>)}
        {kind === 'ruins' && (<>
          <path d="M100 160V90a100 60 0 0 1 200 0v70Z" fill="#a8775a" />
          {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => <rect key={`${r}${c}`} x={112 + c * 30} y={98 + r * 16} width="14" height="10" rx="5" fill="#3a241c" />))}
          <path d="M0 160h400v40H0Z" fill="#3f4a2a" />
        </>)}
      </svg>
      <div className="cover-shade" />
      {children && <div className="cover-body" style={{ height: '100%' }}>{children}</div>}
    </div>
  );
}

/* ---------- Bìa sách cách điệu ---------- */
export function BookCover({ book, width = 84 }) {
  const [bg, fg] = book.colors || ['#2b3a55', '#f1e6d0'];
  return (
    <div className="book" style={{ width, background: bg, color: fg, flexShrink: 0 }}>
      <b style={{ fontSize: Math.max(8, width / 6.2), overflowWrap: 'anywhere' }}>{book.title}</b>
      {width >= 60 && <span>{book.author}</span>}
    </div>
  );
}

/* ---------- Ảnh bìa: ảnh người dùng tải lên, nếu không có thì dùng tranh minh họa ---------- */
export function Cover({ photo, kind, sky, height = 160, radius, children }) {
  if (!photo?.url) return <Scene kind={kind} sky={sky} height={height} radius={radius}>{children}</Scene>;
  return (
    <div className="cover" style={{ height, borderRadius: radius }}>
      <img src={photo.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none' }} />
      <div className="cover-shade" />
      {children && <div className="cover-body" style={{ height: '100%' }}>{children}</div>}
    </div>
  );
}

/** Chọn ảnh từ máy tính hoặc điện thoại; gọi onChange(photo | null). */
export function PhotoPicker({ id, photo, onChange, kind, sky }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const next = await uploadPhoto(f);
      if (photo?.id && photo.id !== next.id) deletePhoto(photo);
      onChange(next);
    } catch (x) {
      setErr(x?.message === 'not_image' ? 'Hãy chọn một file ảnh (JPG, PNG, HEIC…).' : x?.code === 'quota_exceeded' ? 'Kho ảnh đã đầy, hãy xóa bớt ảnh cũ.' : 'Không tải được ảnh, thử lại nhé.');
    }
    setBusy(false);
  };
  return (
    <div className="field">
      <label htmlFor={id}>Ảnh</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 96, flexShrink: 0 }}><Cover photo={photo} kind={kind} sky={sky} height={64} radius={10} /></div>
        <button type="button" className="btn sm ghost" disabled={busy} onClick={() => ref.current?.click()}><Icon name="plus" size={14} />{busy ? 'Đang tải ảnh…' : photo?.url ? 'Đổi ảnh' : 'Tải ảnh lên'}</button>
        {photo?.url && !busy && <button type="button" className="btn sm ghost" onClick={() => { deletePhoto(photo); onChange(null); }}>Bỏ ảnh</button>}
        <input ref={ref} id={id} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      {err ? <span className="rose" style={{ fontSize: 12 }}>{err}</span> : !photo?.url && <span className="faint" style={{ fontSize: 12 }}>Chưa có ảnh thì app dùng tranh minh họa bên dưới.</span>}
    </div>
  );
}
