import { useEffect, useId, useRef, useState } from 'react';

// Đo chiều rộng thật của khung chứa để chữ trên biểu đồ luôn giữ kích thước 11px.
function useWidth(fallback = 560) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e.contentRect.width); if (v > 0) setW(v); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Các biểu đồ SVG nhẹ, không phụ thuộc thư viện. Tất cả co giãn theo chiều rộng thẻ.

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  if (Number.isInteger(min) && Number.isInteger(max)) step = Math.max(1, Math.round(step));
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function LineChart({ data, height = 190, color = 'var(--mint)', format = (v) => v, yFormat, goal, showDots = true, minPad = 0.4, data2, color2 = 'var(--lav)', refs = [] }) {
  const id = useId().replace(/:/g, '');
  const [ref, W] = useWidth();
  const H = height, L = 40, R = 14, T = 16, B = 26;
  const vals = [...data.map((d) => d.value), ...(data2 || []), ...refs.map((r) => r.value)];
  const lo = Math.min(...vals, goal ?? Infinity) - minPad;
  const hi = Math.max(...vals, goal ?? -Infinity) + minPad;
  const ticks = niceTicks(lo, hi, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${H - B} L${L},${H - B} Z`;
  const pts2 = data2 ? data2.map((v, i) => [x(i), y(v)]) : null;
  const line2 = pts2 ? pts2.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') : '';
  const last = pts[pts.length - 1];
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 80)));
  const yf = yFormat || format;
  return (
    <div ref={ref} style={{ width: '100%' }}>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Biểu đồ xu hướng">
      <defs>
        <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end">{yf(t)}</text>
        </g>
      ))}
      {goal != null && (
        <g>
          <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke="var(--lav)" strokeDasharray="5 5" strokeWidth="1.3" />
          <text x={W - R} y={y(goal) - 6} textAnchor="end" style={{ fill: 'var(--lav)' }}>Mục tiêu {format(goal)}</text>
        </g>
      )}
      {refs.map((r) => (
        <g key={r.value}>
          <line x1={L} x2={W - R} y1={y(r.value)} y2={y(r.value)} stroke={r.color || 'var(--muted)'} strokeDasharray="4 5" strokeWidth="1.1" opacity="0.8" />
          <text x={W - R} y={y(r.value) - 5} textAnchor="end" style={{ fill: r.color || 'var(--muted)' }}>{r.label}</text>
        </g>
      ))}
      <path d={area} fill={`url(#a${id})`} />
      {pts2 && <path d={line2} fill="none" stroke={color2} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
      {pts2 && showDots && pts2.map((p, i) => <circle key={`b${i}`} cx={p[0]} cy={p[1]} r="2.6" fill="var(--bg)" stroke={color2} strokeWidth="1.6" />)}
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px var(--glow))' }} />
      {showDots && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="var(--bg)" stroke={color} strokeWidth="1.6" />)}
      {data.map((d, i) => ((i % every === 0 && data.length - 1 - i >= Math.max(1, every * 0.6)) || i === data.length - 1) && (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{d.label}</text>
      ))}
      <circle cx={last[0]} cy={last[1]} r="9" fill={color} opacity="0.18" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} />
      <g transform={`translate(${Math.min(last[0], W - R - 34)}, ${last[1] - 30})`}>
        <rect x="-34" y="0" width="68" height="22" rx="7" fill={color} />
        <text x="0" y="15" textAnchor="middle" style={{ fill: 'var(--on-accent)', fontWeight: 700 }}>{format(data[data.length - 1].value)}</text>
      </g>
    </svg>
    </div>
  );
}

export function BarChart({ labels, series, height = 200, format = (v) => v, stacked = false, highlight }) {
  const [ref, W] = useWidth();
  const H = height, L = 44, R = 8, T = 14, B = 26;
  const totals = labels.map((_, i) => (stacked ? series.reduce((s, se) => s + se.values[i], 0) : Math.max(...series.map((se) => se.values[i]))));
  const ticks = niceTicks(0, Math.max(...totals, 1), 4);
  const top = ticks[ticks.length - 1];
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const band = (W - L - R) / labels.length;
  const groupW = Math.min(band * 0.62, 64);
  const barW = stacked ? groupW : Math.min(groupW / series.length - 3, 26);
  return (
    <div ref={ref} style={{ width: '100%' }}>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Biểu đồ cột">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
        </g>
      ))}
      {labels.map((lab, i) => {
        const cx = L + band * i + band / 2;
        let acc = 0;
        return (
          <g key={lab + i} opacity={highlight == null || highlight === i ? 1 : 0.45}>
            {series.map((se, k) => {
              const v = se.values[i];
              if (stacked) {
                const yTop = y(acc + v), yBot = y(acc); acc += v;
                return <rect key={k} x={cx - barW / 2} y={yTop} width={barW} height={Math.max(0, yBot - yTop - (k ? 2 : 0))} rx="4" fill={se.color} />;
              }
              const bx = cx - (series.length * (barW + 3)) / 2 + k * (barW + 3) + 1.5;
              const h = Math.max(0, y(0) - y(v));
              return <rect key={k} x={bx} y={y(v)} width={barW} height={h} rx={Math.min(5, barW / 3)} fill={se.color} />;
            })}
            <text x={cx} y={H - 6} textAnchor="middle">{lab}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function Donut({ segments, size = 170, thickness = 20, children, gap = 2.5 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let off = 0;
  return (
    <div style={{ position: 'relative', width: size, maxWidth: '100%', aspectRatio: '1', flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-off} strokeLinecap="butt" />
          );
          off += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function Ring({ value, size = 84, thickness = 9, color = 'var(--mint)', children, track = 'var(--track)' }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * C} ${C}`} style={{ filter: `drop-shadow(0 0 6px ${color === 'var(--lav)' ? 'var(--lav-mid)' : 'var(--glow)'})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function Sparkline({ values, color = 'var(--mint)', width = 110, height = 36, bars = false }) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const x = (i) => 2 + (i * (width - 4)) / Math.max(1, values.length - 1);
  const y = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (height - 6);
  if (bars) {
    const bw = (width - 4) / values.length - 3;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {values.map((v, i) => {
          const h = 4 + ((v - lo) / (hi - lo || 1)) * (height - 6);
          return <rect key={i} x={2 + i * (bw + 3)} y={height - h} width={bw} height={h} rx="2" fill={color} opacity={0.35 + (0.65 * i) / values.length} />;
        })}
      </svg>
    );
  }
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px var(--glow))' }} />
    </svg>
  );
}

export function Progress({ value, tone = '', style }) {
  return <div className={`bar ${tone}`} style={style}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

/** Biểu đồ radar (mạng nhện) cho cân bằng cuộc sống. */
export function Radar({ axes, size = 260, color = 'var(--mint)' }) {
  const c = size / 2, R = size / 2 - 38, n = axes.length;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const poly = axes.map((ax, i) => pt(i, ax.value / 100).join(',')).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, margin: '0 auto' }} role="img" aria-label="Cân bằng cuộc sống">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={axes.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="var(--grid)" />
      ))}
      {axes.map((_, i) => { const [px, py] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={px} y2={py} stroke="var(--grid)" />; })}
      <polygon points={poly} fill="var(--glow)" stroke={color} strokeWidth="2" style={{ filter: 'drop-shadow(0 0 8px var(--glow))' }} />
      {axes.map((ax, i) => { const [px, py] = pt(i, ax.value / 100); return <circle key={i} cx={px} cy={py} r="3.5" fill={color} />; })}
      {axes.map((ax, i) => {
        const [px, py] = pt(i, 1.2);
        return (
          <text key={ax.label} x={px} y={py + 4} textAnchor={Math.abs(px - c) < 8 ? 'middle' : px > c ? 'start' : 'end'} style={{ fontSize: 11.5 }}>
            {ax.label} <tspan style={{ fill: 'var(--text)', fontWeight: 600 }}>{ax.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
