import { useEffect, useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { dm, dmy, num, todayIso, uid } from '../../core/format.js';
import { Card, Delta, PageHead, StatCard, Tabs } from '../../ui/common.jsx';
import { LineChart, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { bmi, bmiLabel, bpClass, initial } from './data.js';
import Training from './Training.jsx';
import Pickleball from './Pickleball.jsx';

const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function HealthPage() {
  const [h, set] = useModule('health');
  const notify = useNotify();
  const [range, setRange] = useState('30');
  const [tab, setTab] = useState('metrics');
  const [form, setForm] = useState({ date: todayIso, weight: '', waist: '' });
  const [bpForm, setBpForm] = useState({ date: todayIso, time: nowTime(), sys: '', dia: '', pulse: '' });
  const [hEdit, setHEdit] = useState(null);

  // Một lần: chiều cao chuyển sang hồ sơ cơ thể (173,15 cm), thêm huyết áp và tập luyện.
  useEffect(() => {
    if (!h.heightUpdated || !h.bp || !h.workouts) {
      set((s) => ({ ...s, height: s.heightUpdated ? s.height : 173.15, heightUpdated: s.heightUpdated || todayIso, bp: s.bp || initial.bp, workouts: s.workouts || initial.workouts }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...h.entries].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const shown = range === 'all' ? sorted : sorted.slice(-Math.ceil(Number(range) / 3) - 1);
  const first = shown[0];
  const b = bmi(last.weight, h.height);
  const start = sorted[0];
  const toGoal = Math.max(0, last.weight - h.goalWeight);
  const goalPct = Math.round(((start.weight - last.weight) / (start.weight - h.goalWeight)) * 100);

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
      <Tabs tabs={[{ id: 'metrics', label: 'Chỉ số' }, { id: 'training', label: 'Tập luyện' }, { id: 'pickleball', label: 'Pickleball' }]} value={tab} onChange={setTab} />

      {tab === 'pickleball' ? <Pickleball h={h} set={set} notify={notify} /> : tab === 'training' ? <Training h={h} set={set} notify={notify} /> : <>

      <div className="grid g4">
        <StatCard icon="scale" label="Cân nặng" value={num(last.weight)} unit="kg" foot={<Delta value={+(last.weight - first.weight).toFixed(1)} unit=" kg" />} />
        <StatCard icon="drop" tone="lav" label="Huyết áp" value={bpLast ? `${bpLast.sys}/${bpLast.dia}` : '—'} unit="mmHg" foot={bpLast ? <span className={`chip ${bpCls.tone}`}>{bpCls.label}</span> : <span className="muted" style={{ fontSize: 12.5 }}>Chưa có số đo</span>} />
        <StatCard icon="waist" label="Vòng eo" value={num(last.waist)} unit="cm" foot={<Delta value={+(last.waist - first.waist).toFixed(1)} unit=" cm" />} />
        <StatCard icon="heart" tone="amber" label="Chỉ số BMI" value={num(b)} foot={<span className={`chip ${b < 23 ? 'good' : 'amber'}`}>{bmiLabel(b)} (chuẩn châu Á)</span>} />
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Lịch sử cân nặng" icon="trend" glow
          action={<div className="tabs seg" style={{ margin: 0, padding: 3 }}>{[['30', '30 ngày'], ['90', '90 ngày'], ['all', 'Tất cả']].map(([k, l]) => (
            <button key={k} className={`tab ${range === k ? 'active' : ''}`} style={{ padding: '5px 10px' }} onClick={() => setRange(k)}>{l}</button>))}</div>}>
          <LineChart data={shown.map((e) => ({ label: dm(e.date), value: e.weight }))} goal={h.goalWeight} format={(v) => `${num(v)} kg`} yFormat={(v) => num(v)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <Delta value={+(last.weight - first.weight).toFixed(1)} unit=" kg" />
            <span className="muted" style={{ fontSize: 12.5 }}>so với {dmy(first.date)}</span>
          </div>
        </Card>
        <Card title="Tiến tới mục tiêu" icon="target">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring value={goalPct} size={116} thickness={11}>
              <div><div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{goalPct}%</div><div className="muted" style={{ fontSize: 11 }}>hoàn thành</div></div>
            </Ring>
            <div style={{ display: 'grid', gap: 6 }}>
              <div><span className="muted">Mục tiêu </span><b className="num">{num(h.goalWeight)} kg</b></div>
              <div><span className="muted">Còn lại </span><b className="num mint">{num(toGoal)} kg</b></div>
              <div><span className="muted">Bắt đầu </span><b className="num">{num(start.weight)} kg</b></div>
            </div>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            {[['heart', 'Nhịp tim nghỉ', `${h.vitals.restingHr}`, 'bpm'], ['moon', 'Giấc ngủ TB', num(h.vitals.sleepAvg), 'giờ'], ['bolt', 'Bước chân', h.vitals.steps.toLocaleString('vi-VN'), 'bước'], ['drop', 'Nước uống', num(h.vitals.water), 'lít']].map(([ic, l, v, u]) => (
              <div key={l} style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name={ic} size={14} />{l}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{v} <small className="muted" style={{ fontSize: 11 }}>{u}</small></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Xu hướng vòng eo" icon="waist">
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
        <Card title="Huyết áp" icon="drop"
          action={bpLast && <span className={`chip ${bpCls.tone}`}>{bpLast.sys}/{bpLast.dia} · {bpCls.label}</span>}>
          {bpShown.length >= 2 ? (
            <>
              <LineChart data={bpShown.map((r) => ({ label: dm(r.date), value: r.sys }))} data2={bpShown.map((r) => r.dia)} color="var(--mint)" color2="var(--lav)"
                refs={[{ value: 120, label: '120' }, { value: 80, label: '80' }]} format={(v) => `${Math.round(v)}`} minPad={4} height={200} />
              <div className="legend" style={{ marginTop: 6 }}>
                <span><i style={{ background: 'var(--mint)' }} />Tâm thu</span>
                <span><i style={{ background: 'var(--lav)' }} />Tâm trương</span>
                <span className="muted">Nét đứt: ngưỡng 120/80</span>
              </div>
            </>
          ) : <p className="muted">Ghi ít nhất 2 lần đo để xem biểu đồ xu hướng.</p>}
          <div className="list" style={{ marginTop: 12 }}>
            {[...bpList].reverse().slice(0, 6).map((r) => {
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
