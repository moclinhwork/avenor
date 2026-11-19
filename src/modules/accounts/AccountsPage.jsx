import { useEffect, useRef, useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import Icon from '../../ui/Icon.jsx';
import { accById } from './data.js';
import { useLocked } from './pin.js';
import PinGate from './PinGate.jsx';
import Overview from './Overview.jsx';
import Directory from './Directory.jsx';
import Detail from './Detail.jsx';
import AccountForm, { ChooseType } from './AccountForm.jsx';
import Manage from './Manage.jsx';

// Điều hướng trong module bằng hash: #accounts?v=dir, #accounts?v=acc&id=…&tab=security…
// Nút Back của Android (WebView goBack) quay lại đúng màn hình trước.
const readParams = () => Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || ''));
function useParams() {
  const [p, setP] = useState(readParams);
  useEffect(() => { const on = () => setP(readParams()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return p;
}
let pushes = 0;
const nav = (params, replace) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const h = `#accounts${q ? `?${q}` : ''}`;
  if (replace) { history.replaceState(null, '', h); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  else { pushes += 1; window.location.hash = h; }
};

const SECTIONS = [['', 'Overview', 'home'], ['dir', 'Directory', 'filter'], ['cat', 'Categories', 'layers']];

export default function AccountsPage() {
  const [d, set] = useModule('accounts');
  const notify = useNotify();
  const p = useParams();
  const locked = useLocked();
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  const back = (fallback) => () => { if (pushes > 0) { pushes -= 1; history.back(); } else nav(fallback, true); };

  if (!d.pin || locked) return <PinGate key={d.pin ? 'u' : 'n'} d={d} set={set} />;

  const onDelete = (a) => {
    const prev = { accounts: d.accounts, links: d.links };
    set((s) => ({
      ...s,
      accounts: s.accounts.filter((x) => x.id !== a.id).map((x) => {
        const hit = x.recovery.emails.some((e) => e.accountId === a.id);
        return hit ? { ...x, recovery: { ...x.recovery, emails: x.recovery.emails.map((e) => (e.accountId === a.id ? { text: a.loginId || a.label } : e)) } } : x;
      }),
      links: s.links.filter((l) => l.fromId !== a.id && l.toId !== a.id),
    }));
    clearTimeout(undoTimer.current);
    setUndo({ label: a.label, prev });
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
    nav({ v: 'dir' }, true);
  };

  const v = p.v || '';
  let body;
  if (v === 'acc') {
    const a = accById(d, p.id);
    body = a ? <Detail key={a.id} d={d} set={set} a={a} tab={p.tab} nav={nav} back={back({ v: 'dir' })} notify={notify} onDelete={onDelete} />
      : <Missing nav={nav} />;
  } else if (v === 'edit') {
    const a = accById(d, p.id);
    body = a ? <AccountForm key={`e${a.id}`} d={d} set={set} editing={a} params={p} nav={nav} back={back({ v: 'acc', id: a.id })} notify={notify} /> : <Missing nav={nav} />;
  } else if (v === 'add') {
    body = p.cat && p.plat
      ? <AccountForm key={`a${p.cat}${p.plat}`} d={d} set={set} params={p} nav={nav} back={back({ v: 'add', cat: p.cat })} notify={notify} />
      : <ChooseType key={`t${p.cat || ''}`} d={d} set={set} params={p} nav={nav} back={back({})} />;
  }

  return (
    <div className="ac fade-in">
      {body || <>
        <div className="ac-headrow">
          <h1 className="ac-h1">{v === 'dir' ? 'Directory' : v === 'cat' ? 'Categories' : 'Accounts'}</h1>
          <button className="ac-add" onClick={() => nav({ v: 'add' })} aria-label="Add account"><Icon name="plus" size={22} /></button>
        </div>
        <nav className="pb-nav ac-nav" aria-label="Accounts sections">
          {SECTIONS.map(([id, label, icon]) => (
            <button key={id} className={v === id ? 'active' : ''} aria-current={v === id ? 'page' : undefined} onClick={() => nav(id ? { v: id } : {}, true)}><Icon name={icon} size={20} />{label}</button>
          ))}
        </nav>
        {v === 'dir' ? <Directory key={`${p.cat || ''}${p.owner || ''}${p.only || ''}`} d={d} nav={nav} params={p} />
          : v === 'cat' ? <Manage d={d} set={set} notify={notify} />
          : <Overview d={d} nav={nav} />}
      </>}
      {undo && (
        <div className="ac-undo" role="status">
          <span>Deleted {undo.label}</span>
          <button className="link" onClick={() => { set((s) => ({ ...s, ...undo.prev })); setUndo(null); clearTimeout(undoTimer.current); notify('Restored'); }}>Undo</button>
        </div>
      )}
    </div>
  );
}

const Missing = ({ nav }) => (
  <div className="ac-empty"><h2>This account no longer exists</h2><button className="btn" onClick={() => nav({ v: 'dir' }, true)}>Back to Directory</button></div>
);
