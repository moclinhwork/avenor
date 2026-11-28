import { useEffect, useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { ago, delta, fmtDelta, fmtStamp, isoDm } from './metrics.js';

export const TYPE_LABEL = { sales: 'Sales', google_ads: 'Google Ads', meta_ads: 'Meta Ads', ga4: 'Website · GA4', youtube: 'YouTube', tiktok: 'TikTok' };
export const TYPE_ICON = { sales: 'bag', google_ads: 'search', meta_ads: 'users', ga4: 'chart', youtube: 'video', tiktok: 'play' };
export const STATUS = {
  not_connected: ['Not connected', ''], connected: ['Connected', 'good'], syncing: ['Syncing', 'lav'], needs_auth: ['Needs authorization', 'amber'], error: ['Error', 'rose'],
};

export function StatusChip({ status }) {
  const [label, tone] = STATUS[status] || STATUS.not_connected;
  return <span className={`chip ${tone}`}>{status === 'syncing' && <Icon name="refresh" size={12} />}{label}</span>;
}

/** Thẻ số liệu (lưới hai cột). dl = delta(cur, prev). good: 'up' | 'down' | null (không tô màu). */
export function Kpi({ label, value, sub, dl, kind = 'int', cur, good = 'up', dim, badge, onClick, prevLabel }) {
  const txt = fmtDelta(dl, kind, cur);
  const tone = !dl || dl.kind === 'same' || !good ? '' : (dl.abs > 0) === (good === 'up') ? 'good' : 'rose';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`bz-kpi ${dim ? 'dim' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="bz-kpi-label">{label}{badge && <span className="chip" style={{ marginLeft: 6 }}>{badge}</span>}</span>
      <b className="bz-kpi-value">{value}</b>
      {txt ? <span className={`bz-delta ${tone}`} title={prevLabel ? `vs ${prevLabel}` : undefined}>{dl.abs > 0 && <Icon name="up" size={11} stroke={2.6} />}{dl.abs < 0 && <Icon name="down" size={11} stroke={2.6} />}{txt}</span> : sub ? null : <span className="bz-delta faint">{dim ? '' : '—'}</span>}
      {sub && <span className="bz-kpi-sub">{sub}</span>}
      {onClick && <Icon name="chevR" size={14} />}
    </Tag>
  );
}
export const kpiDelta = (a, b) => delta(a, b);

/** Nguồn + thời điểm cập nhật của một khối dữ liệu. */
export function Source({ conn, fetchedAt, note, stale }) {
  if (!conn) return null;
  const t = fetchedAt || conn.lastOk;
  const old = stale || conn.status === 'error' || conn.status === 'needs_auth';
  return (
    <div className={`bz-src ${old ? 'old' : ''}`}>
      <Icon name={TYPE_ICON[conn.type] || 'link'} size={12} />
      <span>{conn.name}{conn.accountName && conn.accountName !== conn.name ? ` · ${conn.accountName}` : ''}</span>
      <span>· Updated {ago(t)}</span>
      {old && <span className="rose">· {conn.status === 'needs_auth' ? 'needs authorization, showing last saved data' : conn.status === 'error' ? `sync failed, showing data from ${fmtStamp(t)}` : 'data may be old'}</span>}
      {note && <span>· {note}</span>}
    </div>
  );
}

export function StateBox({ kind, title, text, action, onAction }) {
  if (kind === 'loading') return <div className="bz-state" aria-busy="true"><div className="bz-skel" /><div className="bz-skel short" /></div>;
  const icon = kind === 'error' ? 'alert' : kind === 'disconnected' ? 'link' : 'inbox';
  return (
    <div className={`bz-state ${kind}`}>
      <span className={`icon-tile ${kind === 'error' ? 'rose' : ''}`}><Icon name={icon} size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {text && <p>{text}</p>}
        {action && <button className="btn sm" style={{ marginTop: 8 }} onClick={onAction}>{action}</button>}
      </div>
    </div>
  );
}

export function NotConnected({ type, go }) {
  return <StateBox kind="disconnected" title={`${TYPE_LABEL[type] || 'Source'}: Not connected`} text="Connect this source in Business settings to see real data here." action="Open Connections" onAction={() => go({ v: 'connections', add: type })} />;
}

export function PeriodBar({ p, set }) {
  const opts = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom']];
  return (
    <div className="bz-period">
      <div className="tabs seg" role="tablist" aria-label="Period" style={{ marginBottom: 0 }}>
        {opts.map(([k, l]) => <button key={k} role="tab" aria-selected={p.key === k} className={`tab ${p.key === k ? 'active' : ''}`} onClick={() => set(k === 'custom' ? { p: k, from: p.from, to: p.to } : { p: k })}>{l}</button>)}
      </div>
      {p.key === 'custom' && (
        <div className="bz-range">
          <input className="input" type="date" aria-label="From" value={p.from} max={p.to} onChange={(e) => e.target.value && set({ p: 'custom', from: e.target.value, to: p.to })} />
          <span className="faint">–</span>
          <input className="input" type="date" aria-label="To" value={p.to} min={p.from} onChange={(e) => e.target.value && set({ p: 'custom', from: p.from, to: e.target.value })} />
        </div>
      )}
      <div className="bz-cmp faint">{p.key === 'custom' ? p.label : `${isoDm(p.from)}${p.from !== p.to ? ` – ${isoDm(p.to)}` : ''}`} · compared with {p.prevLabel}{p.prev.cut ? ` until ${p.prev.cut}` : ''}</div>
    </div>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="tabs seg" role="tablist" aria-label={label} style={{ marginBottom: 0 }}>
      {options.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={`tab ${value === k ? 'active' : ''}`} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/** Biểu đồ cột theo ngày, toàn chiều rộng, nhãn trục thưa theo độ rộng, chạm để xem giá trị. pts: [{d, v}] (v null = chưa có số liệu). */
export function DayBars({ pts, format, color = 'var(--mint)', height = 170, highlight }) {
  const ref = useRef(null);
  const [W, setW] = useState(320);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e.contentRect.width); if (v > 0) setW(v); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(null), [pts]);
  if (!pts.length) return null;
  const H = height, L = 4, R = 4, T = 22, B = 22;
  const max = Math.max(0, ...pts.map((p) => p.v || 0));
  const band = (W - L - R) / pts.length;
  const bw = Math.max(2, Math.min(28, band * 0.66));
  const y = (v) => T + (1 - (max ? v / max : 0)) * (H - T - B);
  const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(W / 46))));
  const s = sel != null ? pts[sel] : null;
  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Daily chart">
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--grid)" />
        {max > 0 && <text x={L} y={12} style={{ fontSize: 11 }}>max {format(max)}</text>}
        {pts.map((p, i) => {
          const cx = L + band * i + band / 2;
          const on = sel === i || (sel == null && highlight === p.d);
          return (
            <g key={p.d} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={cx - band / 2} y={T} width={band} height={H - T - B} fill="transparent" />
              {p.v == null ? <rect x={cx - bw / 2} y={H - B - 3} width={bw} height={3} rx="1.5" fill="var(--track)" />
                : <rect x={cx - bw / 2} y={y(p.v)} width={bw} height={Math.max(p.v > 0 ? 2 : 0, H - B - y(p.v))} rx={Math.min(4, bw / 3)} fill={color} opacity={sel == null || on ? 1 : 0.4} />}
              {(i % every === 0 || i === pts.length - 1) && (i === pts.length - 1 || pts.length - 1 - i >= every * 0.6) && <text x={cx} y={H - 6} textAnchor="middle">{isoDm(p.d)}</text>}
            </g>
          );
        })}
      </svg>
      {s && <div className="bz-tip" style={{ left: Math.min(Math.max(8, L + band * sel + band / 2 - 60), W - 128) }}>{isoDm(s.d)}: <b>{s.v == null ? 'not available yet' : format(s.v)}</b></div>}
    </div>
  );
}

export function Section({ title, right, children, id }) {
  return (
    <section className="card bz-card" id={id}>
      {(title || right) && <div className="bz-card-head"><h3>{title}</h3>{right}</div>}
      {children}
    </section>
  );
}

export function Confirm({ text, yes = 'Confirm', onYes, onNo, danger }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onNo} />
      <div className="sheet" role="dialog" aria-label={text}>
        <div className="sheet-grip" />
        <p style={{ fontWeight: 600, marginBottom: 14 }}>{text}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onNo}>Cancel</button>
          <button className={`btn ${danger ? 'danger-solid' : ''}`} onClick={onYes}>{yes}</button>
        </div>
      </div>
    </>
  );
}
