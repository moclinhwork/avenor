import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { dmy, num, pct, relDays } from '../../core/format.js';
import { Card, Check, PageHead } from '../../ui/common.jsx';
import { BarChart, Donut, Progress } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { skills } from './data.js';

export default function LearningPage() {
  const [d, set] = useModule('learning');
  const notify = useNotify();
  const [log, setLog] = useState({ course: 'c1', hours: '1' });
  const totalHours = d.courses.reduce((s, c) => s + c.hours, 0);
  const sk = skills(d.courses);
  const thisWeek = d.weekly[d.weekly.length - 1].hours;

  const addLog = () => {
    const h = parseFloat(String(log.hours).replace(',', '.'));
    if (!h) return;
    set((s) => ({
      ...s,
      courses: s.courses.map((c) => (c.id === log.course ? { ...c, hours: +(c.hours + h).toFixed(1), done: Math.min(c.total, c.done + 1) } : c)),
      weekly: s.weekly.map((w, i) => (i === s.weekly.length - 1 ? { ...w, hours: +(w.hours + h).toFixed(1) } : w)),
    }));
    notify(`Đã ghi ${num(h)} giờ thực hành`);
  };

  return (
    <div className="fade-in">
      <PageHead title="Học tập & Kỹ năng" subtitle="Khóa học, giờ thực hành và những cột mốc đáng nhớ." />
      <div className="grid g4">
        <section className="card"><span className="icon-tile"><Icon name="cap" /></span><div className="stat-value" style={{ marginTop: 10 }}>{d.courses.filter((c) => c.done < c.total).length}</div><div className="stat-label">khóa đang học</div></section>
        <section className="card"><span className="icon-tile lav"><Icon name="clock" /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(totalHours)}<small>giờ</small></div><div className="stat-label">tổng thời gian học</div></section>
        <section className="card"><span className="icon-tile"><Icon name="bolt" /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(thisWeek)}<small>/ {d.weeklyTarget} giờ</small></div><div className="stat-label">tuần này</div></section>
        <section className="card"><span className="icon-tile amber"><Icon name="flag" /></span><div className="stat-value" style={{ marginTop: 10 }}>{d.milestones.filter((m) => m.done).length}/{d.milestones.length}</div><div className="stat-label">cột mốc đạt được</div></section>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Giờ thực hành mỗi tuần" icon="chart" glow>
          <BarChart labels={d.weekly.map((w) => w.w)} series={[{ name: 'Giờ', color: 'var(--mint)', values: d.weekly.map((w) => w.hours) }]} height={200} highlight={d.weekly.length - 1} />
          <div className="legend" style={{ marginTop: 6 }}><span>Mục tiêu {d.weeklyTarget} giờ/tuần · trung bình {num(d.weekly.reduce((s, w) => s + w.hours, 0) / d.weekly.length)} giờ</span></div>
        </Card>
        <Card title="Phân bổ theo kỹ năng" icon="pie">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut size={140} thickness={16} segments={sk.map((s, i) => ({ value: s.hours, color: d.courses.find((c) => c.skill === s.label).color }))}>
              <div><div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{num(totalHours)}</div><div className="muted" style={{ fontSize: 11 }}>giờ</div></div>
            </Donut>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              {sk.map((s) => <span key={s.label}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: d.courses.find((c) => c.skill === s.label).color, marginRight: 8 }} />{s.label} · <b className="num">{num(s.hours)}h</b></span>)}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Khóa học" icon="cap">
          <div className="list">
            {d.courses.map((c) => (
              <div className="row" key={c.id} style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div className="row-main"><div className="row-title">{c.title}</div><div className="row-sub">{c.provider} · {c.done}/{c.total} bài · {num(c.hours)} giờ</div></div>
                  {c.done >= c.total ? <span className="chip mint">Hoàn thành</span> : <b className="num">{pct(c.done, c.total)}%</b>}
                </div>
                <Progress value={pct(c.done, c.total)} style={{ marginTop: 8 }} tone={c.color === 'var(--lav)' ? 'lav' : ''} />
              </div>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor="l-c">Ghi giờ thực hành</label><select id="l-c" className="input" value={log.course} onChange={(e) => setLog({ ...log, course: e.target.value })}>{d.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
            <div className="field" style={{ flex: '0 1 90px' }}><label htmlFor="l-h">Giờ</label><input id="l-h" className="input" inputMode="decimal" value={log.hours} onChange={(e) => setLog({ ...log, hours: e.target.value })} /></div>
            <button className="btn sm" style={{ height: 42 }} onClick={addLog}><Icon name="plus" size={16} />Ghi</button>
          </div>
        </Card>
        <Card title="Cột mốc" icon="flag">
          <div style={{ display: 'grid' }}>
            {d.milestones.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'grid', justifyItems: 'center' }}>
                  <Check on={m.done} label={m.title} onClick={() => set((s) => ({ ...s, milestones: s.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) }))} />
                  {i < d.milestones.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 18, background: m.done ? 'var(--mint)' : 'var(--line-strong)' }} />}
                </div>
                <div style={{ paddingBottom: 14, minWidth: 0 }}>
                  <div className={`row-title ${m.done ? 'done-text' : ''}`}>{m.title}</div>
                  <div className="row-sub">{dmy(m.date)}{!m.done ? ` · ${relDays(m.date)}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
