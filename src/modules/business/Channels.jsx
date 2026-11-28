import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { useExtra, useRange } from './api.js';
import { addDay, delta, fmtInt, fmtNum, fmtStamp, series, ttTotals, vnToday, ytTotals } from './metrics.js';
import { DayBars, Kpi, NotConnected, PeriodBar, Section, Seg, Source, StateBox, StatusChip } from './ui.jsx';

export function useYt(conn, p, demo) {
  const cur = useRange(conn, p.from, p.to, null, demo);
  const prev = useRange(conn, p.prev.from, p.prev.to, null, demo);
  return { cur, prev, t: cur.data?.days ? ytTotals(cur.data.days) : null, t0: prev.data?.days ? ytTotals(prev.data.days) : null };
}
// TikTok: lấy thêm 1 ngày trước kỳ để tính thay đổi số người theo dõi.
export function useTt(conn, p, demo) {
  const cur = useRange(conn, addDay(p.from, -1), p.to, null, demo);
  return { cur, t: cur.data?.days ? ttTotals(cur.data.days, p.from) : null };
}

export default function Channels({ ctx }) {
  const { p, params, setPeriod, nav, go } = ctx;
  const plat = params.plat === 'tiktok' ? 'tiktok' : 'youtube';
  const list = ctx.byType(plat);
  const conn = list.find((c) => c.id === params.acc) || list[0];
  return (
    <div className="bz-stack">
      <PeriodBar p={p} set={(x) => setPeriod({ ...x, plat })} />
      <Seg value={plat} onChange={(v) => nav({ ...params, plat: v, acc: undefined }, true)} label="Platform" options={[['youtube', 'YouTube'], ['tiktok', 'TikTok']]} />
      {list.length > 1 && (
        <select className="input bz-select" aria-label="Channel" value={conn?.id} onChange={(e) => nav({ ...params, plat, acc: e.target.value }, true)}>
          {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {!conn ? <NotConnected type={plat} go={go} /> : plat === 'tiktok' ? <TikTok key={conn.id} ctx={ctx} conn={conn} /> : <YouTube key={conn.id} ctx={ctx} conn={conn} />}
    </div>
  );
}

function Videos({ ex, lifetime }) {
  const vids = ex.data?.extra?.videos;
  if (ex.loading && !vids) return <StateBox kind="loading" />;
  if (!vids?.length) return <div className="empty">{ex.error ? 'Couldn’t load videos.' : lifetime ? 'No videos posted in this period.' : 'No video views in this period.'}</div>;
  return (
    <div className="bz-videos">
      {vids.map((v) => {
        const Tag = v.url ? 'a' : 'div';
        return (
          <Tag key={v.id} className="bz-video" {...(v.url ? { href: v.url, target: '_blank', rel: 'noreferrer' } : {})}>
            <span className="bz-thumb">{v.thumb ? <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon name="play" size={18} />}</span>
            <span className="bz-li-main">
              <span className="bz-vtitle">{v.title}</span>
              <small>{v.published ? `Posted ${fmtStamp(Date.parse(v.published)).split(',')[0]}` : ''}</small>
              <small><b>{fmtInt(v.views)}</b> views{v.likes != null ? ` · ${fmtInt(v.likes)} likes` : ''}{v.comments != null ? ` · ${fmtInt(v.comments)} comments` : ''}{v.shares != null ? ` · ${fmtInt(v.shares)} shares` : ''}{v.watchMinutes != null && !lifetime ? ` · ${fmtNum(v.watchMinutes / 60, 0)} h watched` : ''}</small>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

function YouTube({ ctx, conn }) {
  const { p, demo } = ctx;
  const { cur, t, t0 } = useYt(conn, p, demo);
  const ex = useExtra(conn, p.from, p.to, demo);
  const chartFrom = p.key === 'today' ? addDay(p.to, -13) : p.from;
  const chart = useRange(conn, chartFrom, p.to, null, demo);
  const [metric, setMetric] = useState('views');
  if (cur.loading && !cur.data) return <StateBox kind="loading" />;
  if (cur.error && !cur.data?.days) return <><StateBox kind="error" title="Couldn't load YouTube" text={conn.error || 'Try again in a moment.'} action="Retry" onAction={cur.reload} /><Source conn={conn} /></>;
  const dl = (k) => delta(t?.[k], t0?.[k]);
  const pending = !!conn.lagDays && p.to > addDay(vnToday(), -conn.lagDays);
  const pts = series(chart.data?.days, chartFrom, p.to, metric).filter((x) => x.d <= vnToday());
  return (
    <>
      {conn.status !== 'connected' && <div className="bz-note"><StatusChip status={conn.status} /> {conn.error}</div>}
      <div className="bz-grid">
        <Kpi label="Subscribers now" value={fmtInt(conn.meta?.subscribers)} sub={conn.meta?.statsAt ? `total at ${fmtStamp(conn.meta.statsAt)}` : 'current total'} />
        <Kpi label="Net subscribers" value={t?.net == null ? '—' : `${t.net > 0 ? '+' : ''}${fmtInt(t.net)}`} sub="gained − lost in period" dl={dl('net')} prevLabel={p.prevLabel} />
        <Kpi label="Views" value={fmtInt(t?.views)} dl={dl('views')} prevLabel={p.prevLabel} />
        <Kpi label="Watch time" value={t?.watchHours == null ? '—' : `${fmtNum(t.watchHours, 0)} h`} dl={dl('watchHours')} prevLabel={p.prevLabel} />
        <Kpi label="Subscribers gained" value={fmtInt(t?.subsGained)} dl={dl('subsGained')} prevLabel={p.prevLabel} />
        <Kpi label="Subscribers lost" value={fmtInt(t?.subsLost)} dl={dl('subsLost')} good="down" prevLabel={p.prevLabel} />
      </div>
      <div className="bz-note amber"><Icon name="clock" size={13} />YouTube reports days in Pacific Time and usually 2–3 days late{pending ? '; the latest days are not available yet and are not counted as zero' : ''}.</div>
      <Source conn={conn} fetchedAt={cur.data?.fetchedAt} />
      <Section title={metric === 'views' ? 'Views per day' : 'Net subscribers per day'} right={<Seg value={metric} onChange={setMetric} label="Chart metric" options={[['views', 'Views'], ['subsGained', 'Gained']]} />}>
        <div className="faint bz-chart-sub">{p.key === 'today' ? 'Last 14 days' : p.label} · grey = not available yet</div>
        <DayBars pts={pts} format={fmtInt} color="var(--rose)" highlight={p.to} />
      </Section>
      <Section title="Top videos in period" right={<span className="faint" style={{ fontSize: 12 }}>by views in period</span>}><Videos ex={ex} /></Section>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {conn.openUrl && <a className="btn ghost sm" href={conn.openUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open channel</a>}
        {conn.studioUrl && <a className="btn ghost sm" href={conn.studioUrl} target="_blank" rel="noreferrer"><Icon name="chart" size={14} />YouTube Studio</a>}
      </div>
    </>
  );
}

function TikTok({ ctx, conn }) {
  const { p, demo } = ctx;
  const { cur, t } = useTt(conn, p, demo);
  const ex = useExtra(conn, p.from, p.to, demo);
  const hist = useRange(conn, addDay(p.to, -29), p.to, null, demo);
  if (cur.loading && !cur.data) return <StateBox kind="loading" />;
  if (cur.error && !cur.data?.days) return <><StateBox kind="error" title="Couldn't load TikTok" text={conn.error || 'Try again in a moment.'} action="Retry" onAction={cur.reload} /><Source conn={conn} /></>;
  const pts = series(hist.data?.days, addDay(p.to, -29), p.to, 'followers');
  const known = pts.filter((x) => x.v != null);
  const vids = ex.data?.extra?.videos || [];
  const sum = (k) => (vids.length ? vids.reduce((a, v) => a + (v[k] || 0), 0) : null);
  const minF = known.length ? Math.min(...known.map((x) => x.v)) : 0;
  return (
    <>
      {conn.status !== 'connected' && <div className="bz-note"><StatusChip status={conn.status} /> {conn.error}</div>}
      <div className="bz-grid">
        <Kpi label="Followers now" value={fmtInt(t?.followers)} sub={t?.at ? `as of ${t.at}` : 'current total'} />
        <Kpi label="Follower change" value={t?.change == null ? '—' : `${t.change > 0 ? '+' : ''}${fmtInt(t.change)}`} sub={t?.change == null ? 'needs daily snapshots before and in the period' : `since ${t.since}`} />
        <Kpi label="Views of videos posted" value={fmtInt(sum('views'))} sub="lifetime views, videos posted in period" />
        <Kpi label="Likes on those videos" value={fmtInt(sum('likes'))} sub={`${fmtInt(sum('comments'))} comments · ${fmtInt(sum('shares'))} shares`} />
        <Kpi label="Total likes" value={fmtInt(t?.likes)} sub="all-time, whole account" />
        <Kpi label="Videos" value={fmtInt(t?.videos)} sub="public videos, all-time" />
      </div>
      <div className="bz-note amber"><Icon name="alert" size={13} />TikTok's API gives current totals only. Avenor saves a snapshot every day, so follower trends start from the day you connected. Views per day are not available.</div>
      <Source conn={conn} fetchedAt={cur.data?.fetchedAt} />
      <Section title="Followers, last 30 days" right={<span className="faint" style={{ fontSize: 12 }}>daily snapshot</span>}>
        {known.length < 2 ? <div className="empty">Not enough snapshots yet. Check back after a few days.</div>
          : <DayBars pts={pts.map((x) => ({ ...x, v: x.v == null ? null : x.v - minF + 1 }))} format={(v) => fmtInt(v + minF - 1)} color="var(--text)" />}
      </Section>
      <Section title="Videos posted in period" right={<span className="faint" style={{ fontSize: 12 }}>lifetime stats</span>}><Videos ex={ex} lifetime /></Section>
      {conn.openUrl && <a className="btn ghost sm" style={{ justifySelf: 'start' }} href={conn.openUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open channel</a>}
    </>
  );
}
