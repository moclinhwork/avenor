import { useEffect, useState } from 'react';
import { useModule, useNotify, useStore } from '../../core/store.jsx';
import { go, useHashQuery } from '../../core/router.js';
import { dm, dmy, num, todayIso, uid } from '../../core/format.js';
import { Card, Delta, PageHead, StatCard, Tabs } from '../../ui/common.jsx';
import { LineChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { bmi, bmiLabel, bpClass, goalProgress, initial } from './data.js';
import Training from './Training.jsx';
import Pickleball from './Pickleball.jsx';
import Guidelines from './Guidelines.jsx';
import { ensureGuidelines } from './guidelines.js';

const TABS = [{ id: 'metrics', label: 'Chỉ số' }, { id: 'guidelines', label: 'Nguyên tắc' }, { id: 'training', label: 'Tập luyện' }, { id: 'pickleball', label: 'Pickleball' }];

const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function HealthPage() {
  const [h, set] = useModule('health');
  const notify = useNotify();
  const [range, setRange] = useState('30');
  const { sync } = useStore();
  const q = useHashQuery();
  // Tab nằm trên đường dẫn (#health?tab=…) để nút Quay lại của điện thoại đi đúng màn trước.
  const tab = TABS.some((t) => t.id === q.get('tab')) ? q.get('tab') : 'metrics';
  const setTab = (id) => go(id === 'metrics' ? 'health' : `health?tab=${id}`);
  const metric = q.get('metric');
  const [form, setForm] = useState({ date: todayIso, weight: '', waist: '' });
  const [bpForm, setBpForm] = useState({ date: todayIso, time: nowTime(), sys: '', dia: '', pulse: '' });
  const [hEdit, setHEdit] = useState(null);
  const [gEdit, setGEdit] = useState(null);
  const [bpPage, setBpPage] = useState(0); // trang lịch sử huyết áp, 6 lần đo mỗi trang // form sửa mục tiêu và chỉ số sinh hiệu

  // Một lần: chiều cao chuyển sang hồ sơ cơ thể (173,15 cm), thêm huyết áp và tập luyện.
  useEffect(() => {
    if (!h.heightUpdated || !h.bp || !h.workouts) {
      set((s) => ({ ...s, height: s.heightUpdated ? s.height : 173.15, heightUpdated: s.heightUpdated || todayIso, bp: s.bp || initial.bp, workouts: s.workouts || initial.workouts }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Nguyên tắc: tạo nhóm mặc định + dữ liệu mẫu đúng một lần, sau khi dữ liệu tài khoản đã tải xong (không ghi đè dữ liệu có sẵn).
  const ready = sync !== 'connecting';
  useEffect(() => { if (ready && !h.guidelines) set((s) => ensureGuidelines(s)); }, [ready, !!h.guidelines]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mở từ liên kết chỉ số (#health?metric=waist): cuộn tới thẻ lịch sử tương ứng và đánh dấu.
  useEffect(() => {
    if (tab !== 'metrics' || !metric) return undefined;
    const t = setTimeout(() => {
      const el = document.getElementById(`metric-${metric}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('hg-flash');
      setTimeout(() => el.classList.remove('hg-flash'), 1800);
    }, 120);
    return () => clearTimeout(t);
  }, [tab, metric]);

  const sorted = [...h.entries].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const shown = range === 'all' ? sorted : sorted.slice(-Math.ceil(Number(range) / 3) - 1);
  const first = shown[0];
  const b = bmi(last.weight, h.height);
  const start = sorted[0];
  const gp = goalProgress(h, sorted);
  const toGoal = gp.left;
  const goalPct = gp.pct;
  const vit = h.vitals || {};
  const openGoal = () => setGEdit({
    goalWeight: num(h.goalWeight), goalWaist: h.goalWaist ? num(h.goalWaist) : '', goalStart: h.goalStart ? num(h.goalStart) : '',
    restingHr: vit.restingHr ?? '', sleepAvg: vit.sleepAvg != null ? num(vit.sleepAvg) : '', steps: vit.steps ?? '', water: vit.water != null ? num(vit.water) : '',
  });
  const saveGoal = (e) => {
    e.preventDefault();
    const gw = toNum(gEdit.goalWeight), gwa = toNum(gEdit.goalWaist), gs = toNum(gEdit.goalStart);
    if (!(gw >= 30 && gw <= 250)) return notify('Nhập cân nặng mục tiêu từ 30 đến 250 kg');
    if (String(gEdit.goalWaist).trim() && !(gwa >= 40 && gwa <= 200)) return notify('Nhập vòng eo mục tiêu từ 40 đến 200 cm');
    if (String(gEdit.goalStart).trim() && !(gs >= 30 && gs <= 250)) return notify('Nhập cân nặng bắt đầu từ 30 đến 250 kg');
    const opt = (v, lo, hi, label) => {
      if (!String(v).trim()) return { v: null };
      const n = toNum(v);
      return n >= lo && n <= hi ? { v: n } : { err: `${label} phải từ ${lo} đến ${hi}` };
    };
    const hr = opt(gEdit.restingHr, 30, 200, 'Nhịp tim nghỉ'), sl = opt(gEdit.sleepAvg, 0, 24, 'Giấc ngủ'), st = opt(gEdit.steps, 0, 100000, 'Bước chân'), wa = opt(gEdit.water, 0, 10, 'Nước uống');
    const bad = [hr, sl, st, wa].find((x) => x.err);
    if (bad) return notify(bad.err);
    set((s) => ({
      ...s, goalWeight: Math.round(gw * 10) / 10, goalWaist: String(gEdit.goalWaist).trim() ? Math.round(gwa * 10) / 10 : s.goalWaist,
      goalStart: String(gEdit.goalStart).trim() ? Math.round(gs * 10) / 10 : null, goalUpdated: todayIso,
      vitals: { ...(s.vitals || {}), restingHr: hr.v != null ? Math.round(hr.v) : null, sleepAvg: sl.v, steps: st.v != null ? Math.round(st.v) : null, water: wa.v },
    }));
    setGEdit(null);
    notify('Đã cập nhật mục tiêu');
  };

  const add = (e) => {
    e.preventDefault();
    const w = parseFloat(String(form.weight).replace(',', '.'));
    const wa = parseFloat(String(form.waist).replace(',', '.'));
    if (!w) return notify('Nhập cân nặng để lưu');
    set((s) => ({ ...s, entries: [...s.entries.filter((x) => x.date !== form.date), { id: uid(), date: form.date, weight: w, waist: wa || last.waist }] }));
    setForm({ date: todayIso, weight: '', waist: '' });
    notify('Đã lưu chỉ số');
  };
  const remove = (id) => set((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== id) }));

  const bpList = [...(h.bp || [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const bpLast = bpList[bpList.length - 1];
  const bpCls = bpLast && bpClass(bpLast.sys, bpLast.dia);
  const bpShown = bpList.slice(-14);
  const BP_PER = 6;
  const bpPages = Math.max(1, Math.ceil(bpList.length / BP_PER));
  const bpPg = Math.min(bpPage, bpPages - 1);
  const bpRows = [...bpList].reverse().slice(bpPg * BP_PER, bpPg * BP_PER + BP_PER);
  const addBp = (e) => {
    e.preventDefault();
    const sys = Math.round(toNum(bpForm.sys)), dia = Math.round(toNum(bpForm.dia)), pulse = Math.round(toNum(bpForm.pulse));
    if (!(sys >= 60 && sys <= 260) || !(dia >= 30 && dia <= 160)) return notify('Nhập huyết áp tâm thu và tâm trương hợp lệ');
    if (dia >= sys) return notify('Tâm thu phải lớn hơn tâm trương');
    set((s) => ({ ...s, bp: [...(s.bp || []), { id: uid(), date: bpForm.date, time: bpForm.time || '07:00', sys, dia, pulse: pulse || null }] }));
    setBpForm({ date: todayIso, time: nowTime(), sys: '', dia: '', pulse: '' });
    notify('Đã lưu số đo huyết áp');
  };
  const removeBp = (id) => set((s) => ({ ...s, bp: (s.bp || []).filter((x) => x.id !== id) }));
  const saveHeight = (e) => {
    e.preventDefault();
    const v = toNum(hEdit);
    if (!(v >= 80 && v <= 250)) return notify('Nhập chiều cao từ 80 đến 250 cm');
    set((s) => ({ ...s, height: Math.round(v * 100) / 100, heightUpdated: todayIso }));
    setHEdit(null);
    notify('Đã cập nhật chiều cao');
  };

  return (
    <div className="fade-in">
      <PageHead title="Sức khỏe" subtitle="Theo dõi các chỉ số chính, huyết áp và quãng đường tập luyện." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'guidelines' ? <Guidelines h={h} set={set} notify={notify} ready={ready} q={q} /> : tab === 'pickleball' ? <Pickleball h={h} set={set} notify={notify} /> : tab === 'training' ? <Training h={h} set={set} notify={notify} /> : <>

      <div className="grid g4">
        <StatCard icon="scale" label="Cân nặng" value={num(last.weight)} unit="kg" foot={<Delta value={+(last.weight - first.weight).toFixed(1)} unit=" kg" />} />
        <StatCard icon="drop" tone="lav" label="Huyết áp" value={bpLast ? `${bpLast.sys}/${bpLast.dia}` : '—'} unit="mmHg" foot={bpLast ? <span className={`chip ${bpCls.tone}`}>{bpCls.label}</span> : <span className="muted" style={{ fontSize: 12.5 }}>Chưa có số đo</span>} />
        <StatCard icon="waist" label="Vòng eo" value={num(last.waist)} unit="cm" foot={<Delta value={+(last.waist - first.waist).toFixed(1)} unit=" cm" />} />
        <StatCard icon="heart" tone="amber" label="Chỉ số BMI" value={num(b)} foot={<span className={`chip ${b < 23 ? 'good' : 'amber'}`}>{bmiLabel(b)} (chuẩn châu Á)</span>} />
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card id="metric-weight" title="Lịch sử cân nặng" icon="trend" glow
          action={<div className="tabs seg" style={{ margin: 0, padding: 3 }}>{[['30', '30 ngày'], ['90', '90 ngày'], ['all', 'Tất cả']].map(([k, l]) => (
            <button key={k} className={`tab ${range === k ? 'active' : ''}`} style={{ padding: '5px 10px' }} onClick={() => setRange(k)}>{l}</button>))}</div>}>
          <LineChart data={shown.map((e) => ({ label: dm(e.date), value: e.weight }))} goal={h.goalWeight} format={(v) => `${num(v)} kg`} yFormat={(v) => num(v)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <Delta value={+(last.weight - first.weight).toFixed(1)} unit=" kg" />
            <span className="muted" style={{ fontSize: 12.5 }}>so với {dmy(first.date)}</span>
          </div>
        </Card>
        <Card id="metric-vitals" title="Tiến tới mục tiêu" icon="target"
          action={gEdit === null && <button className="btn sm ghost" onClick={openGoal}><Icon name="pen" size={14} />Sửa</button>}>
          {gEdit !== null ? (
            <form onSubmit={saveGoal} style={{ display: 'grid', gap: 12 }}>
              <div className="form-row">
                <div className="field"><label htmlFor="g-w">Cân nặng mục tiêu (kg)</label><input id="g-w" className="input" inputMode="decimal" autoFocus value={gEdit.goalWeight} onChange={(e) => setGEdit({ ...gEdit, goalWeight: e.target.value })} /></div>
                <div className="field"><label htmlFor="g-waist">Vòng eo mục tiêu (cm)</label><input id="g-waist" className="input" inputMode="decimal" value={gEdit.goalWaist} onChange={(e) => setGEdit({ ...gEdit, goalWaist: e.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor="g-start">Cân nặng lúc bắt đầu (kg)</label><input id="g-start" className="input" inputMode="decimal" placeholder={`Để trống: lấy lần đo đầu tiên (${num(start.weight)} kg)`} value={gEdit.goalStart} onChange={(e) => setGEdit({ ...gEdit, goalStart: e.target.value })} />
                <span className="faint" style={{ fontSize: 12 }}>Dùng để tính % hoàn thành. Khi đặt mục tiêu mới, bạn có thể nhập cân nặng hiện tại ({num(last.weight)} kg) làm mốc.</span></div>
              <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Chỉ số khác (để trống nếu chưa có)</div>
              <div className="form-row">
                <div className="field"><label htmlFor="g-hr">Nhịp tim nghỉ (bpm)</label><input id="g-hr" className="input" inputMode="numeric" value={gEdit.restingHr} onChange={(e) => setGEdit({ ...gEdit, restingHr: e.target.value })} /></div>
                <div className="field"><label htmlFor="g-sleep">Giấc ngủ TB (giờ)</label><input id="g-sleep" className="input" inputMode="decimal" value={gEdit.sleepAvg} onChange={(e) => setGEdit({ ...gEdit, sleepAvg: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="g-steps">Bước chân mỗi ngày</label><input id="g-steps" className="input" inputMode="numeric" value={gEdit.steps} onChange={(e) => setGEdit({ ...gEdit, steps: e.target.value })} /></div>
                <div className="field"><label htmlFor="g-water">Nước uống (lít/ngày)</label><input id="g-water" className="input" inputMode="decimal" value={gEdit.water} onChange={(e) => setGEdit({ ...gEdit, water: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="submit"><Icon name="check" size={16} />Lưu</button>
                <button className="btn ghost" type="button" onClick={() => setGEdit(null)}>Hủy</button>
              </div>
            </form>
          ) : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring value={goalPct} size={116} thickness={11}>
              <div><div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{goalPct}%</div><div className="muted" style={{ fontSize: 11 }}>hoàn thành</div></div>
            </Ring>
            <div style={{ display: 'grid', gap: 6 }}>
              <div><span className="muted">Mục tiêu </span><b className="num">{num(h.goalWeight)} kg</b></div>
              <div><span className="muted">{gp.gain ? 'Cần tăng ' : 'Còn lại '}</span><b className="num mint">{num(toGoal)} kg</b></div>
              <div><span className="muted">Bắt đầu </span><b className="num">{num(gp.start)} kg</b></div>
            </div>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            {[['heart', 'Nhịp tim nghỉ', vit.restingHr ? `${vit.restingHr}` : '—', 'bpm'], ['moon', 'Giấc ngủ TB', vit.sleepAvg != null ? num(vit.sleepAvg) : '—', 'giờ'], ['bolt', 'Bước chân', vit.steps != null ? vit.steps.toLocaleString('vi-VN') : '—', 'bước'], ['drop', 'Nước uống', vit.water != null ? num(vit.water) : '—', 'lít']].map(([ic, l, v, u]) => (
              <div key={l} style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name={ic} size={14} />{l}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{v} {v !== "—" && <small className="muted" style={{ fontSize: 11 }}>{u}</small>}</div>
              </div>
            ))}
          </div>
          </>}
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card id="metric-waist" title="Xu hướng vòng eo" icon="waist">
          <LineChart data={shown.map((e) => ({ label: dm(e.date), value: e.waist }))} goal={h.goalWaist} color="var(--lav)" format={(v) => `${num(v)} cm`} yFormat={(v) => num(v)} height={170} />
        </Card>
        <Card title="Ghi chỉ số mới" icon="plus">
          <form onSubmit={add} style={{ display: 'grid', gap: 12 }}>
            <div className="field"><label htmlFor="h-date">Ngày đo</label><input id="h-date" className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="h-w">Cân nặng (kg)</label><input id="h-w" className="input" inputMode="decimal" placeholder={num(last.weight)} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
              <div className="field"><label htmlFor="h-waist">Vòng eo (cm)</label><input id="h-waist" className="input" inputMode="decimal" placeholder={num(last.waist)} value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} /></div>
            </div>
            <button className="btn block" type="submit"><Icon name="plus" size={18} />Lưu chỉ số</button>
          </form>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card id="metric-bp" title="Huyết áp" icon="drop"
          action={bpLast && <span className={`chip ${bpCls.tone}`}>{bpLast.sys}/{bpLast.dia} · {bpCls.label}</span>}>
          {bpShown.length >= 2 ? (
            <>
              <LineChart data={bpShown.map((r) => ({ label: dm(r.date), value: r.sys }))} data2={bpShown.map((r) => r.dia)} color="var(--mint)" color2="var(--lav)"
                refs={[{ value: 120, label: '120' }, { value: 80, label: '80' }]} format={(v) => `${Math.round(v)}`} minPad={4} height={230} pointLabels />
              <div className="legend" style={{ marginTop: 6 }}>
                <span><i style={{ background: 'var(--mint)' }} />Tâm thu</span>
                <span><i style={{ background: 'var(--lav)' }} />Tâm trương</span>
                <span className="muted">Nét đứt: ngưỡng 120/80</span>
              </div>
            </>
          ) : <p className="muted">Ghi ít nhất 2 lần đo để xem biểu đồ xu hướng.</p>}
          <div className="list" style={{ marginTop: 12 }}>
            {bpRows.map((r) => {
              const c = bpClass(r.sys, r.dia);
              return (
                <div className="row" key={r.id}>
                  <div className="row-main"><div className="row-title">{dmy(r.date)} · {r.time}</div><div className="row-sub" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 3 }}><span className={`chip ${c.tone}`} style={{ fontSize: 11 }}>{c.label}</span>{r.pulse ? `${r.pulse} bpm` : ''}</div></div>
                  <b className="num" style={{ minWidth: 70, textAlign: 'right' }}>{r.sys}/{r.dia}</b>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => removeBp(r.id)} aria-label="Xóa số đo huyết áp"><Icon name="trash" size={15} /></button>
                </div>
              );
            })}
          </div>
          {bpPages > 1 && (
            <div className="pager">
              <button className="btn sm ghost" onClick={() => setBpPage(bpPg - 1)} disabled={bpPg === 0}><Icon name="chevL" size={15} />Mới hơn</button>
              <span>Trang {bpPg + 1}/{bpPages}</span>
              <button className="btn sm ghost" onClick={() => setBpPage(bpPg + 1)} disabled={bpPg >= bpPages - 1}>Cũ hơn<Icon name="chevR" size={15} /></button>
            </div>
          )}
        </Card>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Card title="Ghi huyết áp" icon="plus">
            <form onSubmit={addBp} style={{ display: 'grid', gap: 12 }}>
              <div className="form-row">
                <div className="field"><label htmlFor="bp-date">Ngày đo</label><input id="bp-date" className="input" type="date" value={bpForm.date} onChange={(e) => setBpForm({ ...bpForm, date: e.target.value })} /></div>
                <div className="field"><label htmlFor="bp-time">Giờ</label><input id="bp-time" className="input" type="time" value={bpForm.time} onChange={(e) => setBpForm({ ...bpForm, time: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="bp-sys">Tâm thu</label><input id="bp-sys" className="input" inputMode="numeric" placeholder={bpLast ? String(bpLast.sys) : '120'} value={bpForm.sys} onChange={(e) => setBpForm({ ...bpForm, sys: e.target.value })} /></div>
                <div className="field"><label htmlFor="bp-dia">Tâm trương</label><input id="bp-dia" className="input" inputMode="numeric" placeholder={bpLast ? String(bpLast.dia) : '80'} value={bpForm.dia} onChange={(e) => setBpForm({ ...bpForm, dia: e.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor="bp-pulse">Nhịp tim (bpm, không bắt buộc)</label><input id="bp-pulse" className="input" inputMode="numeric" placeholder="70" value={bpForm.pulse} onChange={(e) => setBpForm({ ...bpForm, pulse: e.target.value })} /></div>
              <button className="btn block" type="submit"><Icon name="plus" size={18} />Lưu huyết áp</button>
            </form>
          </Card>
          <Card title="Hồ sơ cơ thể" icon="ruler">
            {hEdit === null ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12.5 }}>Chiều cao</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{num(h.height, 2)} <small className="muted" style={{ fontSize: 12 }}>cm</small></div>
                  <div className="muted" style={{ fontSize: 12 }}>{h.heightUpdated ? `Cập nhật ${dmy(h.heightUpdated)}` : 'Chưa cập nhật'} · dùng để tính BMI</div>
                </div>
                <button className="btn ghost" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setHEdit(num(h.height, 2))}><Icon name="pen" size={15} />Sửa</button>
              </div>
            ) : (
              <form onSubmit={saveHeight} style={{ display: 'grid', gap: 10 }}>
                <div className="field"><label htmlFor="h-height">Chiều cao mới (cm)</label><input id="h-height" className="input" inputMode="decimal" autoFocus value={hEdit} onChange={(e) => setHEdit(e.target.value)} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" type="submit"><Icon name="check" size={16} />Lưu</button>
                  <button className="btn ghost" type="button" onClick={() => setHEdit(null)}>Hủy</button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>

      <Card title="Nhật ký cân nặng" icon="journal" style={{ marginTop: 14 }}>
        <div className="list">
          {[...sorted].reverse().slice(0, 8).map((e, i, arr) => {
            const prev = arr[i + 1];
            return (
              <div className="row" key={e.id}>
                <div className="row-main"><div className="row-title">{dmy(e.date)}</div><div className="row-sub">Vòng eo {num(e.waist)} cm · BMI {num(bmi(e.weight, h.height))}</div></div>
                {prev && <Delta value={+(e.weight - prev.weight).toFixed(1)} />}
                <b className="num" style={{ minWidth: 64, textAlign: 'right' }}>{num(e.weight)} kg</b>
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => remove(e.id)} aria-label="Xóa lần đo"><Icon name="trash" size={15} /></button>
              </div>
            );
          })}
        </div>
      </Card>
      </>}
    </div>
  );
}
