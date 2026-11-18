import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { addDays, dm, dow, iso, TODAY, todayIso, uid, weekDays, weekStart } from '../../core/format.js';
import { Card, PageHead } from '../../ui/common.jsx';
import { BarChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { effective, guessLink, LINK_ORDER, LINKS, linkOf } from './link.js';

const ICONS = ['dumbbell', 'bolt', 'paddle', 'pin', 'drop', 'moon', 'book', 'sparkle', 'heart', 'coffee', 'pen', 'star', 'smile', 'cap', 'journal', 'repeat'];

// Sửa một thói quen: tên, biểu tượng, mục tiêu, liên kết dữ liệu Sức khỏe.
function HabitForm({ init, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(init);
  const link = f.link || guessLink(f.name);
  const km = LINKS[link]?.km;
  return (
    <div className="stack hb-form" style={{ gap: 10 }}>
      <div className="field"><label htmlFor="hb-name">Tên thói quen</label>
        <input id="hb-name" className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ví dụ: Chạy bộ, Đánh Pickleball" /></div>
      <div className="field"><label>Biểu tượng</label>
        <div className="hb-icons">{ICONS.map((ic) => (
          <button key={ic} type="button" className={`hb-icon ${f.icon === ic ? 'on' : ''}`} onClick={() => setF({ ...f, icon: ic })} aria-label={ic} aria-pressed={f.icon === ic}><Icon name={ic} size={18} /></button>
        ))}</div>
      </div>
      <div className="grid g2" style={{ gap: 10 }}>
        <div className="field"><label htmlFor="hb-target">Mục tiêu</label>
          <select id="hb-target" className="input" value={f.target} onChange={(e) => setF({ ...f, target: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} ngày/tuần</option>)}
          </select></div>
        <div className="field"><label htmlFor="hb-link">Tự tích từ Sức khỏe</label>
          <select id="hb-link" className="input" value={link} onChange={(e) => setF({ ...f, link: e.target.value })}>
            {LINK_ORDER.map((k) => <option key={k} value={k}>{LINKS[k].label}</option>)}
          </select></div>
      </div>
      {km && <div className="field"><label htmlFor="hb-km">Chỉ tính khi đủ (km, để trống = buổi nào cũng tính)</label>
        <input id="hb-km" className="input" inputMode="decimal" value={f.minKm || ''} onChange={(e) => setF({ ...f, minKm: parseFloat(e.target.value.replace(',', '.')) || 0 })} placeholder="Ví dụ: 5" /></div>}
      {link !== 'none' && <div className="muted" style={{ fontSize: 12.5 }}>Ngày nào có {link === 'pickleball' ? 'buổi Pickleball bạn chơi' : 'buổi tập phù hợp'} sẽ tự được tích. Bạn vẫn bỏ tích tay được.</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {onDelete ? <button className="btn ghost sm" style={{ color: 'var(--rose)' }} onClick={onDelete}><Icon name="trash" size={14} />Xóa</button> : <span />}
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={onCancel}>Hủy</button>
          <button className="btn sm" disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim(), link })}>Lưu</button>
        </span>
      </div>
    </div>
  );
}

function Manage({ habits, set, notify }) {
  const [edit, setEdit] = useState(null); // id | 'new'
  const save = (f0) => {
    const f = edit === 'new' && f0.icon === 'sparkle' ? { ...f0, icon: { run: 'bolt', pickleball: 'paddle', walk: 'pin', swim: 'drop', ride: 'repeat', any: 'dumbbell' }[f0.link] || 'sparkle' } : f0;
    set((s) => ({ ...s, habits: edit === 'new' ? [...s.habits, { id: uid(), log: {}, ...f }] : s.habits.map((h) => (h.id === edit ? { ...h, ...f } : h)) }));
    notify(edit === 'new' ? 'Đã thêm thói quen' : 'Đã lưu thói quen'); setEdit(null);
  };
  const del = (h) => {
    if (!window.confirm(`Xóa thói quen "${h.name}" cùng toàn bộ lịch sử tích?`)) return;
    set((s) => ({ ...s, habits: s.habits.filter((x) => x.id !== h.id) })); setEdit(null);
  };
  const move = (i, k) => set((s) => { const a = [...s.habits]; const j = i + k; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, habits: a }; });
  return (
    <Card title="Danh mục thói quen" icon="pen" action={edit !== 'new' && <button className="btn sm" onClick={() => setEdit('new')}><Icon name="plus" size={14} />Thêm</button>}>
      {edit === 'new' && <HabitForm init={{ name: '', icon: 'sparkle', target: 5 }} onSave={save} onCancel={() => setEdit(null)} />}
      {habits.map((h, i) => (
        <div key={h.id} className="row" style={{ display: 'block' }}>
          {edit === h.id ? <HabitForm init={{ name: h.name, icon: h.icon, target: h.target, link: h.link, minKm: h.minKm }} onSave={save} onCancel={() => setEdit(null)} onDelete={() => del(h)} /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="icon-tile" style={{ width: 34, height: 34 }}><Icon name={h.icon} size={16} /></span>
              <div className="row-main">
                <div className="row-title" style={{ fontSize: 14 }}>{h.name}</div>
                <div className="row-sub">{h.target} ngày/tuần{linkOf(h) !== 'none' ? ` · tự tích: ${LINKS[linkOf(h)].label.split(' · ')[0]}${h.minKm ? ` từ ${h.minKm} km` : ''}` : ''}</div>
              </div>
              <button className="bare-btn" style={{ margin: 0, width: 32 }} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Đưa ${h.name} lên`}><Icon name="up" size={16} /></button>
              <button className="bare-btn" style={{ margin: 0, width: 32 }} disabled={i === habits.length - 1} onClick={() => move(i, 1)} aria-label={`Đưa ${h.name} xuống`}><Icon name="down" size={16} /></button>
              <button className="btn ghost sm" onClick={() => setEdit(h.id)}>Sửa</button>
            </div>
          )}
        </div>
      ))}
      {!habits.length && edit !== 'new' && <div className="empty">Chưa có thói quen nào.</div>}
    </Card>
  );
}

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
  const [raw, set] = useModule('habits');
  const [health] = useModule('health');
  const notify = useNotify();
  const d = { ...raw, habits: raw.habits.map((h) => effective(h, health)) };
  const days = weekDays();
  const ws = weekStart(TODAY);
  const toggle = (hid, k) => { const done = !!d.habits.find((h) => h.id === hid)?.log[k]; set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === hid ? { ...h, log: { ...h.log, [k]: !done } } : h)) })); };
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
                    <td style={{ paddingRight: 10 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, fontSize: 13 }}><Icon name={h.icon} size={16} className="mint" /><span>{h.name}{linkOf(h) !== 'none' && <span className="hb-linked" title="Tự tích từ Sức khỏe">tự động</span>}</span></div></td>
                    {days.map((x) => { const k = iso(x); const future = k > todayIso; const auto = h.auto[k] && h.rawLog?.[k] === undefined; return (
                      <td key={k} style={{ textAlign: 'center' }}>
                        <button disabled={future} onClick={() => toggle(h.id, k)} aria-label={`${h.name} ${dm(x)}${auto ? `, tự tích: ${h.auto[k]}` : ''}`} aria-pressed={!!h.log[k]} title={auto ? `Tự tích từ Sức khỏe: ${h.auto[k]}` : undefined} className={auto ? 'hb-auto' : undefined}
                          style={{ width: 30, height: 30, borderRadius: 9, border: k === todayIso ? '1.5px solid var(--mint)' : '1px solid var(--line)', background: h.log[k] ? 'var(--mint)' : 'transparent', color: 'var(--on-accent)', opacity: future ? 0.3 : 1, display: 'inline-grid', placeItems: 'center' }}>
                          {h.log[k] && <Icon name="check" size={15} stroke={2.6} />}
                        </button>
                      </td>); })}
                    <td style={{ textAlign: 'center' }}><span className={`chip ${c >= h.target ? 'mint' : ''}`}>{c}/{h.target}</span></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
          {d.habits.some((h) => Object.keys(h.auto).length) && <div className="legend" style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}><i style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--lav)', display: 'inline-block' }} />Ô xanh: tự tích từ Sức khỏe (chạm để bỏ tích)</div>}
        </Card>
        <div className="stack">
          <Card title="Hôm nay" icon="today">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Ring value={d.habits.length ? (todayDone / d.habits.length) * 100 : 0} size={96} thickness={10}><div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{todayDone}/{d.habits.length}</div></Ring>
              <div><div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{thisWeek}<span className="muted" style={{ fontSize: 14 }}> lượt</span></div><div className="muted" style={{ fontSize: 12.5 }}>tuần này, sau {elapsed}/7 ngày</div>
                <div className="muted" style={{ fontSize: 12.5 }}>Mục tiêu cả tuần: {targetSum} lượt</div></div>
            </div>
          </Card>
          <Manage habits={raw.habits} set={set} notify={notify} />
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
