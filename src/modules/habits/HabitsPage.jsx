import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { addDays, dm, dow, iso, TODAY, todayIso, uid, weekDays, weekStart } from '../../core/format.js';
import { Card, PageHead } from '../../ui/common.jsx';
import { BarChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';

export const streak = (h) => { let n = 0; let d = TODAY; if (!h.log[iso(d)]) d = addDays(d, -1); while (h.log[iso(d)]) { n++; d = addDays(d, -1); } return n; };
export const weekCount = (h, start) => Array.from({ length: 7 }, (_, i) => iso(addDays(start, i))).filter((k) => h.log[k]).length;

function Heat({ log }) {
  const start = addDays(weekStart(TODAY), -11 * 7);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
      {Array.from({ length: 12 }, (_, w) => (
        <div key={w} style={{ display: 'grid', gap: 3 }}>
          {Array.from({ length: 7 }, (_, d) => { const day = addDays(start, w * 7 + d); const k = iso(day); const future = k > todayIso;
            return <span key={d} title={dm(day)} style={{ aspectRatio: '1', borderRadius: 3, background: future ? 'transparent' : log[k] ? 'var(--mint)' : 'var(--track)', opacity: log[k] ? 0.55 + (w / 12) * 0.45 : 1 }} />; })}
        </div>
      ))}
    </div>
  );
}

export default function HabitsPage() {
  const [d, set] = useModule('habits');
  const notify = useNotify();
  const [name, setName] = useState('');
  const days = weekDays();
  const ws = weekStart(TODAY);
  const toggle = (hid, k) => set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === hid ? { ...h, log: { ...h.log, [k]: !h.log[k] } } : h)) }));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -(7 - i) * 7));
  const totalPerWeek = weeks.map((w) => d.habits.reduce((s, h) => s + weekCount(h, w), 0));
  const targetSum = d.habits.reduce((s, h) => s + h.target, 0);
  const thisWeek = d.habits.reduce((s, h) => s + weekCount(h, ws), 0);
  const elapsed = ((TODAY.getDay() + 6) % 7) + 1;
  const todayDone = d.habits.filter((h) => h.log[todayIso]).length;

  return (
    <div className="fade-in">
      <PageHead title="Thói quen" subtitle="Những việc nhỏ lặp lại mỗi ngày tạo nên con người bạn." />
      <div className="grid g-main">
        <Card title="Tuần này" icon="cal" glow>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 460, borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead><tr><th />{days.map((x) => <th key={+x} style={{ fontSize: 11.5, fontWeight: 500, color: iso(x) === todayIso ? 'var(--mint)' : 'var(--muted)' }}>{dow(x)}<br /><span className="num">{x.getDate()}</span></th>)}<th style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>Tuần</th></tr></thead>
              <tbody>
                {d.habits.map((h) => { const c = weekCount(h, ws); return (
                  <tr key={h.id}>
                    <td style={{ paddingRight: 10 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, fontSize: 13 }}><Icon name={h.icon} size={16} className="mint" />{h.name}</div></td>
                    {days.map((x) => { const k = iso(x); const future = k > todayIso; return (
                      <td key={k} style={{ textAlign: 'center' }}>
                        <button disabled={future} onClick={() => toggle(h.id, k)} aria-label={`${h.name} ${dm(x)}`} aria-pressed={!!h.log[k]}
                          style={{ width: 30, height: 30, borderRadius: 9, border: k === todayIso ? '1.5px solid var(--mint)' : '1px solid var(--line)', background: h.log[k] ? 'var(--mint)' : 'transparent', color: 'var(--on-accent)', opacity: future ? 0.3 : 1, display: 'inline-grid', placeItems: 'center' }}>
                          {h.log[k] && <Icon name="check" size={15} stroke={2.6} />}
                        </button>
                      </td>); })}
                    <td style={{ textAlign: 'center' }}><span className={`chip ${c >= h.target ? 'mint' : ''}`}>{c}/{h.target}</span></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="stack">
          <Card title="Hôm nay" icon="today">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Ring value={(todayDone / d.habits.length) * 100} size={96} thickness={10}><div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{todayDone}/{d.habits.length}</div></Ring>
              <div><div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{thisWeek}<span className="muted" style={{ fontSize: 14 }}> lượt</span></div><div className="muted" style={{ fontSize: 12.5 }}>tuần này, sau {elapsed}/7 ngày</div>
                <div className="muted" style={{ fontSize: 12.5 }}>Mục tiêu cả tuần: {targetSum} lượt</div></div>
            </div>
          </Card>
          <Card title="Thêm thói quen" icon="plus">
            <div className="form-row">
              <div className="field"><label htmlFor="hb-new">Tên thói quen</label><input id="hb-new" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Đi bộ 8.000 bước" /></div>
              <button className="btn sm" style={{ height: 42 }} onClick={() => { if (!name.trim()) return; set((s) => ({ ...s, habits: [...s.habits, { id: uid(), name: name.trim(), icon: 'sparkle', target: 5, log: {} }] })); setName(''); notify('Đã thêm thói quen'); }}><Icon name="plus" size={16} />Thêm</button>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Số lượt hoàn thành mỗi tuần" icon="chart">
          <BarChart labels={weeks.map((w) => dm(w))} series={[{ name: 'Lượt', color: 'var(--mint)', values: totalPerWeek }]} height={190} highlight={7} />
          <div className="legend" style={{ marginTop: 6 }}><span>Mục tiêu {targetSum} lượt/tuần · tuần hiện tại mới qua {elapsed} ngày</span></div>
        </Card>
        <Card title="Chuỗi ngày liên tiếp" icon="bolt">
          <div className="list">
            {d.habits.map((h) => (
              <div className="row" key={h.id}>
                <span className="icon-tile" style={{ width: 32, height: 32 }}><Icon name={h.icon} size={16} /></span>
                <div className="row-main"><div className="row-title" style={{ fontSize: 13 }}>{h.name}</div></div>
                <b className="num">{streak(h)}</b><span className="muted" style={{ fontSize: 12 }}>ngày</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid" style={{ marginTop: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' }}>
        {d.habits.map((h) => (
          <Card key={h.id} title={h.name} icon={h.icon}>
            <Heat log={h.log} />
            <div className="row-sub" style={{ marginTop: 8 }}>12 tuần gần nhất</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
