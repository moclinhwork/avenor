import { useEffect, useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { kindOf, monogram, statusOf } from './data.js';
import { useHiddenSignal } from './pin.js';

const AV_TONES = { email: 'sky', social: 'lav', channel: 'rose', bank: 'good', other: '' };
export function Av({ d, a, size = 40 }) {
  const k = kindOf(d, a);
  return <span className={`ac-av ${AV_TONES[k]}`} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{monogram(d, a)}</span>;
}

export function StatusChip({ status, white }) {
  const s = statusOf(status);
  return <span className={`chip ${s.tone}`} style={white ? { background: 'var(--surface)' } : undefined}>{s.id === 'active' ? '● ' : ''}{s.label}</span>;
}

export function TagChip({ tag, onRemove }) {
  if (!tag) return null;
  return (
    <span className={`ac-tag ${tag.color || 'rust'}`}>{tag.name}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove tag ${tag.name}`}><Icon name="close" size={14} /></button>}
    </span>
  );
}

export function TopBar({ onBack, backLabel = 'Back', children }) {
  return (
    <div className="ac-top">
      {onBack ? <button className="bare-btn" onClick={onBack} aria-label={backLabel}><Icon name="back" size={22} /></button> : <span />}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

/* ---------- Sao chép: xóa clipboard sau 60 giây nếu vẫn còn đúng giá trị đó ---------- */
export async function copyText(text, notify, what = 'Copied') {
  const v = String(text || '');
  try { await navigator.clipboard.writeText(v); }
  catch {
    const t = document.createElement('textarea'); t.value = v; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* bỏ qua */ } t.remove();
  }
  notify?.(`${what}. Clipboard clears in 60 s.`);
  setTimeout(async () => {
    try { if ((await navigator.clipboard.readText()) === v) await navigator.clipboard.writeText(''); } catch { /* trình duyệt không cho đọc clipboard */ }
  }, 60000);
}

/** Giá trị nhạy cảm: che mặc định, Reveal 30 giây, tự che khi app chuyển nền. */
export function Secret({ value, mask, notify, copyLabel = 'Copied', big }) {
  const [shown, setShown] = useState(false);
  const hidden = useHiddenSignal();
  const timer = useRef(null);
  useEffect(() => { setShown(false); }, [hidden]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = () => {
    clearTimeout(timer.current);
    if (shown) { setShown(false); return; }
    setShown(true); timer.current = setTimeout(() => setShown(false), 30000);
  };
  if (!value) return <span className="muted">Not set</span>;
  return (
    <span className="ac-secret">
      <span className={big ? 'ac-bignum num' : 'ac-val num'}>{shown ? value : mask(value)}</span>
      <span style={{ display: 'flex', flex: 'none' }}>
        <button type="button" className="ac-mini" onClick={toggle} aria-label={shown ? 'Hide' : 'Reveal'}><Icon name={shown ? 'eyeOff' : 'eye'} size={19} /></button>
        <button type="button" className="ac-mini" onClick={() => copyText(value, notify, copyLabel)} aria-label="Copy"><Icon name="copy" size={19} /></button>
      </span>
    </span>
  );
}

export function Sheet({ title, sub, onClose, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet ac-sheet" role="dialog" aria-label={title}>
        <div className="sheet-grip" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <div><h3 style={{ fontSize: 20, fontWeight: 800 }}>{title}</h3>{sub && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{sub}</div>}</div>
          <button className="bare-btn" style={{ margin: '-6px -8px 0 0' }} onClick={onClose} aria-label="Close"><Icon name="close" size={22} /></button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Chips({ options, value, onChange, multi }) {
  const on = (id) => (multi ? value.includes(id) : value === id);
  const click = (id) => (multi ? onChange(on(id) ? value.filter((x) => x !== id) : [...value, id]) : onChange(on(id) ? '' : id));
  return (
    <div className="ac-chips">
      {options.map((o) => <button type="button" key={o.id} className={`ac-chip ${on(o.id) ? 'on' : ''}`} aria-pressed={on(o.id)} onClick={() => click(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function Keypad({ onDigit, onDelete, left }) {
  return (
    <div className="ac-keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button type="button" key={n} onClick={() => onDigit(String(n))}>{n}</button>)}
      {left || <span />}
      <button type="button" onClick={() => onDigit('0')}>0</button>
      <button type="button" className="ghost" onClick={onDelete} aria-label="Delete digit"><Icon name="back" size={24} /></button>
    </div>
  );
}
export const Dots = ({ n }) => (
  <div className="ac-dots" role="img" aria-label={`${n} of 6 digits entered`}>{Array.from({ length: 6 }, (_, i) => <span key={i} className={i < n ? 'on' : ''} />)}</div>
);
