import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { useRange } from './api.js';
import { delta, fmtInt, fmtMoney, fmtMoneyShort, salesTotals, series, addDay, vnToday } from './metrics.js';
import { DayBars, Kpi, NotConnected, PeriodBar, Section, Seg, Source, StateBox } from './ui.jsx';

const STATUS_LABEL = {
  wait_submit: 'Waiting to submit', cho_duyet: 'Awaiting approval', dang_sx: 'In production', ordered: 'Ordered', packing: 'Packing', shipped: 'Shipped',
  delivered: 'Delivered', received_money: 'Paid / money received', returning: 'Returning', returned: 'Returned', canceled: 'Canceled', removed: 'Removed', unknown: 'No status',
};
export const statusLabel = (s) => STATUS_LABEL[s] || s;

/** Số liệu Sales của kỳ hiện tại và kỳ trước (cùng khoảng thời gian). */
export function useSales(conn, p, demo) {
  const cur = useRange(conn, p.from, p.to, null, demo);
  const prev = useRange(conn, p.prev.from, p.prev.to, p.prev.cut, demo);
  const t = cur.data?.days ? salesTotals(cur.data.days) : null;
  const t0 = prev.data?.days ? salesTotals(prev.data.days) : null;
  return { cur, prev, t, t0 };
}

export default function Sales({ ctx }) {
  const { p, setPeriod, go, demo } = ctx;
  const conn = ctx.byType('sales')[0];
  const { cur, prev, t, t0 } = useSales(conn, p, demo);
  // Biểu đồ: kỳ "Today" hiển thị 14 ngày gần nhất để thấy xu hướng.
  const chartFrom = p.key === 'today' ? addDay(p.to, -13) : p.from;
  const chart = useRange(conn, chartFrom, p.to, null, demo);
  const [metric, setMetric] = useState('revenue');

  const head = (
    <div className="bz-row-head">
      <PeriodBar p={p} set={setPeriod} />
    </div>
  );
  if (!conn) return <div className="bz-stack">{head}<NotConnected type="sales" go={go} /></div>;
  const openBtn = <a className="btn ghost sm" href={conn.openUrl || 'https://sales.moclinh.vn/'} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Open Sales</a>;
  if (cur.loading && !cur.data) return <div className="bz-stack">{head}<StateBox kind="loading" /></div>;
  if (cur.error && !cur.data?.days) {
    return <div className="bz-stack">{head}<StateBox kind="error" title="Couldn't read Sales data" text={errText(cur.error, conn)} action="Retry" onAction={cur.reload} /><Source conn={conn} /></div>;
  }
  const dl = (k) => delta(t?.[k], t0?.[k]);
  const ex = cur.data?.extra || {};
  const pts = series(chart.data?.days, chartFrom, p.to, metric).filter((x) => x.d <= vnToday());
  const noOrders = t && t.created === 0;

  return (
    <div className="bz-stack">
      {head}
      <div className="bz-grid">
        <Kpi label="Revenue" value={fmtMoneyShort(t?.revenue)} sub={fmtMoney(t?.revenue)} dl={dl('revenue')} kind="money" prevLabel={p.prevLabel} />
        <Kpi label="Orders counted in revenue" value={fmtInt(t?.orders)} dl={dl('orders')} prevLabel={p.prevLabel} />
        <Kpi label="Average order value" value={fmtMoneyShort(t?.aov)} sub={t?.orders ? `${fmtMoneyShort(t.revenue)} ÷ ${fmtInt(t.orders)} orders` : 'No counted orders'} dl={dl('aov')} kind="money" prevLabel={p.prevLabel} />
        <Kpi label="New orders created" value={fmtInt(t?.created)} sub="All orders dated in period, incl. canceled" dl={dl('created')} prevLabel={p.prevLabel} />
        <Kpi label="Canceled / returned" value={fmtInt(t?.canceled)} sub={t?.canceledValue ? fmtMoneyShort(t.canceledValue) : 'Not counted in revenue'} dl={dl('canceled')} good="down" prevLabel={p.prevLabel} />
        <Kpi label="Discounts given" value={fmtMoneyShort(t?.discount)} sub="On counted orders" dl={dl('discount')} kind="money" good={null} prevLabel={p.prevLabel} />
      </div>
      <Source conn={conn} fetchedAt={cur.data?.fetchedAt} note={ex.lastOrderAt ? `latest order ${ex.lastOrderAt}` : null} />
      {prev.error && <div className="bz-note rose">Couldn't load the comparison period.</div>}

      <Section title={`${metric === 'revenue' ? 'Revenue per day (VND)' : 'Counted orders per day'}`} right={<Seg value={metric} onChange={setMetric} options={[['revenue', 'Revenue'], ['orders', 'Orders']]} label="Chart metric" />}>
        <div className="faint bz-chart-sub">{p.key === 'today' ? 'Last 14 days' : p.label} · {fmt(chartFrom)} – {fmt(p.to)} · same definition as the cards</div>
        {chart.loading && !chart.data ? <StateBox kind="loading" /> : <DayBars pts={pts} format={metric === 'revenue' ? fmtMoneyShort : fmtInt} highlight={p.to} />}
      </Section>

      {noOrders && <StateBox kind="empty" title="No orders in this period" text="Zero is a valid result: no orders were dated in this period." />}

      <Section title="Order status" right={<span className="faint" style={{ fontSize: 12 }}>orders created in period</span>}>
        {ex.statuses?.length ? (
          <div className="bz-list">
            {ex.statuses.map((s) => (
              <div key={s.status} className="bz-li">
                <span className={`bz-dot ${s.counted ? 'good' : 'rose'}`} />
                <span className="bz-li-main">{statusLabel(s.status)}<small>{s.counted ? 'counted in revenue' : 'not counted'}</small></span>
                <b>{fmtInt(s.n)}</b>
                <span className="bz-li-amt">{fmtMoneyShort(s.value)}</span>
              </div>
            ))}
          </div>
        ) : <div className="empty">No orders in this period.</div>}
      </Section>

      <Section title="Best-selling products" right={<span className="faint" style={{ fontSize: 12 }}>by line amount</span>}>
        {ex.products == null ? <div className="empty">Product lines are not available from the Sales data.</div>
          : ex.products.length ? (
            <div className="bz-list">
              {ex.products.map((x, i) => (
                <div key={`${x.name}${i}`} className="bz-li">
                  <span className="bz-rank">{i + 1}</span>
                  <span className="bz-li-main">{x.name}<small>{x.code ? `${x.code} · ` : ''}{fmtInt(x.qty)} sold</small></span>
                  <span className="bz-li-amt">{fmtMoneyShort(x.amount)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty">No products sold in this period.</div>}
      </Section>

      <Section title="How Sales numbers are counted">
        <ul className="bz-rules">
          <li><b>Revenue</b> = order total of orders not canceled or returned. Order total = items − discount + shipping charged to the customer. There is no tax field in Sales, and partial refunds are not recorded separately.</li>
          <li><b>Date</b> = the order date in Sales (Vietnam time). Today, this week and this month are compared with the same days and hours of the previous period.</li>
          <li><b>Orders counted in revenue</b> exclude canceled, returned, returning and removed. <b>New orders created</b> count every order dated in the period, including canceled ones; drafts are not counted.</li>
          <li><b>Average order value</b> = revenue ÷ orders counted in revenue.</li>
        </ul>
        <div style={{ marginTop: 10 }}>{openBtn}</div>
      </Section>
    </div>
  );
}

const fmt = (d) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
export function errText(code, conn) {
  if (code === 'sales_db_missing') return 'Avenor cannot find the Sales order database on the server. See the VPS setup steps (SALES_DATA_DIR).';
  if (code === 'sales_db_unreadable') return 'The Sales database exists but Avenor is not allowed to read it. See the VPS setup steps (read permission).';
  if (code === 'sales_schema') return 'The Sales database has no order table that Avenor recognises.';
  return conn?.error || 'The server did not respond. Try again.';
}
