import { useState } from 'react';
import { TODAY, uid, vnd, vndShort } from '../../core/format.js';
import { Card, Cover, PhotoPicker } from '../../ui/common.jsx';
import { deletePhoto } from '../../core/photos.js';
import Icon from '../../ui/Icon.jsx';
import { normDream, normPlan, PLAN_STATUS, SCENES } from './data.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const money = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
const sky = (kind) => SCENES[kind]?.sky || 'dawn';

function SceneSelect({ id, value, onChange }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(SCENES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
    </select>
  );
}

function ConfirmDelete({ onYes, label }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setAsk(true)} aria-label={`Xóa ${label}`}><Icon name="trash" size={15} /></button>;
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button className="btn sm" style={{ background: 'var(--rose)' }} onClick={onYes}>Xóa</button>
      <button className="btn sm ghost" onClick={() => setAsk(false)}>Hủy</button>
    </span>
  );
}

/* ---------------- Kế hoạch năm ---------------- */
const emptyPlan = (year) => ({ name: '', place: '', year, month: year === TODAY.getFullYear() ? TODAY.getMonth() + 1 : 1, dates: '', budget: '', status: 'idea', scene: 'sea', note: '' });

function PlanForm({ initial, years, onSave, onCancel, title }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave({ ...f, name: f.name.trim(), place: f.place.trim(), year: Number(f.year), month: Number(f.month), budget: money(f.budget) });
  };
  const fid = initial.id || 'new';
  return (
    <Card title={title} icon={initial.id ? 'pen' : 'plus'} glow>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <div className="form-row">
          <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor={`p-name-${fid}`}>Điểm đến</label><input id={`p-name-${fid}`} className="input" value={f.name} onChange={set('name')} placeholder="Ví dụ: Phú Yên" required /></div>
          <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor={`p-place-${fid}`}>Tỉnh / quốc gia</label><input id={`p-place-${fid}`} className="input" value={f.place} onChange={set('place')} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label htmlFor={`p-year-${fid}`}>Năm</label><select id={`p-year-${fid}`} className="input" value={f.year} onChange={set('year')}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          <div className="field"><label htmlFor={`p-month-${fid}`}>Tháng</label><select id={`p-month-${fid}`} className="input" value={f.month} onChange={set('month')}>{MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}</select></div>
          <div className="field"><label htmlFor={`p-dates-${fid}`}>Ngày đi (nếu có)</label><input id={`p-dates-${fid}`} className="input" value={f.dates} onChange={set('dates')} placeholder="14–17/5" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label htmlFor={`p-budget-${fid}`}>Dự trù (₫)</label><input id={`p-budget-${fid}`} className="input" inputMode="numeric" value={f.budget || ''} onChange={set('budget')} placeholder="8000000" /></div>
          <div className="field"><label htmlFor={`p-status-${fid}`}>Trạng thái</label><select id={`p-status-${fid}`} className="input" value={f.status} onChange={set('status')}>{Object.entries(PLAN_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></div>
          <div className="field"><label htmlFor={`p-scene-${fid}`}>Tranh minh họa (khi chưa có ảnh)</label><SceneSelect id={`p-scene-${fid}`} value={f.scene} onChange={(v) => setF({ ...f, scene: v })} /></div>
        </div>
        <PhotoPicker id={`p-photo-${fid}`} photo={f.photo} kind={f.scene} sky={sky(f.scene)} onChange={(photo) => setF({ ...f, photo })} />
        <div className="field"><label htmlFor={`p-note-${fid}`}>Ghi chú</label><input id={`p-note-${fid}`} className="input" value={f.note} onChange={set('note')} placeholder="Muốn làm gì ở đó?" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit"><Icon name="check" size={17} />{initial.id ? 'Lưu thay đổi' : 'Thêm kế hoạch'}</button>
          <button className="btn ghost" type="button" onClick={onCancel}>Hủy</button>
        </div>
      </form>
    </Card>
  );
}

function MonthStrip({ plans, trips, year }) {
  const isNow = year === TODAY.getFullYear();
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(52px, 1fr))', gap: 6, minWidth: 640 }}>
        {MONTHS.map((m) => {
          const ps = plans.filter((p) => p.month === m);
          const ts = trips.filter((t) => Number(t.start.slice(5, 7)) === m);
          const cur = isNow && m === TODAY.getMonth() + 1;
          const past = isNow && m < TODAY.getMonth() + 1;
          return (
            <div key={m} style={{ borderRadius: 12, padding: '8px 6px', minHeight: 86, background: cur ? 'var(--mint-soft)' : 'var(--surface)', border: `1px solid ${cur ? 'var(--mint-border)' : 'var(--line)'}`, opacity: past ? 0.6 : 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: cur ? 'var(--mint)' : 'var(--muted)', marginBottom: 6 }}>T{m}</div>
              <div style={{ display: 'grid', gap: 3 }}>
                {ts.map((t) => <div key={t.id} title={`Chuyến đi: ${t.name}`} style={{ fontSize: 10.5, padding: '3px 5px', borderRadius: 6, background: 'var(--mint)', color: 'var(--on-accent)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>)}
                {ps.map((p) => <div key={p.id} title={p.name} style={{ fontSize: 10.5, padding: '3px 5px', borderRadius: 6, border: '1px dashed var(--lav)', color: 'var(--lav)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearPlans({ data, set, notify, onMakeTrip }) {
  const thisYear = TODAY.getFullYear();
  const years = [thisYear, thisYear + 1];
  const [year, setYear] = useState(thisYear);
  const [editing, setEditing] = useState(null); // 'new' | id
  const plans = (data.yearPlan || []).map((p) => normPlan(p, thisYear + 1));
  const save = (list) => set((s) => ({ ...s, yearPlan: list }));
  const shown = plans.filter((p) => p.year === year).sort((a, b) => a.month - b.month);
  const trips = data.trips.filter((t) => t.start.startsWith(String(year)));
  const budget = shown.reduce((s, p) => s + (p.budget || 0), 0);
  const editingPlan = editing && editing !== 'new' ? plans.find((p) => p.id === editing) : null;

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="tabs seg" style={{ margin: 0 }}>
          {years.map((y) => <button key={y} className={`tab ${year === y ? 'active' : ''}`} onClick={() => { setYear(y); setEditing(null); }}>{y === thisYear ? `Năm nay · ${y}` : `Năm tới · ${y}`}</button>)}
        </div>
        {editing !== 'new' && <button className="btn" onClick={() => setEditing('new')}><Icon name="plus" size={18} />Thêm kế hoạch</button>}
      </div>

      {editing === 'new' && (
        <PlanForm title={`Kế hoạch mới cho ${year}`} years={years} initial={emptyPlan(year)} onCancel={() => setEditing(null)}
          onSave={(p) => { save([...plans, { ...p, id: uid() }]); setEditing(null); setYear(p.year); notify('Đã thêm kế hoạch'); }} />
      )}

      <Card title={`Lịch du lịch ${year}`} icon="cal" action={<span className="chip">{shown.length} kế hoạch · {trips.length} chuyến đã đặt lịch</span>}>
        <MonthStrip plans={shown} trips={trips} year={year} />
        <div className="legend" style={{ marginTop: 10 }}>
          <span><i style={{ background: 'var(--mint)' }} />Chuyến đi đã có lịch</span>
          <span><i style={{ border: '1px dashed var(--lav)', background: 'transparent' }} />Kế hoạch</span>
          {budget > 0 && <span>Tổng dự trù kế hoạch: <b className="num" style={{ color: 'var(--text)' }}>{vnd(budget)}</b></span>}
        </div>
      </Card>

      {shown.length === 0 && editing !== 'new' && (
        <Card><div className="empty">Chưa có kế hoạch nào cho {year}. Bấm "Thêm kế hoạch" để ghi lại nơi bạn muốn đến.</div></Card>
      )}

      <div className="grid g3" style={{ alignItems: 'start' }}>
        {shown.map((p) => (editing === p.id && editingPlan ? (
          <div key={p.id} style={{ gridColumn: '1 / -1' }}>
            <PlanForm title={`Sửa: ${p.name}`} years={years} initial={{ ...editingPlan, budget: editingPlan.budget || '' }} onCancel={() => setEditing(null)}
              onSave={(np) => { save(plans.map((x) => (x.id === p.id ? { ...x, ...np } : x))); setEditing(null); setYear(np.year); notify('Đã lưu kế hoạch'); }} />
          </div>
        ) : (
          <section key={p.id} className="card" style={{ padding: 10 }}>
            <Cover photo={p.photo} kind={p.scene} sky={sky(p.scene)} height={130} radius={14}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10 }}>
                <span className="chip lav">T{p.month}/{p.year}</span>
                <span className={`chip ${PLAN_STATUS[p.status]?.chip || ''}`}>{PLAN_STATUS[p.status]?.label}</span>
              </div>
            </Cover>
            <div style={{ padding: '10px 6px 4px', display: 'grid', gap: 3 }}>
              <div className="row-title" style={{ fontSize: 16 }}>{p.name}</div>
              {p.place && <div className="row-sub" style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="pin" size={13} />{p.place}</div>}
              <div className="row-sub" style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="cal" size={13} />{p.dates || 'Chưa chốt ngày'}</div>
              {p.budget > 0 && <div className="row-sub" style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="wallet" size={13} />Dự trù {vndShort(p.budget)}</div>}
              {p.note && <div className="row-sub" style={{ fontStyle: 'italic' }}>{p.note}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn sm ghost" onClick={() => setEditing(p.id)}><Icon name="pen" size={14} />Sửa</button>
                {p.status !== 'done' && <button className="btn sm ghost" onClick={() => onMakeTrip(p)} title="Tạo chuyến đi chi tiết với lịch trình, chi phí và hành lý"><Icon name="plane" size={14} />Tạo chuyến đi</button>}
                <span style={{ marginLeft: 'auto' }}><ConfirmDelete label={p.name} onYes={() => { deletePhoto(p.photo); save(plans.filter((x) => x.id !== p.id)); notify('Đã xóa kế hoạch'); }} /></span>
              </div>
            </div>
          </section>
        )))}
      </div>
    </div>
  );
}

/* ---------------- Kế hoạch 10 năm ---------------- */
function DreamForm({ initial, years, onSave, onCancel, title }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fid = initial.id || 'new';
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; onSave({ ...f, name: f.name.trim(), detail: f.detail.trim(), year: Number(f.year), budget: money(f.budget) }); }}
      className="card glow" style={{ display: 'grid', gap: 10 }}>
      {title && <h3 className="card-title"><Icon name={initial.id ? 'pen' : 'plus'} size={18} />{title}</h3>}
      <div className="form-row">
        <div className="field" style={{ flex: '0 1 110px' }}><label htmlFor={`d-year-${fid}`}>Năm</label><select id={`d-year-${fid}`} className="input" value={f.year} onChange={set('year')}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor={`d-name-${fid}`}>Quốc gia / điểm đến</label><input id={`d-name-${fid}`} className="input" value={f.name} onChange={set('name')} placeholder="Ví dụ: Hàn Quốc" required /></div>
      </div>
      <div className="field"><label htmlFor={`d-detail-${fid}`}>Chi tiết</label><input id={`d-detail-${fid}`} className="input" value={f.detail} onChange={set('detail')} placeholder="Thành phố, mùa, trải nghiệm muốn có" /></div>
      <div className="form-row">
        <div className="field"><label htmlFor={`d-budget-${fid}`}>Ước tính chi phí (₫)</label><input id={`d-budget-${fid}`} className="input" inputMode="numeric" value={f.budget || ''} onChange={set('budget')} /></div>
        <div className="field"><label htmlFor={`d-scene-${fid}`}>Tranh minh họa (khi chưa có ảnh)</label><SceneSelect id={`d-scene-${fid}`} value={f.scene} onChange={(v) => setF({ ...f, scene: v })} /></div>
      </div>
      <PhotoPicker id={`d-photo-${fid}`} photo={f.photo} kind={f.scene} sky={sky(f.scene)} onChange={(photo) => setF({ ...f, photo })} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit"><Icon name="check" size={17} />{initial.id ? 'Lưu thay đổi' : 'Thêm vào kế hoạch'}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}

function YearCard({ year, items, years, editing, setEditing, onAdd, onUpdate, onRemove, last }) {
  const total = items.reduce((s, d) => s + (d.budget || 0), 0);
  const doneN = items.filter((d) => d.done).length;
  const cols = Math.min(3, Math.max(1, items.length));
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'grid', justifyItems: 'center', gridTemplateRows: 'auto 1fr' }}>
        <span style={{ width: 14, height: 14, borderRadius: 9, border: '3px solid var(--mint)', background: items.length && doneN === items.length ? 'var(--mint)' : 'var(--bg)', marginTop: 22 }} />
        {!last && <span style={{ width: 2, background: 'var(--mint)', opacity: 0.5 }} />}
      </div>
      <section className="card" style={{ flex: 1, minWidth: 0, padding: 12, marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: items.length ? 10 : 0 }}>
          <span className="num" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{year}</span>
          {items.length > 0 && <span className="chip mint">{items.length} điểm đến{doneN ? ` · đã đi ${doneN}` : ''}</span>}
          {total > 0 && <span className="chip">{vndShort(total)}</span>}
          <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setEditing(`new-${year}`)}><Icon name="plus" size={14} />Thêm điểm đến</button>
        </div>
        {items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>
            {items.map((d) => (
              <Cover key={d.id} photo={d.photo} kind={d.scene} sky={sky(d.scene)} height={items.length > 2 ? 110 : 140} radius={12}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: 10 }}>
                  {d.done && <span className="chip mint" style={{ alignSelf: 'flex-start', marginBottom: 'auto' }}>Đã đi</span>}
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{d.name}</div>
                </div>
              </Cover>
            ))}
          </div>
        )}
        {items.length === 0 && editing !== `new-${year}` && <div className="row-sub" style={{ marginTop: 8 }}>Chưa có điểm đến cho năm này.</div>}
        <div className="list" style={{ marginTop: items.length ? 8 : 0 }}>
          {items.map((d) => (editing === d.id ? (
            <div key={d.id} style={{ padding: '8px 0' }}>
              <DreamForm title={`Sửa: ${d.name}`} years={[...new Set([d.year, ...years])].sort()} initial={d} onCancel={() => setEditing(null)} onSave={(nd) => onUpdate(d.id, nd)} />
            </div>
          ) : (
            <div className="row" key={d.id} style={{ flexWrap: 'wrap' }}>
              <div className="row-main" style={{ minWidth: 160 }}>
                <div className={`row-title ${d.done ? 'done-text' : ''}`}>{d.name}</div>
                <div className="row-sub">{[d.detail, d.budget > 0 ? `Ước tính ${vndShort(d.budget)}` : ''].filter(Boolean).join(' · ') || 'Chưa có chi tiết'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="icon-btn" style={{ width: 34, height: 34, color: d.done ? 'var(--mint)' : undefined, borderColor: d.done ? 'var(--mint)' : undefined }} onClick={() => onUpdate(d.id, { done: !d.done })} aria-pressed={d.done} aria-label={`Đánh dấu đã đi ${d.name}`} title="Đánh dấu đã đi"><Icon name="check" size={15} /></button>
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setEditing(d.id)} aria-label={`Sửa ${d.name}`}><Icon name="pen" size={15} /></button>
                <ConfirmDelete label={d.name} onYes={() => onRemove(d)} />
              </div>
            </div>
          )))}
        </div>
        {editing === `new-${year}` && (
          <div style={{ marginTop: 10 }}>
            <DreamForm title={`Thêm điểm đến năm ${year}`} years={years} initial={{ year, name: '', detail: '', budget: '', scene: 'mountain', photo: null }} onCancel={() => setEditing(null)} onSave={onAdd} />
          </div>
        )}
      </section>
    </div>
  );
}

export function DecadePlans({ data, set, notify }) {
  const start = TODAY.getFullYear() + 1;
  const years = Array.from({ length: 10 }, (_, i) => start + i);
  const [editing, setEditing] = useState(null); // id | 'new-<year>'
  const [showEmpty, setShowEmpty] = useState(false);
  const dreams = (data.decade || []).map(normDream);
  const save = (list) => set((s) => ({ ...s, decade: list }));
  const inRange = dreams.filter((d) => d.year >= start && d.year < start + 10);
  const covered = new Set(inRange.map((d) => d.year)).size;
  const total = inRange.reduce((s, d) => s + (d.budget || 0), 0);
  const doneN = dreams.filter((d) => d.done).length;
  const allYears = [...new Set([...dreams.map((d) => d.year), ...(showEmpty ? years : []), ...(editing?.startsWith?.('new-') ? [Number(editing.slice(4))] : [])])].sort((a, b) => a - b);
  const byYear = (y) => dreams.filter((d) => d.year === y).sort((a, b) => a.name.localeCompare(b.name));

  const onAdd = (d) => { save([...dreams, { ...d, id: uid(), done: false }]); setEditing(null); notify(`Đã thêm ${d.name} vào năm ${d.year}`); };
  const onUpdate = (id, patch) => { save(dreams.map((x) => (x.id === id ? { ...x, ...patch } : x))); if (!('done' in patch && Object.keys(patch).length === 1)) { setEditing(null); notify('Đã lưu'); } };
  const onRemove = (d) => { deletePhoto(d.photo); save(dreams.filter((x) => x.id !== d.id)); notify(`Đã xóa ${d.name}`); };

  return (
    <div className="grid g-main" style={{ alignItems: 'start' }}>
      <div className="stack" style={{ gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setEditing(`new-${years.find((y) => byYear(y).length < 2) || start}`)}><Icon name="plus" size={18} />Thêm điểm đến</button>
          <button className="btn ghost" onClick={() => setShowEmpty(!showEmpty)}>{showEmpty ? 'Ẩn năm chưa có kế hoạch' : 'Hiện đủ 10 năm'}</button>
        </div>
        {allYears.length === 0 && <Card><div className="empty">Chưa có điểm đến nào. Thêm nơi bạn muốn đến trong 10 năm tới.</div></Card>}
        {allYears.map((y, i) => (
          <YearCard key={y} year={y} items={byYear(y)} years={years} editing={editing} setEditing={setEditing}
            onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove} last={i === allYears.length - 1} />
        ))}
      </div>
      <Card title={`${start} – ${start + 9}`} icon="layers">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {years.map((y) => { const has = byYear(y); return (
            <button key={y} onClick={() => setEditing(`new-${y}`)} title={has.length ? has.map((d) => d.name).join(', ') : `Thêm điểm đến cho ${y}`}
              style={{ padding: '8px 4px', borderRadius: 10, textAlign: 'center', background: has.length ? 'var(--mint-soft)' : 'var(--surface)', border: `1px solid ${has.length ? 'var(--mint-border)' : 'var(--line)'}`, minWidth: 0 }}>
              <div className="num" style={{ fontSize: 13, fontWeight: 600, color: has.length ? 'var(--mint)' : 'var(--faint)' }}>{y}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{has.length ? `${has.length} nơi` : '–'}</div>
            </button>); })}
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 14, fontSize: 13 }}>
          <span><b className="num">{inRange.length}</b> điểm đến trong <b className="num">{covered}/10</b> năm</span>
          <span><b className="num">{doneN}</b> điểm đến đã hoàn thành</span>
          {total > 0 && <span>Tổng ước tính <b className="num">{vnd(total)}</b>, khoảng <b className="num">{vndShort(total / 10 / 12)}</b>/tháng nếu tiết kiệm đều</span>}
          <span className="faint" style={{ fontSize: 12 }}>Bấm vào một năm để thêm điểm đến cho năm đó.</span>
        </div>
      </Card>
    </div>
  );
}
