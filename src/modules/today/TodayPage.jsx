import { useState } from 'react';
import { useModule, useNotify, useStore } from '../../core/store.jsx';
import { collectAgenda, collectEvents } from '../../core/agenda.js';
import { daysFromToday, dm, dow, iso, longDate, nowMinutes, parse, todayIso, uid, weekDays } from '../../core/format.js';
import { go } from '../../core/router.js';
import { Card, Check, PageHead } from '../../ui/common.jsx';
import { BarChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { KINDS } from './data.js';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function AgendaList({ items, onToggle, compact }) {
  if (!items.length) return <div className="empty">Không có việc nào cho ngày này.</div>;
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || Number(!!b.overdue) - Number(!!a.overdue));
  return (
    <div className="list">
      {sorted.map((it) => (
        <div className="row" key={`${it.module}-${it.id}`}>
          {it.toggle ? <Check on={it.done} onClick={() => onToggle(it)} label={it.title} /> : (
            <button className="check" onClick={() => go(it.module)} aria-label={`Mở ${it.moduleTitle}`}><Icon name="chevR" size={13} style={{ color: 'var(--mint)' }} /></button>)}
          <div className="row-main">
            <div className={`row-title ${it.done ? 'done-text' : ''}`} style={{ fontWeight: 500 }}>{it.title}</div>
            {!compact && (it.sub || it.overdue) && <div className="row-sub" style={{ color: it.overdue ? 'var(--rose)' : undefined }}>{it.sub}</div>}
          </div>
          <button className={`chip ${it.overdue ? 'rose' : it.high ? 'amber' : ''}`} style={{ border: 0 }} onClick={() => go(it.module)} title={`Mở ${it.moduleTitle}`}>
            <Icon name={it.icon} size={12} />{it.kind}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function TodayPage() {
  const { state, update } = useStore();
  const [d, set] = useModule('today');
  const notify = useNotify();
  const [day, setDay] = useState(todayIso);
  const [mode, setMode] = useState('task');
  const [form, setForm] = useState({ title: '', time: '10:00', end: '11:00', kind: 'personal', priority: 'normal' });

  const days = weekDays();
  const events = collectEvents(state);
  const items = collectAgenda(state, day);
  const doneCount = items.filter((i) => i.done).length;
  const appts = events.filter((e) => e.own && e.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const allDay = events.filter((e) => !e.own && e.date === day);
  const upcoming = events.filter((e) => !e.own && daysFromToday(e.date) > 0 && daysFromToday(e.date) <= 21).sort((a, b) => a.date.localeCompare(b.date));
  const kinds = Object.keys(KINDS);
  const load = kinds.map((k) => ({ name: KINDS[k].label, color: KINDS[k].color, values: days.map((x) => events.filter((e) => e.own && e.date === iso(x) && e.kind === k).reduce((s, e) => s + (toMin(e.end) - toMin(e.time)) / 60, 0)) }));
  const nowMin = nowMinutes();
  const nowLabel = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`;

  const toggle = (it) => update(it.module, it.toggle);
  const add = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return notify('Nhập nội dung');
    if (mode === 'task') set((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), date: day, title: form.title.trim(), done: false, priority: form.priority }] }));
    else set((s) => ({ ...s, appointments: [...s.appointments, { id: uid(), date: day, time: form.time, end: form.end, title: form.title.trim(), place: '', kind: form.kind }] }));
    setForm({ ...form, title: '' });
    notify(mode === 'task' ? 'Đã thêm việc' : 'Đã thêm lịch hẹn');
  };

  return (
    <div className="fade-in">
      <PageHead title={day === todayIso ? 'Hôm nay' : `${dow(parse(day))}, ${dm(day)}`} subtitle={`${longDate(parse(day))} · gom lịch hẹn, hạn thanh toán, cột mốc và thói quen về một nơi`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, marginBottom: 16 }}>
        {days.map((x) => {
          const k = iso(x); const n = events.filter((e) => e.date === k).length; const active = k === day; const isT = k === todayIso;
          return (
            <button key={k} onClick={() => setDay(k)} aria-pressed={active}
              style={{ padding: '10px 0 8px', borderRadius: 16, border: `1px solid ${active ? 'var(--mint)' : 'var(--line)'}`, background: active ? 'var(--mint)' : 'var(--surface)', color: active ? 'var(--on-accent)' : 'var(--text)', display: 'grid', justifyItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8 }}>{dow(x)}</span>
              <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{x.getDate()}</span>
              <span style={{ display: 'flex', gap: 2, height: 6 }}>{Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} style={{ width: 5, height: 5, borderRadius: 9, background: active ? 'var(--on-accent)' : isT ? 'var(--mint)' : 'var(--lav)' }} />)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid g-main">
        <Card title="Lịch trong ngày" icon="clock" glow action={<span className="chip">{appts.length} lịch hẹn</span>}>
          {allDay.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>{allDay.map((e, i) => <button key={i} className="chip lav" style={{ border: 0 }} onClick={() => go(e.module)}><Icon name={e.icon} size={12} />{e.title}</button>)}</div>}
          {appts.length ? (
            <div style={{ display: 'grid' }}>
              {appts.map((a, i) => {
                const k = KINDS[a.kind] || KINDS.personal;
                const past = day < todayIso || (day === todayIso && toMin(a.end) < nowMin);
                const now = day === todayIso && toMin(a.time) <= nowMin && toMin(a.end) >= nowMin;
                const nextIsAfterNow = day === todayIso && toMin(a.end) < nowMin && appts[i + 1] && toMin(appts[i + 1].time) > nowMin;
                return (
                  <div key={a.id}>
                    <div style={{ display: 'flex', gap: 12, opacity: past ? 0.55 : 1 }}>
                      <div className="num" style={{ width: 46, flexShrink: 0, fontSize: 13, fontWeight: 600, paddingTop: 10 }}>{a.time}</div>
                      <div style={{ flex: 1, minWidth: 0, margin: '4px 0', padding: '10px 12px', borderRadius: 14, background: 'var(--surface)', border: `1px solid ${now ? 'var(--mint)' : 'var(--line)'}`, borderLeft: `3px solid ${k.color}` }}>
                        <div className="row-title">{a.title}</div>
                        <div className="row-sub">{a.time}–{a.end}{a.place ? ` · ${a.place}` : ''} · {k.label}</div>
                      </div>
                    </div>
                    {nextIsAfterNow && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}><span className="num mint" style={{ fontSize: 11, width: 46 }}>{nowLabel}</span><span style={{ flex: 1, height: 2, background: 'var(--mint)', boxShadow: '0 0 8px var(--mint)' }} /></div>}
                  </div>
                );
              })}
            </div>
          ) : <div className="empty">Ngày này chưa có lịch hẹn.</div>}
        </Card>

        <Card title="Cần làm" icon="today" action={<Ring value={items.length ? (doneCount / items.length) * 100 : 0} size={44} thickness={5}><span className="num" style={{ fontSize: 11, fontWeight: 600 }}>{doneCount}/{items.length}</span></Ring>}>
          <AgendaList items={items} onToggle={toggle} />
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Số giờ có lịch trong tuần" icon="chart">
          <BarChart stacked labels={days.map((x) => `${dow(x)} ${x.getDate()}`)} series={load} height={180} format={(v) => `${v}h`} highlight={days.findIndex((x) => iso(x) === day)} />
          <div className="legend" style={{ marginTop: 6 }}>{kinds.map((k) => <span key={k}><i style={{ background: KINDS[k].color }} />{KINDS[k].label}</span>)}</div>
        </Card>
        <Card title={`Thêm vào ${day === todayIso ? 'hôm nay' : dm(day)}`} icon="plus">
          <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
            <div className="tabs" style={{ margin: 0 }}>{[['task', 'Việc cần làm'], ['appt', 'Lịch hẹn']].map(([k, l]) => <button type="button" key={k} className={`tab ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>
            <div className="field"><label htmlFor="td-title">Nội dung</label><input id="td-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={mode === 'task' ? 'Ví dụ: Gọi cho ngân hàng' : 'Ví dụ: Cà phê với Minh'} /></div>
            {mode === 'task' ? (
              <div className="field"><label htmlFor="td-pr">Mức ưu tiên</label><select id="td-pr" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="normal">Bình thường</option><option value="high">Ưu tiên cao</option></select></div>
            ) : (
              <div className="form-row">
                <div className="field"><label htmlFor="td-s">Bắt đầu</label><input id="td-s" type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                <div className="field"><label htmlFor="td-e">Kết thúc</label><input id="td-e" type="time" className="input" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
                <div className="field"><label htmlFor="td-k">Loại</label><select id="td-k" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{kinds.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}</select></div>
              </div>
            )}
            <button className="btn" type="submit"><Icon name="plus" size={18} />Thêm</button>
          </form>
        </Card>
      </div>

      <Card title="Sắp tới trong 3 tuần" icon="cal" style={{ marginTop: 14 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
          {upcoming.map((e, i) => (
            <button key={i} onClick={() => go(e.module)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', textAlign: 'left' }}>
              <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{parse(e.date).getDate()}</div><div className="faint" style={{ fontSize: 11 }}>Th{parse(e.date).getMonth() + 1}</div></div>
              <div className="row-main"><div className="row-title" style={{ fontSize: 13 }}>{e.title}</div><div className="row-sub">còn {daysFromToday(e.date)} ngày</div></div>
              <Icon name={e.icon} size={16} className="mint" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
