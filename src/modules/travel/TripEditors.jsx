import { useState } from 'react';
import { addDays, dm, iso, parse, pct, uid, vnd, vndShort } from '../../core/format.js';
import { Card, Check } from '../../ui/common.jsx';
import { Donut, Progress } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';

// Trình sửa Lịch trình, Chi phí, Hành lý trong một chuyến đi.

const money = (s) => Number(String(s).replace(/\D/g, '')) || 0;
const moneyText = (n) => (n ? Number(n).toLocaleString('vi-VN') : '');
const COLORS = ['var(--mint)', 'var(--lav)', 'var(--sky)', 'var(--amber)', '#a8607a', '#6b7fb3'];

function IconButton({ icon, label, onClick, danger }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick} style={{ width: 34, height: 34, ...(danger ? { color: 'var(--rose)' } : {}) }}>
      <Icon name={icon} size={15} />
    </button>
  );
}

function FormButtons({ onCancel, onDelete, saveLabel = 'Lưu' }) {
  const [ask, setAsk] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="btn sm" type="submit"><Icon name="check" size={15} />{saveLabel}</button>
      <button className="btn sm ghost" type="button" onClick={onCancel}>Hủy</button>
      {onDelete && (
        <span style={{ marginLeft: 'auto' }}>{ask
          ? <span style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="btn sm" style={{ background: 'var(--rose)' }} onClick={onDelete}>Xóa hẳn</button><button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Không</button></span>
          : <button type="button" className="btn sm ghost" style={{ color: 'var(--rose)' }} onClick={() => setAsk(true)}><Icon name="trash" size={14} />Xóa</button>}</span>
      )}
    </div>
  );
}

/* ---------- Lịch trình ---------- */

function DayForm({ initial, trip, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ date: initial.date, title: initial.title || '', items: (initial.items || []).join('\n') });
  return (
    <form className="card glow" style={{ display: 'grid', gap: 10, padding: 14 }} onSubmit={(e) => {
      e.preventDefault();
      if (!f.date) return;
      onSave({ date: f.date, title: f.title.trim() || 'Không tên', items: f.items.split('\n').map((x) => x.trim()).filter(Boolean) });
    }}>
      <div className="form-row">
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="day-date">Ngày</label><input id="day-date" type="date" className="input" value={f.date} min={trip.start} max={trip.end} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
        <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor="day-title">Chủ đề trong ngày</label><input id="day-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ví dụ: Dạo phố cổ" /></div>
      </div>
      <div className="field"><label htmlFor="day-items">Hoạt động (mỗi dòng một việc)</label>
        <textarea id="day-items" rows={5} className="input" value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} placeholder={'08:00 Ăn sáng\n10:00 Tham quan bảo tàng\n19:00 Ăn tối'} />
      </div>
      <FormButtons onCancel={onCancel} onDelete={onDelete} />
    </form>
  );
}

export function ItineraryEditor({ trip, update, notify }) {
  const [editing, setEditing] = useState(null); // ngày đang sửa (date gốc) hoặc 'new'
  const days = [...trip.itinerary].sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set(days.map((d) => d.date));
  const nextDate = () => {
    for (let d = parse(trip.start); iso(d) <= trip.end; d = addDays(d, 1)) if (!used.has(iso(d))) return iso(d);
    return days.length ? iso(addDays(parse(days.at(-1).date), 1)) : trip.start;
  };
  const save = (orig, day) => {
    update((t) => {
      const rest = t.itinerary.filter((d) => d.date !== orig && d.date !== day.date);
      const merged = orig !== day.date && t.itinerary.find((d) => d.date === day.date);
      const next = merged ? { ...day, items: [...merged.items, ...day.items] } : day;
      return { ...t, itinerary: [...rest, next].sort((a, b) => a.date.localeCompare(b.date)) };
    });
    setEditing(null);
    notify(orig === 'new' ? 'Đã thêm ngày vào lịch trình' : 'Đã lưu lịch trình');
  };
  const remove = (date) => { update((t) => ({ ...t, itinerary: t.itinerary.filter((d) => d.date !== date) })); setEditing(null); notify('Đã xóa ngày khỏi lịch trình'); };
  const dayNo = (date) => Math.round((parse(date) - parse(trip.start)) / 86400000) + 1;

  return (
    <Card title="Lịch trình" icon="cal" action={editing !== 'new' && <button className="btn sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} />Thêm ngày</button>}>
      <div style={{ display: 'grid', gap: 14 }}>
        {editing === 'new' && <DayForm initial={{ date: nextDate() }} trip={trip} onCancel={() => setEditing(null)} onSave={(d) => save('new', d)} />}
        {days.length ? days.map((d, i) => (editing === d.date
          ? <DayForm key={d.date} initial={d} trip={trip} onCancel={() => setEditing(null)} onSave={(x) => save(d.date, x)} onDelete={() => remove(d.date)} />
          : (
            <div key={d.date} style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'grid', justifyItems: 'center', gridTemplateRows: 'auto 1fr' }}>
                <span style={{ width: 14, height: 14, borderRadius: 9, border: '3px solid var(--mint)', background: 'var(--bg)', marginTop: 3 }} />
                {i < days.length - 1 && <span style={{ width: 2, background: 'var(--line-strong)', marginBottom: -14 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div className="row-title" style={{ flex: 1 }}>Ngày {dayNo(d.date)} ({dm(d.date)}) · {d.title}</div>
                  <IconButton icon="pen" label="Sửa ngày này" onClick={() => setEditing(d.date)} />
                </div>
                {d.items.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--muted)', display: 'grid', gap: 3, fontSize: 13.5 }}>{d.items.map((x, k) => <li key={k}>{x}</li>)}</ul>}
              </div>
            </div>
          ))) : editing !== 'new' && <div className="empty">Chưa có lịch trình. Bấm “Thêm ngày” để lên kế hoạch từng ngày.</div>}
      </div>
    </Card>
  );
}

/* ---------- Chi phí ---------- */

function CostForm({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ label: initial.label || '', plan: moneyText(initial.plan), actual: moneyText(initial.actual) });
  const fmt = (k) => (e) => setF({ ...f, [k]: moneyText(money(e.target.value)) });
  return (
    <form className="card glow" style={{ display: 'grid', gap: 10, padding: 14 }} onSubmit={(e) => {
      e.preventDefault();
      if (!f.label.trim()) return;
      onSave({ label: f.label.trim(), plan: money(f.plan), actual: money(f.actual) });
    }}>
      <div className="field"><label htmlFor="c-label">Hạng mục</label><input id="c-label" className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ví dụ: Vé máy bay" required list="c-labels" />
        <datalist id="c-labels">{['Di chuyển', 'Lưu trú', 'Ăn uống', 'Tham quan', 'Mua sắm', 'Quà & phát sinh'].map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="c-plan">Dự trù (₫)</label><input id="c-plan" className="input num" inputMode="numeric" value={f.plan} onChange={fmt('plan')} placeholder="0" /></div>
        <div className="field"><label htmlFor="c-actual">Đã chi (₫)</label><input id="c-actual" className="input num" inputMode="numeric" value={f.actual} onChange={fmt('actual')} placeholder="0" /></div>
      </div>
      <FormButtons onCancel={onCancel} onDelete={onDelete} />
    </form>
  );
}

export function CostEditor({ trip, update, notify }) {
  const [editing, setEditing] = useState(null); // id hạng mục hoặc 'new'
  const costs = trip.costs;
  const planned = costs.reduce((s, c) => s + c.plan, 0);
  const spent = costs.reduce((s, c) => s + c.actual, 0);
  const save = (id, c) => {
    update((t) => ({ ...t, costs: id === 'new' ? [...t.costs, { id: uid(), ...c }] : t.costs.map((x) => (x.id === id ? { ...x, ...c } : x)) }));
    setEditing(null);
    notify(id === 'new' ? 'Đã thêm khoản chi' : 'Đã lưu khoản chi');
  };
  const remove = (id) => { update((t) => ({ ...t, costs: t.costs.filter((x) => x.id !== id) })); setEditing(null); notify('Đã xóa khoản chi'); };

  return (
    <div className="grid g-main">
      <Card title="Chi phí theo hạng mục" icon="pie" action={editing !== 'new' && <button className="btn sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} />Thêm</button>}>
        {costs.some((c) => c.plan > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Donut segments={costs.map((c, i) => ({ value: c.plan, color: COLORS[i % COLORS.length] }))} size={150} thickness={18}>
              <div><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{vndShort(planned)}</div><div className="muted" style={{ fontSize: 11 }}>dự trù</div></div>
            </Donut>
          </div>
        )}
        <div style={{ display: 'grid', gap: 12 }}>
          {editing === 'new' && <CostForm initial={{}} onCancel={() => setEditing(null)} onSave={(c) => save('new', c)} />}
          {costs.map((c, i) => (editing === c.id
            ? <CostForm key={c.id} initial={c} onCancel={() => setEditing(null)} onSave={(x) => save(c.id, x)} onDelete={() => remove(c.id)} />
            : (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                    <span style={{ minWidth: 0 }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: COLORS[i % COLORS.length], marginRight: 8 }} />{c.label}</span>
                    <span className="num" style={{ whiteSpace: 'nowrap', color: c.actual > c.plan && c.plan ? 'var(--rose)' : undefined }}>{vndShort(c.actual)} / {vndShort(c.plan)}</span>
                  </div>
                  <Progress value={pct(c.actual, c.plan)} style={{ marginTop: 6, height: 5 }} />
                </div>
                <IconButton icon="pen" label={`Sửa ${c.label}`} onClick={() => setEditing(c.id)} />
              </div>
            )))}
          {!costs.length && editing !== 'new' && <div className="empty">Chưa có khoản chi nào. Bấm “Thêm” để ghi dự trù.</div>}
        </div>
      </Card>
      <Card title="Đã chi" icon="wallet">
        <div className="stat-value">{vnd(spent)}</div>
        <div className="row-sub">trên dự trù {vnd(planned)}</div>
        <Progress value={pct(spent, planned)} style={{ marginTop: 12 }} />
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>{spent <= planned ? `Còn ${vnd(planned - spent)} cho các khoản chưa chi.` : `Đã vượt dự trù ${vnd(spent - planned)}.`} Bấm biểu tượng bút ở từng hạng mục để ghi số đã chi.</p>
      </Card>
    </div>
  );
}

/* ---------- Hành lý ---------- */

const GROUPS = ['Quần áo', 'Thiết bị', 'Giấy tờ', 'Cá nhân', 'Khác'];

export function PackingEditor({ trip, update }) {
  const [item, setItem] = useState('');
  const [group, setGroup] = useState('Quần áo');
  const [editMode, setEditMode] = useState(false);
  const packed = trip.packing.filter((p) => p.done).length;
  const groups = [...new Set([...GROUPS.filter((g) => trip.packing.some((p) => p.group === g)), ...trip.packing.map((p) => p.group)])];
  const allGroups = [...new Set([...GROUPS, ...groups])];
  const add = (e) => { e.preventDefault(); if (!item.trim()) return; update((t) => ({ ...t, packing: [...t.packing, { id: uid(), label: item.trim(), group, done: false }] })); setItem(''); };
  const toggle = (id) => update((t) => ({ ...t, packing: t.packing.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  const remove = (id) => update((t) => ({ ...t, packing: t.packing.filter((x) => x.id !== id) }));

  return (
    <Card title={`Đã soạn ${packed}/${trip.packing.length}`} icon="bag" action={trip.packing.length > 0 && <button className="btn sm ghost" onClick={() => setEditMode(!editMode)}>{editMode ? 'Xong' : <><Icon name="pen" size={14} />Sửa</>}</button>}>
      <Progress value={pct(packed, trip.packing.length)} style={{ marginBottom: 12 }} />
      {trip.packing.length ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
          {groups.map((g) => (
            <div key={g}>
              <div className="faint" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '4px 0' }}>{g}</div>
              {trip.packing.filter((p) => p.group === g).map((p) => (
                <div className="row" key={p.id} style={{ borderTop: 0, padding: '6px 0' }}>
                  <Check on={p.done} label={p.label} onClick={() => toggle(p.id)} />
                  <span className={p.done ? 'done-text' : ''} style={{ flex: 1 }}>{p.label}</span>
                  {editMode && <IconButton icon="trash" label={`Xóa ${p.label}`} danger onClick={() => remove(p.id)} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : <div className="empty">Chưa có món đồ nào.</div>}
      <form className="form-row" style={{ marginTop: 12, alignItems: 'flex-end' }} onSubmit={add}>
        <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor="pack-new">Thêm món đồ</label><input id="pack-new" className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ví dụ: Ô gấp" /></div>
        <div className="field" style={{ flex: '1 1 120px' }}><label htmlFor="pack-group">Nhóm</label><select id="pack-group" className="input" value={group} onChange={(e) => setGroup(e.target.value)}>{allGroups.map((g) => <option key={g}>{g}</option>)}</select></div>
        <button className="btn sm" type="submit" style={{ height: 44 }}><Icon name="plus" size={16} />Thêm</button>
      </form>
    </Card>
  );
}
