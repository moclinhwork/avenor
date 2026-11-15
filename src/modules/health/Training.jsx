import { useEffect, useRef, useState } from 'react';
import { addDays, dm, dmy, dow, iso, num, parse, TODAY, todayIso, uid, weekStart } from '../../core/format.js';
import { Card } from '../../ui/common.jsx';
import { BarChart } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { errorText, fetchStrava, stravaAvailable, stravaConnect, stravaDisconnect } from './strava.js';
import { SERVER } from '../../core/platform.js';

const TYPES = { walk: { label: 'Đi bộ', color: 'var(--lav)', icon: 'pin' }, run: { label: 'Chạy bộ', color: 'var(--mint)', icon: 'bolt' } };
const sumKm = (list) => list.reduce((s, w) => s + (w.km || 0), 0);
const pace = (w) => (w.km > 0 && w.minutes > 0 ? (() => { const p = w.minutes / w.km; return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}/km`; })() : '');
const SOURCE = { strava: 'Strava', manual: 'Ghi tay', sample: 'Mẫu' };

export default function Training({ h, set, notify }) {
  const workouts = h.workouts || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hasMcp, setHasMcp] = useState(null);
  const [form, setForm] = useState({ date: todayIso, type: 'walk', km: '', minutes: '' });
  const auto = useRef(false);

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
      if (!silent) notify(`Đã đồng bộ ${got.length} buổi đi bộ/chạy bộ từ Strava`);
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
    const km = parseFloat(String(form.km).replace(',', '.'));
    if (!km) return notify('Nhập số km');
    set((s) => ({ ...s, workouts: [...(s.workouts || []), { id: uid(), date: form.date, type: form.type, km, minutes: Number(form.minutes) || 0, name: TYPES[form.type].label, source: 'manual' }] }));
    setForm({ ...form, km: '', minutes: '' });
    notify('Đã ghi buổi tập');
  };
  const remove = (id) => set((s) => ({ ...s, workouts: (s.workouts || []).filter((w) => w.id !== id) }));

  const today = workouts.filter((w) => w.date === todayIso);
  const ws = weekStart(TODAY);
  const week = workouts.filter((w) => parse(w.date) >= ws);
  const monthKey = todayIso.slice(0, 7);
  const month = workouts.filter((w) => w.date.startsWith(monthKey));
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 13));
  const series = ['run', 'walk'].map((t) => ({ name: TYPES[t].label, color: TYPES[t].color, values: days.map((d) => +sumKm(workouts.filter((w) => w.date === iso(d) && w.type === t)).toFixed(1)) }));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -(7 - i) * 7));
  const weekly = weeks.map((w0) => { const end = addDays(w0, 7); return +sumKm(workouts.filter((w) => parse(w.date) >= w0 && parse(w.date) < end)).toFixed(1); });
  const hasSample = workouts.some((w) => w.source === 'sample');

  return (
    <div className="stack">
      <section className="card glow" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="icon-tile" style={{ background: '#fc4c02', color: '#fff' }}><Icon name="bolt" size={19} /></span>
        <div className="row-main" style={{ minWidth: 200 }}>
          <div className="row-title">Đồng bộ với Strava</div>
          <div className="row-sub">
            {h.stravaSyncedAt ? `Lần đồng bộ gần nhất: ${new Date(h.stravaSyncedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} · lấy các buổi đi bộ, chạy bộ trong 30 ngày` : 'Lấy các buổi đi bộ và chạy bộ trong 30 ngày gần nhất từ tài khoản Strava của bạn.'}
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
      {hasSample && <div className="row-sub" style={{ marginTop: -6 }}>Đang hiển thị buổi tập mẫu. Lần đồng bộ Strava đầu tiên sẽ thay chúng bằng dữ liệu thật.</div>}

      <div className="grid g4">
        {[['walk', today], ['run', today]].map(([t, list]) => (
          <section key={t} className="card">
            <span className={`icon-tile ${t === 'walk' ? 'lav' : ''}`}><Icon name={TYPES[t].icon} size={19} /></span>
            <div className="stat-value" style={{ marginTop: 10 }}>{num(sumKm(list.filter((w) => w.type === t)), 2)}<small>km</small></div>
            <div className="stat-label">{TYPES[t].label} hôm nay</div>
          </section>
        ))}
        <section className="card"><span className="icon-tile"><Icon name="cal" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(sumKm(week), 1)}<small>km</small></div><div className="stat-label">Tuần này · {week.length} buổi</div></section>
        <section className="card"><span className="icon-tile amber"><Icon name="trend" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{num(sumKm(month), 1)}<small>km</small></div><div className="stat-label">Tháng {TODAY.getMonth() + 1} · chạy {num(sumKm(month.filter((w) => w.type === 'run')), 1)} km</div></section>
      </div>

      <div className="grid g-main">
        <Card title="Quãng đường 14 ngày" icon="chart">
          <BarChart stacked labels={days.map((d) => (iso(d) === todayIso ? 'Nay' : `${d.getDate()}`))} series={series} height={200} format={(v) => `${v}`} highlight={13} />
          <div className="legend" style={{ marginTop: 6 }}><span><i style={{ background: TYPES.run.color }} />Chạy bộ (km)</span><span><i style={{ background: TYPES.walk.color }} />Đi bộ (km)</span></div>
        </Card>
        <Card title="Tổng km mỗi tuần" icon="trend">
          <BarChart labels={weeks.map((w) => dm(w))} series={[{ name: 'km', color: 'var(--mint)', values: weekly }]} height={200} highlight={7} />
        </Card>
      </div>

      <div className="grid g-main">
        <Card title="Buổi tập gần đây" icon="journal">
          <div className="list">
            {[...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((w) => (
              <div className="row" key={w.id}>
                <span className={`icon-tile ${w.type === 'walk' ? 'lav' : ''}`} style={{ width: 34, height: 34 }}><Icon name={TYPES[w.type].icon} size={16} /></span>
                <div className="row-main">
                  <div className="row-title">{w.name}</div>
                  <div className="row-sub">{dow(parse(w.date))} {dmy(w.date)}{w.minutes ? ` · ${w.minutes} phút` : ''}{pace(w) ? ` · ${pace(w)}` : ''} · {SOURCE[w.source] || 'Ghi tay'}</div>
                </div>
                <b className="num">{num(w.km, 2)} km</b>
                {w.source !== 'strava' && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => remove(w.id)} aria-label="Xóa buổi tập"><Icon name="trash" size={15} /></button>}
              </div>
            ))}
            {!workouts.length && <div className="empty">Chưa có buổi tập nào. Đồng bộ Strava hoặc ghi tay ở bên cạnh.</div>}
          </div>
        </Card>
        <Card title="Ghi tay buổi tập" icon="plus">
          <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
            <div className="tabs seg" style={{ margin: 0 }}>{Object.entries(TYPES).map(([k, t]) => <button type="button" key={k} className={`tab ${form.type === k ? 'active' : ''}`} onClick={() => setForm({ ...form, type: k })}>{t.label}</button>)}</div>
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
