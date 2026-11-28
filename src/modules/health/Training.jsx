import { useEffect, useRef, useState } from 'react';
import { addDays, dm, dmy, dow, iso, num, parse, TODAY, todayIso, uid, weekStart } from '../../core/format.js';
const hrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60 ? `${m % 60} phút` : ''}`.trim() : `${m} phút`);
import { Card } from '../../ui/common.jsx';
import { BarChart } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { errorText, fetchStrava, stravaAvailable, stravaConnect, stravaDisconnect } from './strava.js';
import { SERVER } from '../../core/platform.js';
import { ImportError, importStravaFile } from './stravaImport.js';
import { SPORT_ORDER, SPORTS, sportOf } from './sports.js';

const sumKm = (list) => list.reduce((s, w) => s + (w.km || 0), 0);
const pace = (w) => ((w.type === 'run' || w.type === 'walk') && w.km > 0 && w.minutes > 0 ? (() => { const p = w.minutes / w.km; return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}/km`; })() : '');
// Strava (đồng bộ và nhập file) tạm tắt theo yêu cầu; mã vẫn giữ để phát triển sau.
const STRAVA_PAUSED = true;
const SOURCE = { strava: 'Strava', manual: 'Ghi tay', sample: 'Mẫu' };

export default function Training({ h, set, notify }) {
  const workouts = h.workouts || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hasMcp, setHasMcp] = useState(null);
  const [form, setForm] = useState({ date: todayIso, type: 'walk', km: '', minutes: '' });
  const auto = useRef(false);
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [imp, setImp] = useState(null); // { ok, text }

  const importFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) { setImp({ ok: false, text: 'Chưa nhận được file. Hãy thử chọn lại.' }); return; }
    setImporting(true); setImp({ ok: true, text: `Đang đọc ${file.name || 'file'} (${(file.size / 1048576).toFixed(1)} MB)…` });
    try {
      const { workouts: got, skipped } = await importStravaFile(file);
      if (!got.length) throw new ImportError('Không có buổi tập nào trong file.');
      let added = 0;
      set((s) => {
        const map = new Map((s.workouts || []).filter((w) => w.source !== 'sample').map((w) => [w.id, w]));
        got.forEach((w) => { if (!map.has(w.id)) added++; map.set(w.id, w); });
        return { ...s, workouts: [...map.values()], stravaImportedAt: new Date().toISOString() };
      });
      const msg = `Đã nhập ${got.length} buổi tập (mới nhất ${dmy([...got].sort((a, b) => b.date.localeCompare(a.date))[0].date)})${skipped ? `, bỏ qua ${skipped} dòng thiếu ngày` : ''}.`;
      setImp({ ok: true, text: msg }); notify(msg);
    } catch (x) {
      setImp({ ok: false, text: x instanceof ImportError ? x.message : `Không đọc được file này (${x?.message || 'lỗi không rõ'}). Hãy chọn file .zip Strava gửi hoặc file activities.csv.` });
    }
    setImporting(false);
  };

  useEffect(() => { let alive = true; stravaAvailable().then((v) => alive && setHasMcp(v)); return () => { alive = false; }; }, []);
  // Quay về từ trang cấp quyền Strava (bản VPS): đồng bộ ngay.
  useEffect(() => {
    const m = location.hash.match(/strava=(\w+)/);
    if (!m) return;
    history.replaceState(null, '', '#health');
    if (m[1] === 'ok') { notify('Đã kết nối Strava'); setHasMcp(true); sync(false); }
    else setErr(m[1] === 'scope' ? 'Bạn cần cho phép "xem hoạt động" để app đọc được số km.' : m[1] === 'denied' ? 'Bạn đã từ chối cấp quyền Strava.' : 'Kết nối Strava không thành công, thử lại nhé.');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async (silent) => {
    setBusy(true); setErr('');
    try {
      const { workouts: got } = await fetchStrava(30);
      set((s) => {
        const map = new Map((s.workouts || []).filter((w) => w.source !== 'sample').map((w) => [w.id, w]));
        got.forEach((w) => map.set(w.id, w));
        return { ...s, workouts: [...map.values()], stravaSyncedAt: new Date().toISOString() };
      });
      if (!silent) notify(`Đã đồng bộ ${got.length} buổi tập từ Strava`);
    } catch (e) {
      if (e?.code === 'strava_not_connected') setHasMcp('connect');
      setErr(e?.code === 'no_mcp' ? 'Đồng bộ Strava chỉ chạy khi mở app trên Claude.' : e?.code === 'shape' ? 'Strava trả về dữ liệu ở dạng app chưa đọc được. Hãy báo lại để mình chỉnh.' : errorText(e));
    }
    setBusy(false);
  };

  // Đã từng đồng bộ thì tự làm mới khi mở tab (tối đa mỗi giờ một lần).
  useEffect(() => {
    if (STRAVA_PAUSED || auto.current || hasMcp !== true || !h.stravaSyncedAt) return;
    auto.current = true;
    if (Date.now() - new Date(h.stravaSyncedAt).getTime() > 3600e3) sync(true);
  }, [hasMcp, h.stravaSyncedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (e) => {
    e.preventDefault();
    const km = parseFloat(String(form.km).replace(',', '.')) || 0;
    if (!km && !(Number(form.minutes) > 0)) return notify('Nhập số km hoặc số phút');
    set((s) => ({ ...s, workouts: [...(s.workouts || []), { id: uid(), date: form.date, type: form.type, km, minutes: Number(form.minutes) || 0, name: SPORTS[form.type].label, source: 'manual' }] }));
    setForm({ ...form, km: '', minutes: '' });
    notify('Đã ghi buổi tập');
  };
  const remove = (id) => set((s) => ({ ...s, workouts: (s.workouts || []).filter((w) => w.id !== id) }));

  const ws = weekStart(TODAY);
  const week = workouts.filter((w) => parse(w.date) >= ws);
  const monthKey = todayIso.slice(0, 7);
  const month = workouts.filter((w) => w.date.startsWith(monthKey));
  const yearKey = todayIso.slice(0, 4);
  const year = workouts.filter((w) => w.date.startsWith(yearKey));
  const mins = (list) => list.reduce((s, w) => s + (w.minutes || 0), 0);
  const present = SPORT_ORDER.filter((t) => workouts.some((w) => w.type === t));
  const kmSports = present.filter((t) => SPORTS[t].km && workouts.some((w) => w.type === t && w.km > 0));
  // 12 tháng gần nhất: giờ tập theo môn.
  const months = Array.from({ length: 12 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth() - 11 + i, 1));
  const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthSeries = present.map((t) => ({ name: SPORTS[t].label, color: SPORTS[t].color, values: months.map((m) => +(mins(workouts.filter((w) => w.type === t && w.date.startsWith(mk(m)))) / 60).toFixed(1)) }));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -(7 - i) * 7));
  const weekSeries = kmSports.map((t) => ({ name: SPORTS[t].label, color: SPORTS[t].color, values: weeks.map((w0) => { const end = addDays(w0, 7); return +sumKm(workouts.filter((w) => w.type === t && parse(w.date) >= w0 && parse(w.date) < end)).toFixed(1); }) }));
  const bySport = present.map((t) => { const l = year.filter((w) => w.type === t); return { t, n: l.length, km: sumKm(l), min: mins(l) }; }).filter((x) => x.n);
  const hasSample = workouts.some((w) => w.source === 'sample');

  // Ghi tay: chạm một buổi để sửa; lần ghi tay đầu tiên thay dữ liệu mẫu.
  const [editId, setEditId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [other, setOther] = useState(false);
  const yesterday = iso(addDays(TODAY, -1));
  const save = (e) => {
    e.preventDefault();
    const km = parseFloat(String(form.km).replace(',', '.')) || 0;
    const minutes = Number(form.minutes) || 0;
    if (!km && !minutes) return notify('Nhập số km hoặc số phút');
    if (km > 300) return notify('Số km có vẻ chưa đúng');
    const item = { id: editId || uid(), date: form.date, type: form.type, km, minutes, name: SPORTS[form.type].label, source: 'manual' };
    set((s) => {
      const list = (s.workouts || []).filter((w) => w.source !== 'sample');
      return { ...s, workouts: editId ? list.map((w) => (w.id === editId ? { ...w, ...item, source: w.source } : w)) : [...list, item] };
    });
    setForm({ ...form, km: '', minutes: '' }); setEditId(null);
    notify(editId ? 'Đã cập nhật buổi tập' : `Đã ghi ${km ? `${num(km, 2)} km ` : ''}${SPORTS[form.type].label.toLowerCase()}`);
  };
  const startEdit = (w) => { setEditId(w.id); setOther(!['run', 'walk'].includes(w.type)); setForm({ date: w.date, type: w.type, km: w.km ? String(w.km).replace('.', ',') : '', minutes: w.minutes ? String(w.minutes) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const real = workouts.filter((w) => w.source !== 'sample');
  const runWalk = (list, t) => sumKm(list.filter((w) => w.type === t));
  const weekRW = ['run', 'walk'].map((t) => ({ t, km: runWalk(week, t), n: week.filter((w) => w.type === t).length }));
  // Km mỗi ngày trong 14 ngày gần nhất (chạy + đi bộ, cột chồng).
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 13));
  const daySeries = ['run', 'walk'].map((t) => ({ name: SPORTS[t].label, color: SPORTS[t].color, values: days.map((d) => +sumKm(workouts.filter((w) => w.type === t && w.date === iso(d))).toFixed(1)) }));
  const dayTotal = daySeries.reduce((s, se) => s + se.values.reduce((a, b) => a + b, 0), 0);
  const recent = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || 0);
  const shown = showAll ? recent.slice(0, 60) : recent.slice(0, 6);

  return (
    <div className="stack tr">
      <section className="card tr-hero">
        <div className="tr-hero-top">
          <div>
            <div className="tr-label">Tuần này</div>
            <div className="tr-big">{num(sumKm(week), 1)}<small>km</small></div>
            <div className="muted" style={{ fontSize: 13 }}>{week.length} buổi · {hrs(mins(week))}</div>
          </div>
          <button className="tr-strava" disabled title="Đồng bộ Strava: đang phát triển" aria-label="Đồng bộ Strava (sắp có)">
            <Icon name="refresh" size={18} /><span>Strava</span><em>Sắp có</em>
          </button>
        </div>
        <div className="tr-split">
          {weekRW.map(({ t, km, n }) => (
            <div key={t} className="tr-split-cell" style={{ '--c': SPORTS[t].color }}>
              <Icon name={SPORTS[t].icon} size={16} /><span>{SPORTS[t].label}</span><b>{num(km, 1)} km</b><small>{n} buổi</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card tr-log">
        <div className="card-head"><h3 className="card-title"><Icon name={editId ? 'pen' : 'plus'} size={18} />{editId ? 'Sửa buổi tập' : 'Ghi buổi tập'}</h3>
          {editId && <button className="btn sm ghost" onClick={() => { setEditId(null); setForm({ date: todayIso, type: form.type, km: '', minutes: '' }); }}>Hủy sửa</button>}</div>
        <form onSubmit={save} className="stack" style={{ gap: 12 }}>
          <div className="tabs seg" role="radiogroup" aria-label="Môn" style={{ margin: 0 }}>
            {['run', 'walk'].map((t) => (
              <button key={t} type="button" role="radio" aria-checked={!other && form.type === t} className={`tab ${!other && form.type === t ? 'active' : ''}`} onClick={() => { setOther(false); setForm({ ...form, type: t }); }}>
                <Icon name={SPORTS[t].icon} size={15} /> {SPORTS[t].label}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={other} className={`tab ${other ? 'active' : ''}`} onClick={() => { setOther(true); if (['run', 'walk'].includes(form.type)) setForm({ ...form, type: 'ride' }); }}>Môn khác</button>
          </div>
          {other && <select id="w-type" className="input" aria-label="Môn khác" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{SPORT_ORDER.filter((k) => !['run', 'walk'].includes(k)).map((k) => <option key={k} value={k}>{SPORTS[k].label}</option>)}</select>}
          <div className="tr-km">
            <input id="w-km" className="input" inputMode="decimal" autoComplete="off" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="0" aria-label="Quãng đường (km)" />
            <span>km</span>
          </div>
          <div className="tr-quick">{[1, 3, 5, 10].map((k) => <button key={k} type="button" className="chip" onClick={() => setForm({ ...form, km: String(k) })}>{k} km</button>)}</div>
          <div className="grid g2" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="w-min">Thời gian (phút)</label><input id="w-min" className="input" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, '') })} placeholder="Không bắt buộc" /></div>
            <div className="field"><label htmlFor="w-date">Ngày</label><input id="w-date" type="date" className="input" max={todayIso} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div className="tr-quick">
            <button type="button" className={`chip ${form.date === todayIso ? 'mint' : ''}`} onClick={() => setForm({ ...form, date: todayIso })}>Hôm nay</button>
            <button type="button" className={`chip ${form.date === yesterday ? 'mint' : ''}`} onClick={() => setForm({ ...form, date: yesterday })}>Hôm qua</button>
            {pace({ type: form.type, km: parseFloat(String(form.km).replace(',', '.')), minutes: Number(form.minutes) }) && <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>Pace {pace({ type: form.type, km: parseFloat(String(form.km).replace(',', '.')), minutes: Number(form.minutes) })}</span>}
          </div>
          <button className="btn block" type="submit" style={{ minHeight: 50 }}><Icon name="check" size={18} />{editId ? 'Lưu thay đổi' : 'Lưu buổi tập'}</button>
        </form>
        {hasSample && <div className="row-sub" style={{ marginTop: 10 }}>Đang hiện buổi tập mẫu. Buổi đầu tiên bạn ghi sẽ thay dữ liệu mẫu.</div>}
      </section>

      <div className="tr-stats">
        <div><span>Tháng {TODAY.getMonth() + 1}</span><b>{num(sumKm(month), 1)} km</b><small>{month.length} buổi · mọi môn</small></div>
        <div><span>Năm {yearKey}</span><b>{num(sumKm(year), 0)} km</b><small>{year.length} buổi · mọi môn</small></div>
        <div><span>Chạy · năm</span><b>{num(runWalk(year, 'run'), 0)} km</b><small>{year.filter((w) => w.type === 'run').length} buổi</small></div>
        <div><span>Đi bộ · năm</span><b>{num(runWalk(year, 'walk'), 0)} km</b><small>{year.filter((w) => w.type === 'walk').length} buổi</small></div>
      </div>

      <Card title="Km mỗi ngày" icon="trend" action={<span className="muted" style={{ fontSize: 12.5 }}>14 ngày gần nhất · {num(dayTotal, 1)} km</span>}>
        <BarChart stacked labels={days.map((d) => String(d.getDate()))} series={daySeries} height={170} format={(v) => `${num(v, 1)} km`} />
        <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>Ngày {dm(days[0])} – {dm(days[days.length - 1])}</div>
        <div className="legend" style={{ marginTop: 6 }}>{['run', 'walk'].map((t) => <span key={t}><i style={{ background: SPORTS[t].color }} />{SPORTS[t].label}</span>)}</div>
      </Card>

      <Card title="Buổi tập gần đây" icon="journal" action={recent.length > 6 && <button className="btn sm ghost" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Thu gọn' : `Xem tất cả (${recent.length})`}</button>}>
        <div className="list">
          {shown.map((w) => (
            <div className="row tr-row" key={w.id}>
              <span className="tr-dot" style={{ '--c': sportOf(w.type).color }}><Icon name={sportOf(w.type).icon} size={15} /></span>
              <button className="row-main tr-row-main" onClick={() => startEdit(w)} aria-label={`Sửa ${w.name} ${dmy(w.date)}`}>
                <span className="row-title" style={{ display: 'block' }}>{sportOf(w.type).label}</span>
                <span className="row-sub" style={{ display: 'block' }}>{dow(parse(w.date))} {dm(w.date)}{w.minutes ? ` · ${hrs(w.minutes)}` : ''}{pace(w) ? ` · ${pace(w)}` : ''}{w.source === 'sample' ? ' · mẫu' : ''}</span>
              </button>
              <b className="num" style={{ whiteSpace: 'nowrap' }}>{w.km > 0 ? `${num(w.km, 2)} km` : hrs(w.minutes || 0)}</b>
              <button className="bare-btn" style={{ margin: 0, width: 34, height: 34 }} onClick={() => remove(w.id)} aria-label="Xóa buổi tập"><Icon name="trash" size={15} /></button>
            </div>
          ))}
          {!workouts.length && <div className="empty">Chưa có buổi tập nào. Ghi buổi đầu tiên ở trên.</div>}
        </div>
      </Card>
    </div>
  );
}
