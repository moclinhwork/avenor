import { useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { SERVER } from '../../core/platform.js';
import { createConnection, deleteConnection, listAccounts, startOAuth, syncConnection } from './api.js';
import { ago, fmtStamp } from './metrics.js';
import { Confirm, StateBox, StatusChip, TYPE_ICON, TYPE_LABEL } from './ui.jsx';

const ORDER = ['sales', 'google_ads', 'meta_ads', 'ga4', 'youtube', 'tiktok'];
const WHAT = {
  sales: 'Revenue, orders, order status and best sellers from sales.moclinh.vn (read-only).',
  google_ads: 'Spend, impressions, clicks, CTR, CPC and conversions. Read-only access (adwords scope).',
  meta_ads: 'Spend, impressions, clicks, CTR, CPC, purchases and messaging conversations. Permission: ads_read.',
  ga4: 'Active users, sessions, views, engagement, traffic sources, landing pages and key events. Permission: analytics.readonly.',
  youtube: 'Views, watch time, subscribers gained and lost, top videos. Permissions: youtube.readonly, yt-analytics.readonly.',
  tiktok: 'Followers, likes, video count and stats of videos posted. Scopes: user.info.basic, user.info.profile, user.info.stats, video.list.',
};
const SETUP = {
  sales: 'Mount the Sales data folder into Avenor (SALES_DATA_DIR in /opt/avenor/.env, default /opt/sothuchi/data) and run deploy/install.sh.',
  google_ads: 'Create a Google OAuth client and a Google Ads developer token, then run: bash deploy/set-business.sh google',
  meta_ads: 'Create a Meta app with Facebook Login (ads_read) or a System User token, then run: bash deploy/set-business.sh meta',
  ga4: 'Create a Google OAuth client with the Analytics Data API enabled, then run: bash deploy/set-business.sh google',
  youtube: 'Create a Google OAuth client with YouTube Data API v3 and YouTube Analytics API enabled, then run: bash deploy/set-business.sh google',
  tiktok: 'Create a TikTok app with Login Kit and Display API, then run: bash deploy/set-business.sh tiktok',
};
const OAUTH_ERR = { denied: 'You cancelled the permission screen.', scope: 'Not all read permissions were granted. Try again and allow every requested permission.', token: 'The provider did not confirm the sign-in. Try again.', state: 'The sign-in took too long. Try again.', not_configured: 'This source is not set up on the server yet.' };

export default function Connections({ ctx }) {
  const { params, nav, connsState, providers, demo, notify } = ctx;
  const back = () => (history.length > 1 ? history.back() : nav({ v: 'settings' }, true));
  const pick = params.cred && params.type ? { type: params.type, cred: params.cred } : params.add === 'sales' ? null : null;
  const [picking, setPicking] = useState(pick);
  const [busy, setBusy] = useState({});
  const [confirm, setConfirm] = useState(null);
  const err = params.err ? OAUTH_ERR[params.err] || 'Connecting did not finish.' : '';

  useEffect(() => { if (params.cred && params.type) setPicking({ type: params.type, cred: params.cred }); }, [params.cred, params.type]);
  const clearQuery = () => nav({ v: 'connections' }, true);

  const run = async (key, fn, ok) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { const r = await fn(); if (ok) notify(typeof ok === 'function' ? ok(r) : ok); }
    catch (e) { notify(e.code === 'business_forbidden' ? 'Not allowed' : 'Something went wrong, try again'); }
    setBusy((b) => ({ ...b, [key]: false }));
  };
  const connect = (type) => {
    if (demo) return notify('Demo mode: connecting is disabled');
    if (type === 'sales') return setPicking({ type: 'sales' });
    const pv = providers[type];
    startOAuth(pv.provider, type);
  };
  const sync = (c) => run(`s${c.id}`, () => syncConnection(c.id, true), (r) => (r.ok ? 'Sync finished' : r.error === 'too_soon' ? `Please wait ${r.retryIn}s before syncing again` : r.error === 'needs_auth' ? 'Needs authorization: reconnect' : 'Sync failed, last data kept'));
  const reconnect = (c) => (c.type === 'sales' ? sync(c) : startOAuth(providers[c.type]?.provider, c.type));

  const list = ctx.conns;
  return (
    <div className="bz-stack">
      <div className="ac-top"><button className="bare-btn" onClick={back} aria-label="Back"><Icon name="back" size={22} /></button></div>
      <h1 className="ac-h1">Connections</h1>
      <p className="muted" style={{ marginTop: -6 }}>Data is read through the Avenor server. Tokens stay on the server and are only used to read reports.</p>
      {demo && <div className="bz-demo"><Icon name="alert" size={14} /><span><b>Demo mode.</b> These connections are samples.</span></div>}
      {!SERVER && <div className="bz-note">Connections work on the Avenor server version (avenor.moclinh.vn).</div>}
      {err && <div className="bz-note rose"><Icon name="alert" size={13} />{TYPE_LABEL[params.type] || ''}: {err} <button className="link" onClick={clearQuery}>Dismiss</button></div>}
      {connsState.loading && !connsState.data ? <StateBox kind="loading" /> : connsState.error && !connsState.data ? <StateBox kind="error" title="Couldn't load connections" action="Retry" onAction={connsState.reload} /> : ORDER.map((type) => {
        const pv = providers[type] || {};
        const mine = list.filter((c) => c.type === type);
        return (
          <section key={type} className="card bz-card" id={`conn-${type}`}>
            <div className="bz-card-head">
              <h3><Icon name={TYPE_ICON[type]} size={16} /> {TYPE_LABEL[type]}</h3>
              {!mine.length && <StatusChip status="not_connected" />}
            </div>
            <p className="faint" style={{ fontSize: 12.5, margin: '0 0 10px' }}>{WHAT[type]}</p>
            {mine.map((c) => (
              <div key={c.id} className={`bz-conn ${params.id === c.id ? 'hl' : ''}`}>
                <div className="bz-conn-top">
                  <span className="bz-li-main">{c.name}<small>{c.accountName || c.accountId}{c.currency ? ` · ${c.currency}` : ''}{c.tz ? ` · ${c.tz}` : ''}</small></span>
                  <StatusChip status={busy[`s${c.id}`] ? 'syncing' : c.status} />
                </div>
                <div className="bz-conn-meta faint">
                  <span>Last successful sync: {c.lastOk ? `${fmtStamp(c.lastOk)} (${ago(c.lastOk)})` : 'never'}</span>
                  {c.syncEveryH ? <span>Auto sync every {c.syncEveryH} h{c.type === 'youtube' ? ' · data 2–3 days late' : ''}{c.snapshot ? ' · daily snapshot' : ''}</span> : <span>Read live from Sales, cached 1 min</span>}
                  {c.error && <span className="rose">{c.error}</span>}
                </div>
                <div className="bz-conn-actions">
                  <button className="btn sm ghost" disabled={busy[`s${c.id}`] || demo} onClick={() => sync(c)}><Icon name="refresh" size={13} />{c.type === 'sales' ? 'Test' : 'Sync now'}</button>
                  {c.type !== 'sales' && <button className="btn sm ghost" disabled={demo} onClick={() => reconnect(c)}><Icon name="link" size={13} />Reconnect</button>}
                  {c.type !== 'sales' && <button className="btn sm ghost" disabled={demo} onClick={() => connect(type)}>Choose another account</button>}
                  <button className="btn sm ghost danger" disabled={demo} onClick={() => setConfirm(c)}>Disconnect</button>
                </div>
              </div>
            ))}
            {pv.configured === false ? (
              <div className="bz-setup">
                <b>Server setup needed</b>
                <p>{SETUP[type]}</p>
                {pv.missing?.length > 0 && <p className="faint">Missing: {pv.missing.join(', ')}</p>}
              </div>
            ) : (type !== 'sales' || !mine.length) && (
              <button className="btn sm" style={{ marginTop: mine.length ? 10 : 0 }} onClick={() => connect(type)} disabled={demo}><Icon name="plus" size={14} />{mine.length ? 'Add another' : 'Connect'}</button>
            )}
          </section>
        );
      })}
      {picking && <Picker key={`${picking.type}${picking.cred || ''}`} pick={picking} onClose={() => { setPicking(null); clearQuery(); }} notify={notify} existing={list} />}
      {confirm && <Confirm text={`Disconnect ${confirm.name}? Saved numbers for it are deleted; you can connect again later.`} yes="Disconnect" danger onNo={() => setConfirm(null)} onYes={() => { const c = confirm; setConfirm(null); run(`d${c.id}`, () => deleteConnection(c.id), 'Disconnected'); }} />}
    </div>
  );
}

// Chọn tài khoản / property / kênh sau khi cấp quyền.
function Picker({ pick, onClose, notify, existing }) {
  const [st, setSt] = useState({ loading: true, accounts: [], error: null, info: null, detail: null });
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    listAccounts(pick.type, pick.cred).then((r) => {
      setSt({ loading: false, accounts: r.accounts || [], error: r.error || null, detail: r.detail || null });
      const first = (r.accounts || []).find((a) => !existing.some((c) => c.type === pick.type && c.accountId === a.id)) || r.accounts?.[0];
      if (first) { setSel(first.id); setName(defName(pick.type, first)); }
    }, (e) => setSt({ loading: false, accounts: [], error: e.code || 'error' }));
  }, []);
  const acc = st.accounts.find((a) => a.id === sel);
  const save = async () => {
    if (!acc || saving) return;
    setSaving(true);
    try {
      await createConnection({ type: pick.type, cred: pick.cred, accountId: acc.id, accountName: acc.name, name: name.trim() || defName(pick.type, acc), tz: acc.tz, currency: acc.currency, meta: acc.meta });
      notify(pick.type === 'sales' ? 'Sales connected' : 'Connected. First sync started');
      onClose();
    } catch (e) { notify(e.code === 'sales_db_missing' || e.code === 'sales_db_unreadable' ? 'Avenor cannot read the Sales data yet' : 'Could not connect, try again'); }
    setSaving(false);
  };
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Choose ${TYPE_LABEL[pick.type]} account`}>
        <div className="sheet-grip" />
        <h3 style={{ fontSize: 17, marginBottom: 10 }}>{pick.type === 'sales' ? 'Connect Sales' : `Choose ${pick.type === 'ga4' ? 'a property' : pick.type === 'youtube' || pick.type === 'tiktok' ? 'a channel' : 'an ad account'}`}</h3>
        {st.loading ? <StateBox kind="loading" />
          : st.error ? <StateBox kind="error" title="Couldn't list accounts" text={st.error === 'needs_auth' ? 'Access was not granted or has expired. Connect again.' : st.error === 'sales_db_missing' ? `Sales database not found in the container (${st.detail}). See the VPS setup steps.` : st.error === 'sales_db_unreadable' ? 'Avenor has no read permission on the Sales database. See the VPS setup steps.' : st.error} />
            : !st.accounts.length ? <StateBox kind="empty" title="No accounts found" text="This login has no accounts Avenor can read. Sign in with another account." />
              : (
                <div className="bz-pick">
                  {st.accounts.map((a) => {
                    const taken = existing.some((c) => c.type === pick.type && c.accountId === a.id);
                    return (
                      <label key={a.id} className={`bz-pick-row ${sel === a.id ? 'on' : ''}`}>
                        <input type="radio" name="acc" checked={sel === a.id} onChange={() => { setSel(a.id); setName(defName(pick.type, a)); }} />
                        <span className="bz-li-main">{a.name}<small>{a.id}{a.currency ? ` · ${a.currency}` : ''}{a.tz ? ` · ${a.tz}` : ''}{a.inactive ? ' · inactive' : ''}{taken ? ' · already connected' : ''}{a.error ? ` · ${a.error}` : ''}</small></span>
                      </label>
                    );
                  })}
                  {acc?.info && <div className="bz-note">Reads table <b>{acc.info.orders}</b>{acc.info.items ? <> and order lines <b>{acc.info.items}</b></> : ' (no order-line table found, best sellers hidden)'}. Not counted in revenue: {acc.info.exclude.join(', ')}.</div>}
                  <div className="field"><label htmlFor="bz-name">Display name</label><input id="bz-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
                  <button className="btn block" disabled={!acc || saving} onClick={save}>{saving ? 'Connecting…' : 'Connect'}</button>
                </div>
              )}
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
const defName = (type, a) => (type === 'sales' ? 'Mộc Linh Sales' : `${TYPE_LABEL[type]} · ${a.name}`).slice(0, 80);
