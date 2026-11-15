import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { dm, dmy, dow, iso, parse, TODAY, todayIso, weekStart } from '../../core/format.js';
import { Card, PageHead } from '../../ui/common.jsx';
import Icon from '../../ui/Icon.jsx';
import { MOOD_FACE, MOODS } from './data.js';

function MoodChart({ entries }) {
  const W = 560, H = 190, L = 30, R = 10, T = 12, B = 26;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, entries.length - 1);
  const y = (v) => T + (1 - (v - 1) / 4) * (H - T - B);
  const path = (k) => entries.map((e, i) => `${i ? 'L' : 'M'}${x(i)},${y(e[k])}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tâm trạng và năng lượng 14 ngày">
      {[1, 2, 3, 4, 5].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
      <path d={path('energy')} fill="none" stroke="var(--lav)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={path('mood')} fill="none" stroke="var(--mint)" strokeWidth="2.6" style={{ filter: 'drop-shadow(0 0 6px var(--glow))' }} />
      {entries.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.mood)} r="3.5" fill="var(--mint)" />)}
      {entries.map((e, i) => (i % 2 === 0 || i === entries.length - 1) && <text key={`t${i}`} x={x(i)} y={H - 6} textAnchor="middle">{dm(e.date)}</text>)}
    </svg>
  );
}

export default function JournalPage() {
  const [d, set] = useModule('journal');
  const notify = useNotify();
  const today = d.entries.find((e) => e.date === todayIso);
  const [form, setForm] = useState({ mood: today?.mood || 4, energy: today?.energy || 3, note: today?.note || '' });
  const [rv, setRv] = useState({ wins: '', adjust: '', score: 7 });
  const entries = [...d.entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const week = entries.filter((e) => parse(e.date) >= weekStart(TODAY));
  const avg = (k, arr) => (arr.length ? (arr.reduce((s, e) => s + e[k], 0) / arr.length).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '–');

  const save = () => {
    set((s) => ({ ...s, entries: [...s.entries.filter((e) => e.date !== todayIso), { date: todayIso, ...form }] }));
    notify('Đã lưu nhật ký hôm nay');
  };
  const saveReview = () => {
    if (!rv.wins.trim() && !rv.adjust.trim()) return notify('Viết ít nhất một dòng tổng kết');
    set((s) => ({ ...s, reviews: [{ week: iso(weekStart(TODAY)), ...rv }, ...s.reviews.filter((r) => r.week !== iso(weekStart(TODAY)))] }));
    setRv({ wins: '', adjust: '', score: 7 });
    notify('Đã lưu tổng kết tuần');
  };

  const Scale = ({ k, labels }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} onClick={() => setForm({ ...form, [k]: v })} aria-pressed={form[k] === v} title={labels?.[v - 1]}
          style={{ padding: '10px 0', borderRadius: 12, border: `1px solid ${form[k] === v ? 'var(--mint)' : 'var(--line)'}`, background: form[k] === v ? 'var(--mint-soft)' : 'var(--surface)', fontSize: k === 'mood' ? 22 : 15, fontWeight: 600, color: form[k] === v ? 'var(--mint)' : 'var(--text)' }}>
          {k === 'mood' ? MOOD_FACE[v - 1] : v}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fade-in">
      <PageHead title="Nhật ký & Tổng kết tuần" subtitle="Ghi lại tâm trạng, năng lượng và điều muốn điều chỉnh." />
      <div className="grid g-main">
        <Card title="Tâm trạng & năng lượng 14 ngày" icon="trend" glow>
          <MoodChart entries={entries} />
          <div className="legend" style={{ marginTop: 6 }}><span><i style={{ background: 'var(--mint)' }} />Tâm trạng</span><span><i style={{ background: 'var(--lav)' }} />Năng lượng</span><span className="faint">Thang 1–5</span></div>
        </Card>
        <Card title={`Hôm nay, ${dow(TODAY)} ${dm(TODAY)}`} icon="pen">
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="field"><label>Tâm trạng: {MOODS[form.mood - 1]}</label><Scale k="mood" labels={MOODS} /></div>
            <div className="field"><label>Mức năng lượng</label><Scale k="energy" /></div>
            <div className="field"><label htmlFor="j-note">Ghi chú</label><textarea id="j-note" rows={3} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Điều gì nổi bật hôm nay?" /></div>
            <button className="btn" onClick={save}><Icon name="check" size={18} />{today ? 'Cập nhật' : 'Lưu nhật ký'}</button>
          </div>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Tổng kết tuần này" icon="sparkle">
          <div className="grid g3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 14 }}>
            <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{avg('mood', week)}</div><div className="muted" style={{ fontSize: 12 }}>tâm trạng TB</div></div>
            <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{avg('energy', week)}</div><div className="muted" style={{ fontSize: 12 }}>năng lượng TB</div></div>
            <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{week.length}/7</div><div className="muted" style={{ fontSize: 12 }}>ngày đã ghi</div></div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="field"><label htmlFor="rv-w">Điều làm tốt tuần này</label><textarea id="rv-w" rows={2} className="input" value={rv.wins} onChange={(e) => setRv({ ...rv, wins: e.target.value })} /></div>
            <div className="field"><label htmlFor="rv-a">Muốn điều chỉnh cho tuần sau</label><textarea id="rv-a" rows={2} className="input" value={rv.adjust} onChange={(e) => setRv({ ...rv, adjust: e.target.value })} /></div>
            <div className="field"><label htmlFor="rv-s">Chấm điểm tuần: {rv.score}/10</label><input id="rv-s" type="range" min="1" max="10" value={rv.score} onChange={(e) => setRv({ ...rv, score: Number(e.target.value) })} style={{ accentColor: 'var(--mint)' }} /></div>
            <button className="btn ghost" onClick={saveReview}>Lưu tổng kết tuần</button>
          </div>
        </Card>
        <Card title="Các tuần trước" icon="journal">
          <div className="list">
            {d.reviews.map((r) => (
              <div className="row" key={r.week} style={{ alignItems: 'flex-start' }}>
                <span className="icon-tile lav" style={{ fontFamily: 'var(--font-num)', fontWeight: 700 }}>{r.score}</span>
                <div className="row-main">
                  <div className="row-title">Tuần từ {dmy(r.week)}</div>
                  <div className="row-sub"><b className="mint">Làm tốt:</b> {r.wins}</div>
                  <div className="row-sub"><b className="lav">Điều chỉnh:</b> {r.adjust}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Nhật ký gần đây" icon="cal" style={{ marginTop: 14 }}>
        <div className="list">
          {[...entries].reverse().slice(0, 7).map((e) => (
            <div className="row" key={e.date}>
              <span style={{ fontSize: 22 }}>{MOOD_FACE[e.mood - 1]}</span>
              <div className="row-main"><div className="row-title">{dow(parse(e.date))}, {dm(e.date)}</div><div className="row-sub">{e.note}</div></div>
              <span className="chip lav"><Icon name="bolt" size={12} />{e.energy}/5</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
