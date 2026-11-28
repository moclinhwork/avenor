import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { useExtra, useRange } from './api.js';
import { adsTotals, delta, fmtInt, fmtMoney, fmtMoneyShort, fmtNum, fmtPct, series, webTotals, TZ, addDay, vnToday } from './metrics.js';
import { DayBars, Kpi, NotConnected, PeriodBar, Section, Seg, Source, StateBox, StatusChip, TYPE_LABEL } from './ui.jsx';

export function useAds(conn, p, demo) {
  const cur = useRange(conn, p.from, p.to, null, demo);
  const prev = useRange(conn, p.prev.from, p.prev.to, null, demo);
  return { cur, prev, t: cur.data?.days ? adsTotals(cur.data.days) : null, t0: prev.data?.days ? adsTotals(prev.data.days) : null };
}

function Picker({ list, value, onChange }) {
  if (list.length < 2) return null;
  return (
    <select className="input bz-select" aria-label="Account" value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.accountName && c.accountName !== c.name ? ` · ${c.accountName}` : ''}</option>)}
    </select>
  );
}

export default function Marketing({ ctx }) {
  const { p, params, setPeriod, nav, go } = ctx;
  const src = ['google_ads', 'meta_ads', 'ga4'].includes(params.src) ? params.src : 'google_ads';
  const list = ctx.byType(src);
  const conn = list.find((c) => c.id === params.acc) || list[0];
  const setSrc = (s) => nav({ ...params, src: s, acc: undefined }, true);
  return (
    <div className="bz-stack">
      <PeriodBar p={p} set={(x) => setPeriod({ ...x, src })} />
      <Seg value={src} onChange={setSrc} label="Marketing source" options={[['google_ads', 'Google Ads'], ['meta_ads', 'Meta Ads'], ['ga4', 'Website']]} />
      <Picker list={list} value={conn?.id} onChange={(id) => nav({ ...params, src, acc: id }, true)} />
      {!conn ? <NotConnected type={src} go={go} />
        : src === 'ga4' ? <Website key={conn.id} ctx={ctx} conn={conn} /> : <Ads key={conn.id} ctx={ctx} conn={conn} />}
      {src !== 'ga4' && <AllAds ctx={ctx} />}
    </div>
  );
}

function TzNote({ conn }) {
  if (!conn.tz || conn.tz === TZ) return null;
  return <div className="bz-note amber"><Icon name="clock" size={13} />Days follow this account's time zone ({conn.tz}), not Vietnam time.</div>;
}

function Ads({ ctx, conn }) {
  const { p, demo } = ctx;
  const { cur, t, t0 } = useAds(conn, p, demo);
  const chartFrom = p.key === 'today' ? addDay(p.to, -13) : p.from;
  const chart = useRange(conn, chartFrom, p.to, null, demo);
  const [metric, setMetric] = useState('spend');
  const cy = conn.currency || '';
  if (cur.loading && !cur.data) return <StateBox kind="loading" />;
  if (cur.error && !cur.data?.days) return <><StateBox kind="error" title={`Couldn't load ${TYPE_LABEL[conn.type]}`} text={conn.error || 'Try again in a moment.'} action="Retry" onAction={cur.reload} /><Source conn={conn} /></>;
  const dl = (k) => delta(t?.[k], t0?.[k]);
  const hasConv = conn.meta?.hasConversions && t?.conversions != null;
  const noData = !cur.data?.days?.length;
  const pts = series(chart.data?.days, chartFrom, p.to, metric).filter((x) => x.d <= vnToday());
  const fmtM = metric === 'spend' ? (v) => fmtMoneyShort(v, cy) : fmtInt;
  return (
    <>
      {conn.status !== 'connected' && <div className="bz-note"><StatusChip status={conn.status} /> {conn.error}</div>}
      {noData ? <StateBox kind="empty" title={conn.status === 'syncing' || !conn.lastOk ? 'First sync in progress' : 'No data for this period yet'} text={conn.status === 'syncing' || !conn.lastOk ? 'Numbers appear here when the first sync finishes.' : 'The account has not reported any day in this period.'} />
        : (
          <div className="bz-grid">
            <Kpi label="Spend" value={fmtMoneyShort(t?.spend, cy)} sub={fmtMoney(t?.spend, cy)} dl={dl('spend')} kind="money" cur={cy} good={null} prevLabel={p.prevLabel} />
            <Kpi label="Impressions" value={fmtInt(t?.impressions)} dl={dl('impressions')} prevLabel={p.prevLabel} />
            <Kpi label={conn.type === 'meta_ads' ? 'Clicks (all)' : 'Clicks'} value={fmtInt(t?.clicks)} dl={dl('clicks')} prevLabel={p.prevLabel} />
            <Kpi label="CTR" value={fmtPct(t?.ctr, 2)} sub="clicks ÷ impressions" dl={dl('ctr')} kind="pct" prevLabel={p.prevLabel} />
            <Kpi label="CPC" value={fmtMoneyShort(t?.cpc, cy)} sub="spend ÷ clicks" dl={dl('cpc')} kind="money" cur={cy} good="down" prevLabel={p.prevLabel} />
            {hasConv && <Kpi label={conn.meta?.conversionLabel || 'Conversions'} value={fmtNum(t?.conversions, 1)} sub={`as counted by ${TYPE_LABEL[conn.type]}`} dl={dl('conversions')} prevLabel={p.prevLabel} />}
            {hasConv && <Kpi label="CPA" value={fmtMoneyShort(t?.cpa, cy)} sub="spend ÷ conversions" dl={dl('cpa')} kind="money" cur={cy} good="down" prevLabel={p.prevLabel} />}
            {hasConv && t?.roas != null && <Kpi label="ROAS" value={`${fmtNum(t.roas, 2)}×`} sub="conversion value ÷ spend" dl={dl('roas')} kind="int" prevLabel={p.prevLabel} />}
            {t?.messaging != null && <Kpi label="Messaging conversations" value={fmtInt(t.messaging)} sub="started, as counted by Meta" dl={dl('messaging')} prevLabel={p.prevLabel} />}
          </div>
        )}
      {!hasConv && !noData && <div className="bz-note">Conversions, CPA and ROAS are hidden: this account has no conversion tracking that reports {conn.type === 'meta_ads' ? 'purchases' : 'conversions'}.</div>}
      <TzNote conn={conn} />
      <Source conn={conn} fetchedAt={cur.data?.fetchedAt} />
      {!noData && (
        <Section title={metric === 'spend' ? `Spend per day (${cy || 'account currency'})` : metric === 'clicks' ? 'Clicks per day' : 'Conversions per day'} right={<Seg value={metric} onChange={setMetric} label="Chart metric" options={[['spend', 'Spend'], ['clicks', 'Clicks'], ...(hasConv ? [['conversions', 'Conv.']] : [])]} />}>
          <div className="faint bz-chart-sub">{p.key === 'today' ? 'Last 14 days' : p.label} · {conn.tz && conn.tz !== TZ ? `days in ${conn.tz}` : 'Vietnam time'}</div>
          <DayBars pts={pts} format={fmtM} color={conn.type === 'meta_ads' ? 'var(--sky)' : 'var(--lav)'} highlight={p.to} />
        </Section>
      )}
      {conn.openUrl && <a className="btn ghost sm" style={{ justifySelf: 'start' }} href={conn.openUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open {conn.type === 'meta_ads' ? 'Ads Manager' : 'Google Ads'}</a>}
    </>
  );
}

// Tổng chi phí mọi tài khoản quảng cáo: chỉ cộng cùng tiền tệ, chuyển đổi để riêng từng nền tảng.
function AllAds({ ctx }) {
  const ads = [...ctx.byType('google_ads'), ...ctx.byType('meta_ads')];
  if (ads.length < 2) return null;
  return (
    <Section title="All ad accounts" right={<span className="faint" style={{ fontSize: 12 }}>{ctx.p.label}</span>}>
      <div className="bz-list">{ads.map((c) => <AdsRow key={c.id} ctx={ctx} conn={c} />)}</div>
      <div className="bz-note">Conversions are shown per platform and are not added up, because platforms can count the same sale twice.</div>
    </Section>
  );
}
function AdsRow({ ctx, conn }) {
  const { t } = useAds(conn, ctx.p, ctx.demo);
  return (
    <div className="bz-li">
      <span className="bz-li-main">{conn.name}<small>{TYPE_LABEL[conn.type]} · {conn.currency || '—'}{conn.meta?.hasConversions && t?.conversions != null ? ` · ${fmtNum(t.conversions, 1)} conv.` : ''}</small></span>
      <span className="bz-li-amt">{fmtMoneyShort(t?.spend, conn.currency)}</span>
    </div>
  );
}

export function useWeb(conn, p, demo) {
  const cur = useRange(conn, p.from, p.to, null, demo);
  const prev = useRange(conn, p.prev.from, p.prev.to, null, demo);
  return { cur, prev, t: cur.data?.days ? webTotals(cur.data.days) : null, t0: prev.data?.days ? webTotals(prev.data.days) : null };
}

function Website({ ctx, conn }) {
  const { p, demo } = ctx;
  const { cur, t, t0 } = useWeb(conn, p, demo);
  const ex = useExtra(conn, p.from, p.to, demo);
  const chartFrom = p.key === 'today' ? addDay(p.to, -13) : p.from;
  const chart = useRange(conn, chartFrom, p.to, null, demo);
  const [metric, setMetric] = useState('sessions');
  if (cur.loading && !cur.data) return <StateBox kind="loading" />;
  if (cur.error && !cur.data?.days) return <><StateBox kind="error" title="Couldn't load website data" text={conn.error || 'Try again in a moment.'} action="Retry" onAction={cur.reload} /><Source conn={conn} /></>;
  const dl = (k) => delta(t?.[k], t0?.[k]);
  const x = ex.data?.extra;
  const pts = series(chart.data?.days, chartFrom, p.to, metric).filter((d) => d.d <= vnToday());
  const total = (x?.channels || []).reduce((a, c) => a + c.sessions, 0);
  return (
    <>
      {!cur.data?.days?.length ? <StateBox kind="empty" title={!conn.lastOk ? 'First sync in progress' : 'No data for this period yet'} />
        : (
          <div className="bz-grid">
            <Kpi label="Active users" value={fmtInt(x?.uniqueUsers ?? null)} sub="unique in period (GA4)" prevLabel={p.prevLabel} />
            <Kpi label="Sessions" value={fmtInt(t?.sessions)} dl={dl('sessions')} prevLabel={p.prevLabel} />
            <Kpi label="Views" value={fmtInt(t?.views)} dl={dl('views')} prevLabel={p.prevLabel} />
            <Kpi label="Engagement rate" value={fmtPct(t?.engagement)} sub="engaged ÷ all sessions" dl={dl('engagement')} kind="pct" prevLabel={p.prevLabel} />
            {t?.keyEvents ? <Kpi label="Key events" value={fmtInt(t.keyEvents)} sub="conversions set up in GA4" dl={dl('keyEvents')} prevLabel={p.prevLabel} /> : null}
          </div>
        )}
      <TzNote conn={conn} />
      <Source conn={conn} fetchedAt={cur.data?.fetchedAt} />
      <Section title={metric === 'sessions' ? 'Sessions per day' : metric === 'views' ? 'Views per day' : 'Active users per day'} right={<Seg value={metric} onChange={setMetric} label="Chart metric" options={[['sessions', 'Sessions'], ['views', 'Views'], ['activeUsers', 'Users']]} />}>
        <div className="faint bz-chart-sub">{p.key === 'today' ? 'Last 14 days' : p.label}{metric === 'activeUsers' ? ' · daily users; the card counts each user once' : ''}</div>
        <DayBars pts={pts} format={fmtInt} color="var(--lav)" highlight={p.to} />
      </Section>
      <Section title="Traffic sources" right={<span className="faint" style={{ fontSize: 12 }}>sessions</span>}>
        {ex.loading && !x ? <StateBox kind="loading" /> : x?.channels?.length ? <div className="bz-list">{x.channels.map((c) => (
          <div key={c.name} className="bz-li"><span className="bz-li-main">{c.name || '(not set)'}<span className="bz-bar"><i style={{ width: `${total ? (c.sessions / total) * 100 : 0}%` }} /></span></span><b>{fmtInt(c.sessions)}</b></div>
        ))}</div> : <div className="empty">{ex.error ? 'Couldn’t load traffic sources.' : 'No sessions in this period.'}</div>}
      </Section>
      <Section title="Top landing pages">
        {x?.landing?.length ? <div className="bz-list">{x.landing.map((l) => (
          <div key={l.path} className="bz-li"><span className="bz-li-main bz-path">{l.path || '/'}<small>{fmtPct(l.sessions ? (l.engaged / l.sessions) * 100 : null, 0)} engaged</small></span><b>{fmtInt(l.sessions)}</b></div>
        ))}</div> : <div className="empty">{ex.loading ? 'Loading…' : 'No landing pages in this period.'}</div>}
      </Section>
      {x?.keyEvents?.length > 0 && (
        <Section title="Conversion events">
          <div className="bz-list">{x.keyEvents.map((e) => <div key={e.name} className="bz-li"><span className="bz-li-main">{e.name}</span><b>{fmtInt(e.count)}</b></div>)}</div>
        </Section>
      )}
      {conn.openUrl && <a className="btn ghost sm" style={{ justifySelf: 'start' }} href={conn.openUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open Google Analytics</a>}
    </>
  );
}
