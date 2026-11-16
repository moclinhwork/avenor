import { useEffect, useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { addDays, daysBetween, iso, daysFromToday, dm, dmy, parse, pct, TODAY, todayIso, uid, vnd, vndShort } from '../../core/format.js';
import { Card, Cover, PageHead, PhotoPicker, Tabs } from '../../ui/common.jsx';
import { BarChart } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { DecadePlans, YearPlans } from './Plans.jsx';
import { SCENES } from './data.js';
import { CostEditor, ItineraryEditor, PackingEditor } from './TripEditors.jsx';
import { MediaEditor } from './TripMedia.jsx';

const range = (t) => `${dm(t.start)} – ${dmy(t.end)}`;
const nights = (t) => daysBetween(parse(t.start), parse(t.end));

function TripRow({ t, onOpen }) {
  return (
    <button onClick={onOpen} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, textAlign: 'left', width: '100%' }}>
      <div style={{ width: 92, flexShrink: 0 }}><Cover photo={t.photo} kind={t.scene} sky={t.sky} height={68} radius={12} /></div>
      <div className="row-main">
        <div className="row-title" style={{ fontSize: 16 }}>{t.name}</div>
        <div className="row-sub">{range(t)}</div>
        <div className="row-sub" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Icon name="pin" size={13} />{t.place}</div>
      </div>
      <Icon name="chevR" size={18} className="muted" />
    </button>
  );
}

function TripInfoForm({ trip, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ name: trip.name, place: trip.place, start: trip.start, end: trip.end, travelers: trip.travelers, stay: trip.stay, scene: trip.scene, note: trip.note || '', photo: trip.photo || null });
  const [ask, setAsk] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card glow" style={{ display: 'grid', gap: 10, marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || f.end < f.start) return; onSave({ ...f, sky: SCENES[f.scene]?.sky || trip.sky }); }}>
      <div className="form-row">
        <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor="ti-name">Điểm đến</label><input id="ti-name" className="input" value={f.name} onChange={set('name')} required /></div>
        <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor="ti-place">Tỉnh / quốc gia</label><input id="ti-place" className="input" value={f.place} onChange={set('place')} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="ti-start">Ngày đi</label><input id="ti-start" type="date" className="input" value={f.start} onChange={set('start')} /></div>
        <div className="field"><label htmlFor="ti-end">Ngày về</label><input id="ti-end" type="date" className="input" value={f.end} min={f.start} onChange={set('end')} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="ti-trav">Người đi</label><input id="ti-trav" className="input" value={f.travelers} onChange={set('travelers')} /></div>
        <div className="field"><label htmlFor="ti-stay">Lưu trú</label><input id="ti-stay" className="input" value={f.stay} onChange={set('stay')} /></div>
        <div className="field"><label htmlFor="ti-scene">Tranh minh họa</label><select id="ti-scene" className="input" value={f.scene} onChange={set('scene')}>{Object.entries(SCENES).map(([k, sc]) => <option key={k} value={k}>{sc.label}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="ti-note">Ghi chú</label><textarea id="ti-note" rows={2} className="input" value={f.note} onChange={set('note')} placeholder="Điểm muốn đến, món muốn ăn…" /></div>
      <PhotoPicker id="ti-photo" photo={f.photo} kind={f.scene} sky={SCENES[f.scene]?.sky} onChange={(photo) => setF({ ...f, photo })} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" type="submit"><Icon name="check" size={17} />Lưu</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Hủy</button>
        <span style={{ marginLeft: 'auto' }}>{ask
          ? <span style={{ display: 'inline-flex', gap: 6 }}><button type="button" className="btn sm" style={{ background: 'var(--rose)' }} onClick={onDelete}>Xóa chuyến đi</button><button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Hủy</button></span>
          : <button type="button" className="btn sm ghost" style={{ color: 'var(--rose)', borderColor: 'var(--rose-border)' }} onClick={() => setAsk(true)}><Icon name="trash" size={14} />Xóa</button>}</span>
      </div>
    </form>
  );
}

function TripDetail({ trip, onBack, update, onDelete, notify }) {
  const [tab, setTab] = useState('plan');
  const [editInfo, setEditInfo] = useState(false);
  const planned = trip.costs.reduce((s, c) => s + c.plan, 0);
  const packed = trip.packing.filter((p) => p.done).length;
  // Dữ liệu cũ: khoản chi chưa có id thì gán id để sửa, xóa được.
  useEffect(() => {
    if (trip.costs.some((c) => !c.id)) update((t) => ({ ...t, costs: t.costs.map((c) => (c.id ? c : { ...c, id: uid() })) }));
  }, [trip.id]);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="link" onClick={onBack}><Icon name="chevL" size={16} />Tất cả chuyến đi</button>
        {!editInfo && <button className="link" onClick={() => setEditInfo(true)}><Icon name="pen" size={15} />Sửa thông tin</button>}
      </div>
      <Cover photo={trip.photo} kind={trip.scene} sky={trip.sky} height={220} radius={22}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: 18 }}>
          <span className="chip mint" style={{ alignSelf: 'flex-end', marginBottom: 'auto' }}><Icon name="cal" size={13} />{nights(trip) + 1} ngày</span>
          <h2 style={{ fontSize: 34, fontWeight: 700 }}>{trip.name}</h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#dfeee9', fontSize: 13 }}>
            <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="cal" size={14} />{range(trip)}</span>
            <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="pin" size={14} />{trip.place}</span>
          </div>
        </div>
      </Cover>

      {editInfo && <TripInfoForm trip={trip} onCancel={() => setEditInfo(false)} onDelete={onDelete} onSave={(f) => { update((t) => ({ ...t, ...f })); setEditInfo(false); }} />}

      <div className="grid g4 trip-facts" style={{ marginTop: 14 }}>
        {[['users', 'Người đi', trip.travelers], ['wallet', 'Dự trù', vndShort(planned)], ['home2', 'Lưu trú', trip.stay], ['bag', 'Hành lý', `${packed}/${trip.packing.length} món`]].map(([ic, l, v]) => (
          <section key={l} className="card" style={{ padding: 14 }}><div className="row-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name={ic} size={14} />{l}</div><div style={{ fontWeight: 600, marginTop: 4 }}>{v}</div></section>
        ))}
      </div>

      <div style={{ marginTop: 14 }}><Tabs value={tab} onChange={setTab} tabs={[{ id: 'plan', label: 'Lịch trình' }, { id: 'cost', label: 'Chi phí' }, { id: 'pack', label: 'Hành lý' }, { id: 'media', label: `Vlog & Ảnh${(trip.videos?.length || 0) + (trip.photoLinks?.length || 0) ? ` (${(trip.videos?.length || 0) + (trip.photoLinks?.length || 0)})` : ''}` }]} /></div>

      {tab === 'plan' && <ItineraryEditor trip={trip} update={update} notify={notify} />}
      {tab === 'cost' && <CostEditor trip={trip} update={update} notify={notify} />}
      {tab === 'pack' && <PackingEditor trip={trip} update={update} />}
      {tab === 'media' && <MediaEditor trip={trip} update={update} notify={notify} />}
    </div>
  );
}

export default function TravelPage() {
  const [data, set] = useModule('travel');
  const notify = useNotify();
  const [tab, setTab] = useState('overview');
  const [openId, setOpenId] = useState(null);
  const [statYear, setStatYear] = useState(TODAY.getFullYear());

  const upcoming = data.trips.filter((t) => t.end >= todayIso).sort((a, b) => a.start.localeCompare(b.start));
  const done = data.trips.filter((t) => t.end < todayIso).sort((a, b) => b.start.localeCompare(a.start));
  const next = upcoming[0];
  const open = data.trips.find((t) => t.id === openId);
  // Đếm từng ngày của chuyến vào đúng tháng của ngày đó (chuyến xuyên tháng, xuyên năm vẫn đúng).
  const tripYears = [...new Set(data.trips.flatMap((t) => [Number(t.start.slice(0, 4)), Number(t.end.slice(0, 4))]))];
  const years = [...new Set([...tripYears, TODAY.getFullYear()])].sort((a, b) => b - a);
  const months = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
  const perMonth = Array(12).fill(0);
  let pastDays = 0; let futureDays = 0; let tripsInYear = 0;
  for (const t of data.trips) {
    let counted = false;
    for (let d = parse(t.start); iso(d) <= t.end; d = addDays(d, 1)) {
      if (d.getFullYear() !== statYear) continue;
      perMonth[d.getMonth()] += 1; counted = true;
      if (iso(d) <= todayIso) pastDays += 1; else futureDays += 1;
    }
    if (counted) tripsInYear += 1;
  }
  const yearDays = pastDays + futureDays;
  const doneYear = done.filter((t) => t.start.startsWith(String(TODAY.getFullYear())));

  // Từ một kế hoạch tạo chuyến đi chi tiết (lịch trình, chi phí, hành lý).
  const makeTrip = (p) => {
    const id = uid();
    const m = String(p.month).padStart(2, '0');
    const startDay = `${p.year}-${m}-${p.year === TODAY.getFullYear() && p.month === TODAY.getMonth() + 1 ? String(Math.min(28, TODAY.getDate() + 7)).padStart(2, '0') : '10'}`;
    const endD = parse(startDay); endD.setDate(endD.getDate() + 2);
    const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
    set((s) => ({
      ...s,
      trips: [...s.trips, { id, name: p.name, place: p.place || p.name, start: startDay, end, scene: p.scene, sky: SCENES[p.scene]?.sky || 'dawn', travelers: '1 người', stay: 'Chưa đặt', note: p.note || '', photo: p.photo || null, itinerary: [], costs: [{ id: uid(), label: 'Tổng', plan: p.budget || 0, actual: 0 }], packing: [] }],
      yearPlan: (s.yearPlan || []).map((x) => (x.id === p.id ? { ...x, status: 'booked' } : x)),
    }));
    notify('Đã tạo chuyến đi, bạn chỉnh ngày và chi tiết ở đây');
    setOpenId(id);
  };

  if (open) return <TripDetail trip={open} notify={notify} onBack={() => setOpenId(null)} onDelete={() => { set((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== open.id) })); setOpenId(null); notify('Đã xóa chuyến đi'); }} update={(fn) => set((s) => ({ ...s, trips: s.trips.map((t) => (t.id === open.id ? fn(t) : t)) }))} />;

  return (
    <div className="fade-in">
      <PageHead title="Du lịch" subtitle="Chuyến đi, kế hoạch và ước mơ khám phá của bạn." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Tổng quan' }, { id: 'trips', label: 'Chuyến đi' }, { id: 'year', label: 'Kế hoạch năm' }, { id: 'decade', label: 'Kế hoạch 10 năm' }]} />

      {tab === 'overview' && (
        <div className="grid g-main">
          <div className="stack">
            {next && (
              <button onClick={() => setOpenId(next.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                <Cover photo={next.photo} kind={next.scene} sky={next.sky} height={250} radius={18}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: 20 }}>
                    <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{next.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 15 }}><Icon name="cal" size={17} />{range(next)} · {daysFromToday(next.start) > 0 ? `còn ${daysFromToday(next.start)} ngày` : 'đang diễn ra'}</div>
                  </div>
                </Cover>
              </button>
            )}
            <div className="grid g2">
              <section className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="icon-tile"><Icon name="plane" /></span><div><div style={{ fontSize: 14 }}>Sắp tới</div><div className="stat-value">{upcoming.length}</div></div></section>
              <section className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="icon-tile good"><Icon name="checkCircle" /></span><div><div style={{ fontSize: 14 }}>Đã đi {TODAY.getFullYear()}</div><div className="stat-value">{doneYear.length}</div></div></section>
            </div>
          </div>
          <div className="stack">
            <Card title="Số ngày du lịch theo tháng" icon="chart" action={
              <select className="input" aria-label="Chọn năm" value={statYear} onChange={(e) => setStatYear(Number(e.target.value))} style={{ width: 'auto', minHeight: 36, padding: '6px 12px', borderRadius: 999, fontSize: 13.5 }}>
                {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
              </select>
            }>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="big-num" style={{ fontSize: 34 }}>{yearDays}</span>
                <span style={{ fontWeight: 600 }}>ngày du lịch năm {statYear}</span>
              </div>
              <div className="row-sub" style={{ marginBottom: 10 }}>
                {tripsInYear} chuyến{yearDays ? ` · ${pastDays} ngày đã đi${futureDays ? ` · ${futureDays} ngày sắp tới` : ''}` : ''}
              </div>
              <BarChart labels={months} series={[{ name: 'Ngày', color: 'var(--lav)', values: perMonth }]} height={180} />
            </Card>
            <Card title="Chuyến tiếp theo" icon="cal">
              <div style={{ display: 'grid', gap: 10 }}>{upcoming.map((t) => <TripRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'trips' && (
        <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
          <div className="stack">
            <h3 className="card-title"><Icon name="cal" size={18} />Sắp tới</h3>
            {upcoming.map((t) => <TripRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}
            <button className="btn" onClick={() => {
              const id = uid();
              set((s) => ({ ...s, trips: [...s.trips, { id, name: 'Chuyến đi mới', place: 'Chưa chọn', start: iso(addDays(TODAY, 14)), end: iso(addDays(TODAY, 16)), scene: 'sea', sky: 'dawn', travelers: '1 người', stay: 'Chưa đặt', note: '', itinerary: [], costs: [{ id: uid(), label: 'Tổng', plan: 5_000_000, actual: 0 }], packing: [] }] }));
              notify('Đã thêm chuyến đi nháp'); setOpenId(id);
            }}><Icon name="plus" size={18} />Thêm chuyến đi</button>
          </div>
          <div className="stack">
            <h3 className="card-title"><Icon name="check" size={18} />Đã hoàn thành</h3>
            {done.map((t) => <TripRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}
          </div>
        </div>
      )}

      {tab === 'year' && <YearPlans data={data} set={set} notify={notify} onMakeTrip={makeTrip} />}

      {tab === 'decade' && <DecadePlans data={data} set={set} notify={notify} />}
    </div>
  );
}
