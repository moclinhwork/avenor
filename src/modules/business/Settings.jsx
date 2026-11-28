import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { SERVER } from '../../core/platform.js';
import { addDay, fmtMoney, METRIC_LABEL, vnToday } from './metrics.js';
import { StatusChip } from './ui.jsx';

const uid = () => Math.random().toString(36).slice(2, 9);

export default function Settings({ ctx }) {
  const { slice, setSlice, nav, conns, notify } = ctx;
  const back = () => (history.length > 1 ? history.back() : nav({}, true));
  const bad = conns.filter((c) => c.status === 'needs_auth' || c.status === 'error');
  const today = vnToday();
  const months = [0, 1, 2].map((k) => { const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); });
  const targets = slice?.targets || {};
  const th = slice?.thresholds || [];
  const setT = (key, v) => { const n = Number(String(v).replace(/[^\d]/g, '')); setSlice((s) => ({ ...s, targets: { ...(s?.targets || {}), [key]: n > 0 ? n : undefined } })); };
  const setTh = (list) => setSlice((s) => ({ ...s, thresholds: list }));
  return (
    <div className="bz-stack">
      <div className="ac-top"><button className="bare-btn" onClick={back} aria-label="Back"><Icon name="back" size={22} /></button></div>
      <h1 className="ac-h1">Business settings</h1>

      <button className="card bz-card bz-entry" onClick={() => nav({ v: 'connections' })}>
        <span className="icon-tile"><Icon name="link" size={18} /></span>
        <span className="bz-li-main"><b>Connections</b><small>{conns.length} connected{bad.length ? ` · ${bad.length} need attention` : ''}</small></span>
        {bad.length ? <StatusChip status={bad[0].status} /> : null}
        <Icon name="chevR" size={16} />
      </button>

      <section className="card bz-card">
        <div className="bz-card-head"><h3>Monthly sales targets</h3><span className="faint" style={{ fontSize: 12 }}>VND</span></div>
        {months.map((m) => <TargetRow key={m} m={m} value={targets[m]} onSave={(v) => { setT(m, v); notify('Target saved'); }} />)}
      </section>

      <section className="card bz-card">
        <div className="bz-card-head"><h3>Alert limits</h3><button className="link" onClick={() => setTh([...th, { id: uid(), metric: 'revenue', op: 'below', value: '' }])}><Icon name="plus" size={12} /> Add</button></div>
        <p className="faint" style={{ fontSize: 12.5, margin: '0 0 8px' }}>Shown in Needs attention when a number of the selected Overview period crosses your limit. CPC, CPA and CTR apply when exactly one ad account is connected.</p>
        {!th.length && <div className="empty">No alert limits yet.</div>}
        {th.map((t, i) => (
          <div key={t.id} className="bz-th">
            <select className="input" aria-label="Metric" value={t.metric} onChange={(e) => setTh(th.map((x, k) => (k === i ? { ...x, metric: e.target.value } : x)))}>
              {Object.entries(METRIC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="input" aria-label="Condition" value={t.op} onChange={(e) => setTh(th.map((x, k) => (k === i ? { ...x, op: e.target.value } : x)))}>
              <option value="below">below</option><option value="above">above</option>
            </select>
            <input className="input" inputMode="decimal" aria-label="Limit" placeholder="value" value={t.value} onChange={(e) => setTh(th.map((x, k) => (k === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
            <button className="bare-btn" aria-label="Remove limit" onClick={() => setTh(th.filter((_, k) => k !== i))}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </section>

      {SERVER && (
        <section className="card bz-card">
          <div className="bz-card-head"><h3>Demo mode</h3>
            <button className={`bz-switch ${slice?.demo ? "on" : ""}`} role="switch" aria-checked={!!slice?.demo} onClick={() => setSlice((s) => ({ ...s, demo: !s?.demo }))}><i /></button>
          </div>
          <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>Shows sample numbers, clearly marked “Demo data”, instead of your real data. Off by default.</p>
        </section>
      )}

      <section className="card bz-card">
        <div className="bz-card-head"><h3>Number rules</h3></div>
        <ul className="bz-rules">
          <li>Reports use Vietnam time (Asia/Ho_Chi_Minh). Weeks start on Monday.</li>
          <li>The current period is compared with the same span of the previous one; Sales also cuts at the same time of day.</li>
          <li>When the previous period is 0, the change is shown as a number, not a percentage.</li>
          <li>Ad spend is only added up across accounts in the same currency. Conversions stay per platform.</li>
          <li>CTR, CPC, CPA, ROAS and engagement rate are calculated from period totals, not averaged.</li>
          <li>0 is a real value. “—” means the number is missing or not available.</li>
          <li>Profit stays “Coming soon” until cost of goods and other costs are defined.</li>
        </ul>
      </section>
    </div>
  );
}

function TargetRow({ m, value, onSave }) {
  const [v, setV] = useState(value ? String(value) : '');
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${m}-15T00:00:00Z`));
  const dirty = String(value || '') !== v.replace(/[^\d]/g, '');
  return (
    <form className="bz-form-row" onSubmit={(e) => { e.preventDefault(); onSave(v); }}>
      <label className="bz-form-label" htmlFor={`t-${m}`}>{label}<small className="faint">{value ? fmtMoney(value) : 'not set'}</small></label>
      <input id={`t-${m}`} className="input" inputMode="numeric" placeholder="Target" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))} />
      <button className="btn sm" type="submit" disabled={!dirty}>Save</button>
    </form>
  );
}
export { addDay };
