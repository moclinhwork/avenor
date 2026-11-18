import { useState } from 'react';
import { dm } from '../../core/format.js';
import { go } from '../../core/router.js';
import { deltaSince, scoreTone, scoreWord, trend } from '../../core/life.js';
import { Card, PageHead } from '../../ui/common.jsx';
import { LineChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { useLife } from './useLife.js';

const TONE_COLOR = { good: 'var(--good)', mint: 'var(--mint)', amber: 'var(--amber)', rose: 'var(--rose)', '': 'var(--faint)' };
const WEIGHTS = [[0, 'Bỏ'], [1, 'Ít'], [2, 'Vừa'], [3, 'Cao']];

export function ScoreRing({ value, size = 96, thickness = 10 }) {
  return (
    <Ring value={value ?? 0} size={size} thickness={thickness} color={TONE_COLOR[scoreTone(value)]}>
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div className="num" style={{ fontSize: size * 0.3, fontWeight: 700 }}>{value ?? '—'}</div>
        {size >= 80 && <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>/ 100</div>}
      </div>
    </Ring>
  );
}

export const DeltaChip = ({ value, label = '7 ngày' }) => (value == null || value === 0 ? (
  <span className="chip">{value === 0 ? `Giữ nguyên so với ${label} trước` : 'Đang ghi nhận xu hướng'}</span>
) : <span className={`chip ${value > 0 ? 'good' : 'rose'}`}>{value > 0 ? '▲' : '▼'} {Math.abs(value)} điểm so với {label} trước</span>);

export default function LifePage() {
  const { update, life, ls } = useLife();
  const [range, setRange] = useState(30);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(false);
  const snaps = life.snaps || {};
  const series = trend(snaps, range).filter((p) => p.value != null);
  const d7 = deltaSince(snaps, ls.total, 7);
  const setW = (id, w) => update('life', (s) => ({ ...s, weights: { ...(s.weights || {}), [id]: w } }));
  const shown = ls.domains.filter((d) => d.score != null);
  const missing = ls.domains.filter((d) => d.score == null);

  return (
    <div className="fade-in">
      <PageHead title="Life Score" subtitle="Điểm cân bằng cuộc sống, tính từ dữ liệu thật trong các module của bạn." />

      <section className="card ls-hero">
        <ScoreRing value={ls.total} size={128} thickness={12} />
        <div style={{ minWidth: 0 }}>
          <div className="faint" style={{ fontSize: 12.5 }}>Hôm nay</div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 6px' }}>{scoreWord(ls.total)}</div>
          <DeltaChip value={d7} />
          {ls.strongest && ls.weakest && ls.strongest.id !== ls.weakest.id && (
            <p className="muted" style={{ fontSize: 13.5, margin: '10px 0 0' }}>
              Mạnh nhất: <b>{ls.strongest.label}</b> ({ls.strongest.score}). Cần chú ý: <b>{ls.weakest.label}</b> ({ls.weakest.score}).
            </p>
          )}
        </div>
      </section>

      {ls.weakest && (
        <button className="card ls-focus" onClick={() => go(ls.weakest.to)}>
          <span className="icon-tile amber"><Icon name="bolt" size={18} /></span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span className="faint" style={{ fontSize: 12, display: 'block' }}>Một việc để tăng điểm hôm nay</span>
            <span style={{ fontWeight: 500 }}>{ls.weakest.tip}</span>
          </span>
          <Icon name="chevR" size={16} />
        </button>
      )}

      <Card title="Từng lĩnh vực" icon="grid" style={{ marginTop: 14 }}
        action={<button className="link" onClick={() => setEdit((v) => !v)}>{edit ? 'Xong' : 'Trọng số'}</button>}>
        {edit && <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Chọn mức quan trọng của từng lĩnh vực với bạn. "Bỏ" thì không tính vào tổng điểm.</p>}
        <div className="ls-list">
          {shown.map((d) => (
            <div key={d.id} className="ls-row">
              <button className="ls-row-head" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                <span className="icon-tile"><Icon name={d.icon} size={17} /></span>
                <span className="ls-row-main">
                  <span className="ls-row-title">{d.label}{d.weight === 0 && <span className="chip" style={{ marginLeft: 6 }}>không tính</span>}</span>
                  <span className="ls-bar"><span style={{ width: `${d.score}%`, background: TONE_COLOR[scoreTone(d.score)] }} /></span>
                </span>
                <span className="num ls-row-score" style={{ color: TONE_COLOR[scoreTone(d.score)] }}>{d.score}</span>
                <Icon name="chevD" size={15} style={{ transform: open === d.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {edit && (
                <div className="tabs seg ls-weights" role="radiogroup" aria-label={`Trọng số ${d.label}`}>
                  {WEIGHTS.map(([w, l]) => <button key={w} role="radio" aria-checked={d.weight === w} className={`tab ${d.weight === w ? 'active' : ''}`} onClick={() => setW(d.id, w)}>{l}</button>)}
                </div>
              )}
              {open === d.id && (
                <div className="ls-parts">
                  {d.parts.map((p) => (
                    <div key={p.label} className="ls-part">
                      <span>{p.label}</span>
                      <span className="faint">{p.detail}</span>
                      <span className="num" style={{ color: TONE_COLOR[scoreTone(p.score)], fontWeight: 600 }}>{p.score}</span>
                    </div>
                  ))}
                  <button className="link" onClick={() => go(d.to)}>Mở {d.label}<Icon name="chevR" size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        {missing.length > 0 && <p className="faint" style={{ fontSize: 12.5, marginBottom: 0 }}>Chưa chấm (chưa đủ dữ liệu): {missing.map((d) => d.label).join(', ')}.</p>}
      </Card>

      <Card title="Xu hướng" icon="trend" style={{ marginTop: 14 }}
        action={<div className="tabs seg" style={{ margin: 0, padding: 3 }}>{[[30, '30 ngày'], [90, '90 ngày']].map(([k, l]) => (
          <button key={k} className={`tab ${range === k ? 'active' : ''}`} style={{ padding: '5px 10px' }} onClick={() => setRange(k)}>{l}</button>))}</div>}>
        {series.length >= 2
          ? <LineChart data={series.map((p) => ({ label: dm(p.date), value: p.value }))} format={(v) => `${v}`} yFormat={(v) => Math.round(v)} height={200} minPad={3} showDots={series.length <= 31} />
          : <div className="empty">Điểm được lưu mỗi ngày bạn mở Avenor. Sau vài ngày, biểu đồ xu hướng sẽ hiện ở đây.</div>}
      </Card>

      <p className="faint" style={{ fontSize: 12, margin: '14px 4px 0' }}>Cách tính: mỗi lĩnh vực là trung bình các chỉ số con (bấm vào để xem). Tổng điểm là trung bình có trọng số của các lĩnh vực đang có dữ liệu.</p>
    </div>
  );
}
