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
    if (auto.current || hasMcp !== true || !h.stravaSyncedAt) return;
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

  return (
    <div className="stack">
      <section className="card glow" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="icon-tile"><Icon name="file" size={19} /></span>
        <div className="row-main" style={{ minWidth: 200 }}>
          <div className="row-title">Nhập từ file Strava (miễn phí)</div>
          <div className="row-sub">Trên strava.com: Cài đặt → Tài khoản của tôi → Tải về hoặc xóa tài khoản → Yêu cầu tải về. Strava gửi file .zip qua email; chọn file đó (hoặc activities.csv bên trong). Nhập lại nhiều lần không bị trùng.</div>
          {imp && <div className={`row-sub ${imp.ok ? 'good' : 'rose'}`} style={{ marginTop: 6, fontWeight: 600 }}>{imp.text}</div>}
          {!imp && h.stravaImportedAt && <div className="row-sub" style={{ marginTop: 4 }}>Lần nhập gần nhất: {new Date(h.stravaImportedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>}
        </div>
        <input ref={fileRef} type="file" accept=".zip,.csv,application/zip,text/csv" onChange={importFile} hidden />
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={importing}><Icon name="plus" size={17} />{importing ? 'Đang đọc file…' : 'Chọn file'}</button>
      </section>
      {(!SERVER || hasMcp !== false) && (
        <section className="card glow" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="icon-tile" style={{ background: '#fc4c02', color: '#fff' }}><Icon name="bolt" size={19} /></span>
          <div className="row-main" style={{ minWidth: 200 }}>
            <div className="row-title">Đồng bộ với Strava</div>
            <div className="row-sub">
              {h.stravaSyncedAt ? `Lần đồng bộ gần nhất: ${new Date(h.stravaSyncedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} · lấy các buổi tập trong 30 ngày` : 'Lấy các buổi tập trong 30 ngày gần nhất từ tài khoản Strava của bạn.'}
            </div>
            {err && <div className="row-sub rose" style={{ marginTop: 4 }}>{err}</div>}
            {hasMcp === false && !err && <div className="row-sub amber" style={{ marginTop: 4 }}>{SERVER ? 'Máy chủ chưa được cấu hình Strava (thiếu STRAVA_CLIENT_ID). Bạn vẫn có thể ghi tay ở dưới.' : 'Mở app trên Claude và kết nối Strava để đồng bộ. Bạn vẫn có thể ghi tay ở dưới.'}</div>}
          </div>
          {hasMcp === 'connect'
            ? <button className="btn" onClick={stravaConnect}><Icon name="bolt" size={17} />Kết nối Strava</button>
            : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => sync(false)} disabled={busy || hasMcp === false}><Icon name="refresh" size={17} />{busy ? 'Đang đồng bộ…' : 'Đồng bộ Strava'}</button>
                {SERVER && hasMcp === true && <button className="btn ghost" onClick={async () => { await stravaDisconnect().catch(() => {}); setHasMcp('connect'); notify('Đã ngắt kết nối Strava'); }}>Ngắt kết nối</button>}
              </div>}
        </section>
      )}
      {hasSample && <div className="row-sub" style={{ marginTop: -6 }}>Đang hiển thị buổi tập mẫu. Lần nhập file hoặc đồng bộ Strava đầu tiên sẽ thay chúng bằng dữ liệu thật.</div>}

      <div className="grid g4">
        <section className="card"><span className="icon-tile"><Icon name="cal" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{week.length}<small>buổi</small></div><div className="stat-label">Tuần này · {hrs(mins(week))}</div></section>
        <section className="card"><span className="icon-tile lav"><Icon name="trend" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{month.length}<small>buổi</small></div><div className="stat-label">Tháng {TODAY.getMonth() + 1} · {hrs(mins(month))}</div></section>
        <section className="card"><span className="icon-tile amber"><Icon name="clock" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(mins(year) / 60, 0)}<small>giờ</small></div><div className="stat-label">Năm {yearKey} · {year.length} buổi</div></section>
        <section className="card"><span className="icon-tile good"><Icon name="pin" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(sumKm(year), 0)}<small>km</small></div><div className="stat-label">Quãng đường năm {yearKey}</div></section>
      </div>

      {bySport.length > 0 && (
        <Card title={`Theo môn · năm ${yearKey}`} icon="pie">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
            {bySport.map(({ t, n, km, min }) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 14, background: 'var(--surface-3)' }}>
                <span className="icon-tile" style={{ width: 36, height: 36, background: 'var(--surface)', color: SPORTS[t].color }}><Icon name={SPORTS[t].icon} size={17} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{SPORTS[t].label}</div>
                  <div className="row-sub">{n} buổi · {SPORTS[t].km && km > 0 ? `${num(km, 0)} km · ` : ''}{hrs(min)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid g-main">
        <Card title="Giờ tập 12 tháng" icon="chart">
          <BarChart stacked labels={months.map((m) => `T${m.getMonth() + 1}`)} series={monthSeries.length ? monthSeries : [{ name: 'Giờ', color: 'var(--mint)', values: months.map(() => 0) }]} height={200} />
          <div className="legend" style={{ marginTop: 6 }}>{present.map((t) => <span key={t}><i style={{ background: SPORTS[t].color }} />{SPORTS[t].label}</span>)}</div>
        </Card>
        <Card title="Km mỗi tuần (8 tuần)" icon="trend">
          <BarChart stacked labels={weeks.map((w) => dm(w))} series={weekSeries.length ? weekSeries : [{ name: 'km', color: 'var(--mint)', values: weeks.map(() => 0) }]} height={200} />
          <div className="legend" style={{ marginTop: 6 }}>{kmSports.map((t) => <span key={t}><i style={{ background: SPORTS[t].color }} />{SPORTS[t].label}</span>)}</div>
        </Card>
      </div>

      <div className="grid g-main">
        <Card title="Buổi tập gần đây" icon="journal">
          <div className="list">
            {[...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((w) => (
              <div className="row" key={w.id}>
                <span className="icon-tile" style={{ width: 34, height: 34, color: sportOf(w.type).color }}><Icon name={sportOf(w.type).icon} size={16} /></span>
                <div className="row-main">
                  <div className="row-title">{w.name}</div>
                  <div className="row-sub">{dow(parse(w.date))} {dmy(w.date)}{w.minutes ? ` · ${w.minutes} phút` : ''}{pace(w) ? ` · ${pace(w)}` : ''} · {w.sport || sportOf(w.type).label} · {SOURCE[w.source] || 'Ghi tay'}</div>
                </div>
                <b className="num" style={{ whiteSpace: 'nowrap' }}>{w.km > 0 ? `${num(w.km, 2)} km` : hrs(w.minutes || 0)}</b>
                {w.source !== 'strava' && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => remove(w.id)} aria-label="Xóa buổi tập"><Icon name="trash" size={15} /></button>}
              </div>
            ))}
            {!workouts.length && <div className="empty">Chưa có buổi tập nào. Nhập file Strava hoặc ghi tay ở bên cạnh.</div>}
          </div>
        </Card>
        <Card title="Ghi tay buổi tập" icon="plus">
          <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
            <div className="field"><label htmlFor="w-type">Môn</label><select id="w-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{SPORT_ORDER.map((k) => <option key={k} value={k}>{SPORTS[k].label}</option>)}</select></div>
            <div className="field"><label htmlFor="w-date">Ngày</label><input id="w-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="form-row">
              <div className="field"><label htmlFor="w-km">Quãng đường (km)</label><input id="w-km" className="input" inputMode="decimal" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="5,2" /></div>
              <div className="field"><label htmlFor="w-min">Thời gian (phút)</label><input id="w-min" className="input" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="35" /></div>
            </div>
            <button className="btn" type="submit"><Icon name="plus" size={18} />Lưu buổi tập</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
