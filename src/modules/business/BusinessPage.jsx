import { useEffect, useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { SERVER } from '../../core/platform.js';
import { useAccount } from '../../core/AuthGate.jsx';
import Icon from '../../ui/Icon.jsx';
import { useConnections } from './api.js';
import { period } from './metrics.js';
import Overview from './Overview.jsx';
import Sales from './Sales.jsx';
import Marketing from './Marketing.jsx';
import Channels from './Channels.jsx';
import Connections from './Connections.jsx';
import Settings from './Settings.jsx';
import { StateBox } from './ui.jsx';

// Điều hướng bằng hash: #business?tab=sales&p=week, #business?v=connections… để nút Back của Android quay lại đúng màn.
const read = () => Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || ''));
function useParams() {
  const [p, setP] = useState(read);
  useEffect(() => { const on = () => setP(read()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return p;
}
const toHash = (params) => { const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString(); return `#business${q ? `?${q}` : ''}`; };
const nav = (params, replace) => {
  const h = toHash(params);
  if (replace) { history.replaceState(null, '', h); window.dispatchEvent(new HashChangeEvent('hashchange')); } else window.location.hash = h;
};

const TABS = [['overview', 'Overview', 'home'], ['sales', 'Sales', 'bag'], ['marketing', 'Marketing', 'trend'], ['channels', 'Channels', 'video']];

export default function BusinessPage() {
  const params = useParams();
  const [slice, setSlice] = useModule('business');
  const notify = useNotify();
  const acc = useAccount();
  const demo = !SERVER || !!slice?.demo;
  const conns = useConnections(demo);
  const tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'overview';
  const p = period(params.p || 'today', { from: params.from, to: params.to });

  // Giữ kỳ đang chọn khi đổi tab; v (màn phụ) mở chồng lên và Back quay về.
  const keep = { p: params.p, from: params.p === 'custom' ? params.from : undefined, to: params.p === 'custom' ? params.to : undefined };
  const go = (next) => nav({ ...(next.v ? {} : { tab, ...keep }), ...next });
  const setPeriod = (next) => nav({ tab, ...next }, true);

  if (SERVER && acc && !acc.business && !slice?.demo) {
    return (
      <div className="bz fade-in">
        <div className="ac-headrow"><h1 className="ac-h1">Business</h1></div>
        <StateBox kind="error" title="No access to Business" text="This Avenor account is not allowed to view business data. Ask the owner to add it to BUSINESS_USERS on the server." />
      </div>
    );
  }

  const ctx = { p, params, go, setPeriod, nav, demo, slice, setSlice, notify, conns: conns.data?.connections || [], providers: conns.data?.providers || {}, connsState: conns };
  const byType = (t) => ctx.conns.filter((c) => c.type === t);
  ctx.byType = byType;

  if (params.v === 'connections') return <div className="bz fade-in"><Connections ctx={ctx} /></div>;
  if (params.v === 'settings') return <div className="bz fade-in"><Settings ctx={ctx} /></div>;

  const bad = ctx.conns.filter((c) => c.status === 'needs_auth' || c.status === 'error').length;
  return (
    <div className="bz fade-in">
      <div className="ac-headrow">
        <h1 className="ac-h1">Business</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" aria-label="Business settings and connections" title="Settings & connections" onClick={() => go({ v: 'settings' })}>
            <Icon name="grid" size={20} />{bad > 0 && <span className="dot" />}
          </button>
        </div>
      </div>
      {demo && <div className="bz-demo"><Icon name="alert" size={14} /><span><b>Demo data.</b> Sample numbers for preview only, not your business.{SERVER ? ' Turn off Demo mode in Business settings to see real data.' : ' Real data shows on the Avenor server version.'}</span></div>}
      <nav className="pb-nav bz-nav" aria-label="Business sections">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => nav({ tab: id, ...keep }, true)}><Icon name={icon} size={19} />{label}</button>
        ))}
      </nav>
      {conns.loading && !conns.data ? <StateBox kind="loading" />
        : conns.error && !conns.data ? <StateBox kind="error" title="Couldn't load Business" text={conns.error === 'business_forbidden' ? 'This account is not allowed to view business data.' : 'The server did not respond. Check your connection and try again.'} action="Retry" onAction={conns.reload} />
          : tab === 'sales' ? <Sales ctx={ctx} /> : tab === 'marketing' ? <Marketing ctx={ctx} /> : tab === 'channels' ? <Channels ctx={ctx} /> : <Overview ctx={ctx} />}
    </div>
  );
}
