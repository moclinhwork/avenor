import { useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { useRange } from './api.js';
import { addDay, ago, attention, delta, fmtInt, fmtMoney, fmtMoneyShort, fmtNum, fmtPct, goalProgress, period, series, sumSpend, TZ, vnToday } from './metrics.js';
import { useSales } from './Sales.jsx';
import { useAds, useWeb } from './Marketing.jsx';
import { useTt, useYt } from './Channels.jsx';
import { DayBars, Kpi, PeriodBar, Section, Source, StateBox, TYPE_LABEL } from './ui.jsx';

// Thu chi phí từng tài khoản quảng cáo (mỗi tài khoản một component để giữ đúng thứ tự hook).
function AdsCollect({ conn, p, demo, onValue }) {
  const { t, t0, cur } = useAds(conn, p, demo);
  useEffect(() => { onValue(conn.id, { spend: t?.spend ?? null, prev: t0?.spend ?? null, cpc: t?.cpc ?? null, cpa: t?.cpa ?? null, ctr: t?.ctr ?? null, currency: conn.currency, tz: conn.tz, name: conn.name, loading: cur.loading }); }, [t?.spend, t0?.spend, cur.loading]);
  return null;
}

export default function Overview({ ctx }) {
  const { p, setPeriod, go, demo, slice, setSlice } = ctx;
  const sales = ctx.byType('sales')[0];
  const s = useSales(sales, p, demo);
  const month = period('month');
  const ms = useRange(sales, month.from, month.to, null, demo);
  const chartFrom = p.key === 'today' ? addDay(p.to, -13) : p.from;
  const chart = useRange(sales, chartFrom, p.to, null, demo);

  const ads = [...ctx.byType('google_ads'), ...ctx.byType('meta_ads')];
  const [spend, setSpend] = useState({});
  const onValue = (id, v) => setSpend((x) => ({ ...x, [id]: v }));
  const parts = ads.map((c) => spend[c.id]).filter(Boolean);
  const sp = sumSpend(parts);
  const spPrev = sumSpend(parts.map((x) => ({ ...x, spend: x.prev })));

  const target = slice?.targets?.[month.from.slice(0, 7)] || null;
  const mRev = ms.data?.days ? ms.data.days.reduce((a, d) => a + (d.revenue || 0), 0) : null;
  const goal = goalProgress(target, mRev);

  const values = { revenue: s.t?.revenue, orders: s.t?.orders, canceled: s.t?.canceled, adsSpend: sp.total, periodLabel: p.label,
    cpc: parts.length === 1 ? parts[0].cpc : null, cpa: parts.length === 1 ? parts[0].cpa : null, ctr: parts.length === 1 ? parts[0].ctr : null };
  const alerts = attention({ connections: ctx.conns, values, thresholds: slice?.thresholds || [], goal });
  const pts = series(chart.data?.days, chartFrom, p.to, 'revenue').filter((x) => x.d <= vnToday());

  return (
    <div className="bz-stack">
      {ads.map((c) => <AdsCollect key={`${c.id}${p.from}${p.to}`} conn={c} p={p} demo={demo} onValue={onValue} />)}
      <PeriodBar p={p} set={setPeriod} />
      <div className="bz-grid">
        <Kpi label="Revenue" value={sales ? fmtMoneyShort(s.t?.revenue) : '—'} sub={sales ? null : 'Sales not connected'} dl={delta(s.t?.revenue, s.t0?.revenue)} kind="money" prevLabel={p.prevLabel} onClick={() => go({ tab: 'sales' })} />
        <Kpi label="Orders" value={sales ? fmtInt(s.t?.orders) : '—'} sub={sales ? 'counted in revenue' : 'Sales not connected'} dl={delta(s.t?.orders, s.t0?.orders)} prevLabel={p.prevLabel} onClick={() => go({ tab: 'sales' })} />
        <Kpi label="Ads spend" value={ads.length ? fmtMoneyShort(sp.total) : '—'} sub={!ads.length ? 'No ad account connected' : sp.skipped.length ? `${sp.skipped.length} account(s) in other currency not added` : sp.tzMismatch.length ? 'some accounts use another time zone' : `${sp.parts.length} account${sp.parts.length === 1 ? '' : 's'} in VND`} dl={delta(sp.total, spPrev.total)} kind="money" good={null} prevLabel={p.prevLabel} onClick={() => go({ tab: 'marketing' })} />
        <Kpi label="Profit" value="Coming soon" sub="needs cost of goods and other costs" dim />
      </div>
      {sales && <Source conn={sales} fetchedAt={s.cur.data?.fetchedAt} />}
      {ads.length > 0 && <div className="bz-src"><Icon name="trend" size={12} /><span>Ads spend: {ads.map((c) => c.name).join(', ')}</span></div>}

      <Section title="Revenue per day (VND)" right={<button className="link" onClick={() => go({ tab: 'sales' })}>Sales <Icon name="chevR" size={12} /></button>}>
        <div className="faint bz-chart-sub">{p.key === 'today' ? 'Last 14 days' : p.label} · orders counted in revenue</div>
        {!sales ? <StateBox kind="disconnected" title="Sales: Not connected" action="Open Connections" onAction={() => go({ v: 'connections', add: 'sales' })} />
          : chart.loading && !chart.data ? <StateBox kind="loading" />
            : chart.error && !chart.data?.days ? <StateBox kind="error" title="Couldn't load revenue" action="Retry" onAction={chart.reload} />
              : <DayBars pts={pts} format={fmtMoneyShort} highlight={p.to} />}
      </Section>

      <Goal ctx={ctx} goal={goal} target={target} month={month} mRev={mRev} setSlice={setSlice} loading={ms.loading && !ms.data} connected={!!sales} />

      <Summaries ctx={ctx} />

      <Section title="Needs attention" right={alerts.length ? <span className="chip amber">{alerts.length}</span> : null}>
        {alerts.length ? (
          <div className="bz-list">
            {alerts.map((a) => (
              <button key={a.id} className="bz-li bz-alert" onClick={() => go(a.to)}>
                <span className={`bz-dot ${a.level === 'bad' ? 'rose' : 'amber'}`} />
                <span className="bz-li-main">{a.title}<small>{a.reason}</small></span>
                <span className="link">{a.action}</span>
              </button>
            ))}
          </div>
        ) : <div className="empty">Nothing needs attention. Set your own alert limits in <button className="link" onClick={() => go({ v: 'settings' })}>Business settings</button>.</div>}
      </Section>
    </div>
  );
}

function Goal({ goal, target, month, mRev, setSlice, loading, connected, ctx }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(target ? String(target) : '');
  const key = month.from.slice(0, 7);
  const save = () => {
    const n = Number(String(val).replace(/[^\d]/g, ''));
    setSlice((s) => ({ ...s, targets: { ...(s?.targets || {}), [key]: n > 0 ? n : undefined } }));
    setEdit(false);
    ctx.notify(n > 0 ? 'Monthly target saved' : 'Monthly target removed');
  };
  return (
    <Section title={`Sales target · ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(`${month.from}T12:00:00Z`))}`} right={<button className="link" onClick={() => { setVal(target ? String(target) : ''); setEdit(!edit); }}>{edit ? 'Cancel' : target ? 'Edit' : 'Set target'}</button>}>
      {edit ? (
        <form className="bz-form-row" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="input" inputMode="numeric" aria-label="Target revenue in VND" placeholder="e.g. 600000000" value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn sm" type="submit">Save</button>
        </form>
      ) : !target ? <div className="empty">No target for this month yet.</div>
        : !connected ? <div className="empty">Connect Sales to track this target.</div>
          : loading ? <StateBox kind="loading" /> : (
            <div className="bz-goal">
              <div className="bz-goal-top"><b>{fmtMoneyShort(goal.achieved)}</b><span className="faint">of {fmtMoneyShort(goal.target)}</span><span className={`chip ${goal.pct >= 100 ? 'good' : ''}`}>{fmtPct(goal.pct, 0)}</span></div>
              <div className="bar"><i style={{ width: `${Math.min(100, goal.pct)}%` }} /></div>
              <div className="bz-goal-foot faint">
                {goal.over > 0 ? <span className="good">Target passed by {fmtMoney(goal.over)}</span> : <span>Remaining {fmtMoney(goal.remaining)}</span>}
                <span>Day {goal.day}/{goal.days} · on pace {fmtPct((goal.expected / goal.target) * 100, 0)}</span>
              </div>
            </div>
          )}
      {mRev != null && !target && !edit && <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>Revenue this month so far: {fmtMoneyShort(mRev)}</div>}
    </Section>
  );
}

function Summaries({ ctx }) {
  const { p, demo, go } = ctx;
  const web = ctx.byType('ga4')[0], yt = ctx.byType('youtube')[0], tt = ctx.byType('tiktok')[0];
  const w = useWeb(web, p, demo);
  const y = useYt(yt, p, demo);
  const t = useTt(tt, p, demo);
  const Row = ({ conn, type, children, tab }) => (
    <button className="bz-sum" onClick={() => go(tab)}>
      <span className="bz-sum-head"><b>{TYPE_LABEL[type]}</b>{conn ? <span className="faint">{conn.name}</span> : <span className="faint">Not connected</span>}<Icon name="chevR" size={14} /></span>
      {conn && <span className="bz-sum-vals">{children}</span>}
    </button>
  );
  const V = ({ label, value }) => <span><small>{label}</small><b>{value}</b></span>;
  return (
    <Section title="Website & channels">
      <div className="bz-sums">
        <Row conn={web} type="ga4" tab={{ tab: 'marketing', src: 'ga4' }}>
          <V label="Sessions" value={fmtInt(w.t?.sessions)} /><V label="Views" value={fmtInt(w.t?.views)} /><V label="Engagement" value={fmtPct(w.t?.engagement, 0)} />
        </Row>
        <Row conn={yt} type="youtube" tab={{ tab: 'channels', plat: 'youtube' }}>
          <V label="Views" value={fmtInt(y.t?.views)} /><V label="Net subs" value={y.t?.net == null ? '—' : `${y.t.net > 0 ? '+' : ''}${fmtInt(y.t.net)}`} /><V label="Watch h" value={y.t?.watchHours == null ? '—' : fmtNum(y.t.watchHours, 0)} />
        </Row>
        <Row conn={tt} type="tiktok" tab={{ tab: 'channels', plat: 'tiktok' }}>
          <V label="Followers" value={fmtInt(t.t?.followers)} /><V label="Change" value={t.t?.change == null ? '—' : `${t.t.change > 0 ? '+' : ''}${fmtInt(t.t.change)}`} /><V label="Videos" value={fmtInt(t.t?.videos)} />
        </Row>
      </div>
      <div className="bz-src"><Icon name="clock" size={12} /><span>{[web && `GA4 updated ${ago(web.lastOk)}`, yt && `YouTube updated ${ago(yt.lastOk)} (Pacific Time, 2–3 days late)`, tt && `TikTok snapshot ${ago(tt.lastOk)}`].filter(Boolean).join(' · ') || 'Connect sources in Business settings'}</span></div>
    </Section>
  );
}
