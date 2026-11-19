import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { daysFromToday, dm, dmy, parse, relDays, TODAY, todayIso, uid } from '../../core/format.js';
import { Card, Check, PageHead, Tabs } from '../../ui/common.jsx';
import { Progress, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { CATS, onTrack as isOnTrack, progress } from './data.js';

function Timeline({ goals }) {
  // Biểu đồ Gantt đơn giản: mỗi mục tiêu là một thanh từ ngày bắt đầu tới hạn chót.
  const lo = new Date(TODAY.getFullYear(), TODAY.getMonth() - 4, 1), hi = new Date(TODAY.getFullYear(), TODAY.getMonth() + 5, 1);
  const span = hi - lo;
  const x = (d) => Math.max(0, Math.min(100, ((parse(d) - lo) / span) * 100));
  const months = Array.from({ length: 9 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth() - 4 + i, 1));
  const todayX = ((TODAY - lo) / span) * 100;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 560, position: 'relative', paddingTop: 22 }}>
        <div style={{ position: 'absolute', inset: '0 0 0 150px' }}>
          {months.map((mo) => (
            <span key={+mo} className="faint" style={{ position: 'absolute', left: `${((mo - lo) / span) * 100}%`, top: 0, fontSize: 11 }}>T{mo.getMonth() + 1}</span>
          ))}
          <div style={{ position: 'absolute', left: `${todayX}%`, top: 16, bottom: 0, width: 2, background: 'var(--lav)', boxShadow: '0 0 10px var(--lav)' }} />
        </div>
        {goals.map((g) => {
          const p = progress(g);
          const a = x(g.start), b = x(g.deadline);
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', height: 34 }}>
              <div style={{ width: 150, flexShrink: 0, fontSize: 12.5, paddingRight: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
              <div style={{ position: 'relative', flex: 1, height: 12 }}>
                <div style={{ position: 'absolute', left: `${a}%`, width: `${Math.max(1, b - a)}%`, height: '100%', borderRadius: 99, background: 'var(--track)' }}>
                  <div style={{ width: `${p}%`, height: '100%', borderRadius: 99, background: p === 100 ? 'var(--lav)' : 'linear-gradient(90deg,var(--mint-2),var(--mint))' }} />
                </div>
                {g.milestones.map((ms) => (
                  <span key={ms.id} title={ms.title} style={{ position: 'absolute', left: `calc(${x(ms.due)}% - 4px)`, top: 2, width: 8, height: 8, borderRadius: 2, transform: 'rotate(45deg)', background: ms.done ? 'var(--mint)' : 'var(--bg)', border: '1.5px solid var(--mint)' }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [data, set] = useModule('goals');
  const notify = useNotify();
  const [filter, setFilter] = useState('active');
  const [open, setOpen] = useState('g1');
  const [draft, setDraft] = useState({ title: '', cat: 'life', deadline: `${TODAY.getFullYear()}-12-31` });
  const [ms, setMs] = useState({ title: '', due: todayIso });
  const [edit, setEdit] = useState(null); // { id, title, cat, start, deadline }
  const [msEdit, setMsEdit] = useState(null); // { gid, id, title, due }

  const goals = data.goals;
  const list = goals.filter((g) => (filter === 'all' ? true : filter === 'done' ? progress(g) === 100 : progress(g) < 100));
  const active = goals.filter((g) => progress(g) < 100);
  const onTrack = active.filter(isOnTrack);
  const avg = Math.round(active.reduce((s, g) => s + progress(g), 0) / (active.length || 1));

  const upd = (gid, fn) => set((s) => ({ ...s, goals: s.goals.map((g) => (g.id === gid ? fn(g) : g)) }));
  const toggleMs = (gid, mid) => upd(gid, (g) => ({ ...g, milestones: g.milestones.map((x) => (x.id === mid ? { ...x, done: !x.done } : x)) }));
  const addMs = (gid) => {
    if (!ms.title.trim()) return;
    upd(gid, (g) => ({ ...g, milestones: [...g.milestones, { id: uid(), title: ms.title.trim(), due: ms.due, done: false }].sort((a, b) => a.due.localeCompare(b.due)) }));
    setMs({ title: '', due: todayIso });
    notify('Đã thêm cột mốc');
  };
  const saveGoal = (e) => {
    e.preventDefault();
    if (!edit.title.trim()) return notify('Đặt tên cho mục tiêu');
    if (edit.deadline < edit.start) return notify('Hạn hoàn thành phải sau ngày bắt đầu');
    upd(edit.id, (g) => ({ ...g, title: edit.title.trim(), cat: edit.cat, start: edit.start, deadline: edit.deadline }));
    setEdit(null);
    notify('Đã lưu mục tiêu');
  };
  const removeGoal = (g) => {
    if (!window.confirm(`Xóa mục tiêu "${g.title}" cùng ${g.milestones.length} cột mốc?`)) return;
    set((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== g.id) }));
    setEdit(null); setOpen(null);
    notify('Đã xóa mục tiêu');
  };
  const saveMs = (e) => {
    e.preventDefault();
    if (!msEdit.title.trim()) return notify('Nhập tên cột mốc');
    upd(msEdit.gid, (g) => ({ ...g, milestones: g.milestones.map((x) => (x.id === msEdit.id ? { ...x, title: msEdit.title.trim(), due: msEdit.due } : x)).sort((a, b) => a.due.localeCompare(b.due)) }));
    setMsEdit(null);
    notify('Đã lưu cột mốc');
  };
  const removeMs = (gid, x) => {
    if (!window.confirm(`Xóa cột mốc "${x.title}"?`)) return;
    upd(gid, (g) => ({ ...g, milestones: g.milestones.filter((m) => m.id !== x.id) }));
    setMsEdit(null);
    notify('Đã xóa cột mốc');
  };
  const addGoal = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return notify('Đặt tên cho mục tiêu');
    const id = uid();
    set((s) => ({ ...s, goals: [{ id, title: draft.title.trim(), cat: draft.cat, start: todayIso, deadline: draft.deadline, milestones: [] }, ...s.goals] }));
    setDraft({ title: '', cat: 'life', deadline: `${TODAY.getFullYear()}-12-31` });
    setOpen(id); setFilter('active');
    notify('Đã tạo mục tiêu');
  };

  return (
    <div className="fade-in">
      <PageHead title="Mục tiêu" subtitle="Biến kế hoạch thành tiến độ thật." />

      <div className="grid g-main">
        <Card title="Lộ trình mục tiêu" icon="chart" glow action={<span className="chip lav">Hôm nay {dm(todayIso)}</span>}>
          <Timeline goals={goals} />
          <div className="legend" style={{ marginTop: 10 }}><span><i style={{ background: 'var(--mint)' }} />Tiến độ</span><span><i style={{ background: 'var(--lav)' }} />Hôm nay / đã xong</span><span>◆ Cột mốc</span></div>
        </Card>
        <Card title="Tổng kết" icon="target">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring value={avg} size={120} thickness={12}><div><div className="num" style={{ fontSize: 28, fontWeight: 600 }}>{avg}%</div><div className="muted" style={{ fontSize: 11 }}>tiến độ TB</div></div></Ring>
            <div style={{ display: 'grid', gap: 10 }}>
              <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{onTrack.length}/{active.length}</div><div className="muted" style={{ fontSize: 12.5 }}>đang đúng tiến độ</div></div>
              <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{goals.length - active.length}</div><div className="muted" style={{ fontSize: 12.5 }}>đã hoàn thành</div></div>
            </div>
          </div>
          <form onSubmit={addGoal} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <div className="field"><label htmlFor="g-title">Mục tiêu mới</label><input id="g-title" className="input" placeholder="Ví dụ: Chạy half marathon" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="g-cat">Lĩnh vực</label>
                <select id="g-cat" className="input" value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>
              <div className="field"><label htmlFor="g-dl">Hạn hoàn thành</label><input id="g-dl" type="date" className="input" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></div>
            </div>
            <button className="btn" type="submit"><Icon name="plus" size={18} />Tạo mục tiêu</button>
          </form>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'active', label: `Đang thực hiện (${active.length})` }, { id: 'done', label: 'Hoàn thành' }, { id: 'all', label: 'Tất cả' }]} />
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', alignItems: 'start' }}>
        {list.map((g) => {
          const p = progress(g); const c = CATS[g.cat] || CATS.life; const isOpen = open === g.id;
          const left = daysFromToday(g.deadline);
          return (
            <Card key={g.id}>
              <button onClick={() => setOpen(isOpen ? null : g.id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', width: '100%' }} aria-expanded={isOpen}>
                <span className={`icon-tile ${c.tone}`}><Icon name={c.icon} size={19} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="row-title" style={{ display: 'block' }}>{g.title}</span>
                  <span className="row-sub">{p === 100 ? 'Đã hoàn thành' : left >= 0 ? `Hạn ${dmy(g.deadline)} · còn ${left} ngày` : `Quá hạn ${-left} ngày`}</span>
                </span>
                <b className="num" style={{ fontSize: 17 }}>{p}%</b>
                <Icon name={isOpen ? 'chevD' : 'chevR'} size={18} className="muted" />
              </button>
              <Progress value={p} tone={c.tone === 'lav' ? 'lav' : ''} style={{ marginTop: 12 }} />
              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  {edit?.id === g.id ? (
                    <form className="gl-edit" onSubmit={saveGoal}>
                      <div className="field"><label htmlFor={`ge-t-${g.id}`}>Tên mục tiêu</label><input id={`ge-t-${g.id}`} className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus /></div>
                      <div className="field"><label htmlFor={`ge-c-${g.id}`}>Lĩnh vực</label>
                        <select id={`ge-c-${g.id}`} className="input" value={edit.cat} onChange={(e) => setEdit({ ...edit, cat: e.target.value })}>{Object.entries(CATS).map(([k, c2]) => <option key={k} value={k}>{c2.label}</option>)}</select></div>
                      <div className="form-row">
                        <div className="field"><label htmlFor={`ge-s-${g.id}`}>Bắt đầu</label><input id={`ge-s-${g.id}`} type="date" className="input" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></div>
                        <div className="field"><label htmlFor={`ge-d-${g.id}`}>Hạn hoàn thành</label><input id={`ge-d-${g.id}`} type="date" className="input" value={edit.deadline} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} /></div>
                      </div>
                      <div className="gl-actions">
                        <button type="button" className="btn sm ghost danger" onClick={() => removeGoal(g)}><Icon name="trash" size={15} />Xóa mục tiêu</button>
                        <span style={{ flex: 1 }} />
                        <button type="button" className="btn sm ghost" onClick={() => setEdit(null)}>Hủy</button>
                        <button type="submit" className="btn sm">Lưu</button>
                      </div>
                    </form>
                  ) : (
                    <div className="gl-actions" style={{ marginBottom: 8 }}>
                      <span className="faint" style={{ fontSize: 12.5 }}>{c.label} · từ {dmy(g.start)}</span>
                      <span style={{ flex: 1 }} />
                      <button className="btn sm ghost" onClick={() => setEdit({ id: g.id, title: g.title, cat: g.cat, start: g.start, deadline: g.deadline })}><Icon name="pen" size={15} />Sửa mục tiêu</button>
                    </div>
                  )}
                  <div className="list">
                    {g.milestones.map((x) => (msEdit?.id === x.id ? (
                      <form className="gl-ms-edit" key={x.id} onSubmit={saveMs}>
                        <input className="input" aria-label="Tên cột mốc" value={msEdit.title} onChange={(e) => setMsEdit({ ...msEdit, title: e.target.value })} autoFocus />
                        <input className="input" type="date" aria-label="Hạn cột mốc" value={msEdit.due} onChange={(e) => setMsEdit({ ...msEdit, due: e.target.value })} />
                        <div className="gl-actions">
                          <button type="button" className="btn sm ghost danger" onClick={() => removeMs(g.id, x)}><Icon name="trash" size={15} />Xóa</button>
                          <span style={{ flex: 1 }} />
                          <button type="button" className="btn sm ghost" onClick={() => setMsEdit(null)}>Hủy</button>
                          <button type="submit" className="btn sm">Lưu</button>
                        </div>
                      </form>
                    ) : (
                      <div className="row" key={x.id}>
                        <Check on={x.done} onClick={() => toggleMs(g.id, x.id)} label={`Đánh dấu ${x.title}`} />
                        <button className="row-main gl-ms-btn" onClick={() => setMsEdit({ gid: g.id, id: x.id, title: x.title, due: x.due })} aria-label={`Sửa cột mốc ${x.title}`}>
                          <div className={`row-title ${x.done ? 'done-text' : ''}`} style={{ fontWeight: 500 }}>{x.title}</div>
                        </button>
                        <span className={`chip ${x.done ? '' : x.due < todayIso ? 'rose' : x.due === todayIso ? 'mint' : ''}`}>{x.done ? dm(x.due) : relDays(x.due)}</span>
                        <button className="bare-btn gl-pen" onClick={() => setMsEdit({ gid: g.id, id: x.id, title: x.title, due: x.due })} aria-label={`Sửa cột mốc ${x.title}`}><Icon name="pen" size={15} /></button>
                      </div>
                    )))}
                    {!g.milestones.length && <div className="empty">Chưa có cột mốc. Chia mục tiêu thành các bước nhỏ ở dưới.</div>}
                  </div>
                  <div className="form-row" style={{ marginTop: 10 }}>
                    <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor={`ms-${g.id}`}>Cột mốc mới</label><input id={`ms-${g.id}`} className="input" value={ms.title} onChange={(e) => setMs({ ...ms, title: e.target.value })} placeholder="Tên cột mốc" /></div>
                    <div className="field"><label htmlFor={`msd-${g.id}`}>Hạn</label><input id={`msd-${g.id}`} type="date" className="input" value={ms.due} onChange={(e) => setMs({ ...ms, due: e.target.value })} /></div>
                    <button className="btn sm" onClick={() => addMs(g.id)} type="button" style={{ height: 42 }}><Icon name="plus" size={16} />Thêm</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
