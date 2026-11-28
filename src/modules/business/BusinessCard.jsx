import { useModule } from '../../core/store.jsx';
import { SERVER } from '../../core/platform.js';
import { useAccount } from '../../core/AuthGate.jsx';
import { go } from '../../core/router.js';
import Icon from '../../ui/Icon.jsx';
import { useConnections } from './api.js';
import { ago, delta, fmtDelta, fmtInt, fmtMoneyShort, period } from './metrics.js';
import { useSales } from './Sales.jsx';

// Thẻ Business trên màn Hôm nay: doanh số hôm nay, số đơn và liên kết mở module.
export default function BusinessCard() {
  const acc = useAccount();
  const [slice] = useModule('business');
  const demo = !SERVER || !!slice?.demo;
  const allowed = !SERVER || !!acc?.business;
  const conns = useConnections(demo || !allowed);
  const sales = allowed ? (conns.data?.connections || []).find((c) => c.type === 'sales') : null;
  const p = period('today');
  const s = useSales(sales, p, demo);
  if (!allowed) return null;
  const dl = delta(s.t?.revenue, s.t0?.revenue);
  const txt = fmtDelta(dl, 'money');
  return (
    <button className="card bz-home" onClick={() => go('business')}>
      <div className="bz-home-head">
        <span className="icon-tile"><Icon name="briefcase" size={18} /></span>
        <span style={{ flex: 1, minWidth: 0 }}><b>Business</b><small>{demo ? 'Demo data' : sales ? `Sales · updated ${ago(s.cur.data?.fetchedAt || sales.lastOk)}` : 'Sales not connected'}</small></span>
        <Icon name="chevR" size={16} />
      </div>
      {conns.loading && !conns.data ? <div className="bz-skel" />
        : !sales ? <div className="faint" style={{ fontSize: 13 }}>Not connected. Open Business to connect Sales.</div>
          : (
            <div className="bz-home-vals">
              <span><small>Revenue today</small><b>{s.cur.error && !s.t ? '—' : fmtMoneyShort(s.t?.revenue)}</b>{txt && <em className={dl.abs >= 0 ? 'good' : 'rose'}>{txt} vs yesterday</em>}</span>
              <span><small>Orders</small><b>{fmtInt(s.t?.orders)}</b>{s.t?.created > s.t?.orders && <em className="faint">{fmtInt(s.t.created)} created</em>}</span>
            </div>
          )}
    </button>
  );
}
