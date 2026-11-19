import { useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { daysFromToday, dmy, todayIso, uid } from '../../core/format.js';
import { accById, catOf, issues, kindOf, LEVEL_LABEL, LINK_TYPES, linkCount, maskEmail, maskNum, maskPhone, partyName, platformOf, relations, reviewDaysFor, ROLES, STATUSES, TWO_FA_METHODS } from './data.js';
import { Av, Chips, copyText, Secret, Sheet, StatusChip, TagChip, TopBar } from './ui.jsx';
import { PinCheckSheet } from './PinGate.jsx';
import { useHiddenSignal } from './pin.js';

const Row = ({ icon, label, children, action }) => (
  <div className="ac-drow">
    <Icon name={icon} size={20} className="muted" />
    <div className="ac-drow-main"><div className="ac-lbl">{label}</div>{children}</div>
    {action}
  </div>
);
const Val = ({ children }) => <div className="ac-val">{children}</div>;
const ago = (s) => { const n = -daysFromToday(s); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
const url = (u) => (/^https?:\/\//.test(u) ? u : `https://${u}`);
const fmtDate = (s, approx) => { if (!s) return ''; const [y, m] = s.split('-'); return approx ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y} · approximate` : dmy(s); };

export default function Detail({ d, set, a, tab, nav, back, notify, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [link, setLink] = useState(false);
  const k = kindOf(d, a);
  const n = linkCount(d, a);
  const iss = issues(d, a);
  const save = (patch) => set((s) => ({ ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, ...patch, updatedAt: Date.now() } : x)) }));
  const tone = a.status === 'active' ? 'good' : a.status === 'locked' ? 'rose' : 'stone';
  const t = tab || 'details';
  const setTab = (id) => nav({ v: 'acc', id: a.id, tab: id }, true);

  return (
    <div className="ac-stack fade-in">
      <TopBar onBack={back}><button className="bare-btn" onClick={() => setMenu(true)} aria-label="More actions"><Icon name="more" size={22} /></button></TopBar>
      <div className={`ac-head ${tone}`}>
        <Av d={d} a={a} size={56} />
        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <h1 className="ac-title">{a.label}</h1>
          <div className="ac-head-sub">{catOf(d, a)?.name} · {platformOf(d, a)?.name}{a.ownerId ? ` · ${partyName(d, a.ownerId)}` : ''}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><StatusChip status={a.status} white />{a.twoFactor.state === 'on' && <span className="chip" style={{ background: 'var(--surface)' }}>2FA on</span>}</div>
        </div>
      </div>
      <div className="tabs seg" role="tablist" style={{ marginBottom: 0 }}>
        {[['details', 'Details'], ['security', 'Security'], ['linked', `Linked${n ? ` · ${n}` : ''}`]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={t === id} className={`tab ${t === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {iss.length > 0 && t !== 'linked' && (
        <div className="ac-warn">
          <Icon name="alert" size={20} />
          <div style={{ display: 'grid', gap: 2 }}>{iss.map((x) => <span key={x.text}><b>{LEVEL_LABEL[x.level][0]}:</b> {x.text}</span>)}</div>
        </div>
      )}

      {t === 'details' && <DetailsTab d={d} a={a} k={k} notify={notify} />}
      {t === 'security' && <SecurityTab d={d} a={a} nav={nav} notify={notify} />}
      {t === 'linked' && <LinkedTab d={d} set={set} a={a} k={k} nav={nav} onLink={() => setLink(true)} save={save} />}

      <div className="ac-actions">
        <button className="btn ghost" onClick={() => { save({ lastReviewedOn: todayIso }); notify('Marked as reviewed today'); }}><Icon name="check" size={18} />Mark reviewed</button>
        <button className="btn" onClick={() => nav({ v: 'edit', id: a.id })}><Icon name="pen" size={18} />Edit</button>
      </div>

      {menu && (
        <Sheet title={a.label} sub="Change status or remove this profile" onClose={() => setMenu(false)}>
          <div className="ac-form">
            <div className="ac-flabel">Status</div>
            <Chips options={STATUSES.map((s) => ({ id: s.id, label: s.label }))} value={a.status} onChange={(v) => { if (v) { save({ status: v }); notify(`Status set to ${STATUSES.find((s) => s.id === v).label}`); } }} />
            <p className="muted" style={{ fontSize: 13 }}>Closing keeps history and links. Delete removes the profile for good.</p>
            <button className="btn ghost" style={{ color: 'var(--rose)' }} onClick={() => { setMenu(false); onDelete(a); }}><Icon name="trash" size={18} />Delete profile{n ? ` · removes ${n} ${n === 1 ? 'link' : 'links'}` : ''}</button>
          </div>
        </Sheet>
      )}
      {link && <LinkSheet d={d} set={set} a={a} k={k} onClose={() => setLink(false)} notify={notify} nav={nav} />}
    </div>
  );
}

function DetailsTab({ d, a, k, notify }) {
  const f = a.fields || {};
  const copyBtn = (v, what) => <button className="ac-mini" onClick={() => copyText(v, notify, what)} aria-label={`Copy ${what.toLowerCase()}`}><Icon name="copy" size={19} /></button>;
  const openBtn = (u) => <a className="ac-mini" href={url(u)} target="_blank" rel="noreferrer" aria-label="Open link"><Icon name="external" size={19} /></a>;
  const reviewed = a.lastReviewedOn;
  return (
    <>
      <div className="card ac-card">
        {k === 'bank' ? <>
          <div className="ac-drow" style={{ display: 'grid', gap: 10 }}>
            <div className="ac-lbl" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Account number</span><span><Icon name="lock" size={13} /> Masked</span></div>
            <Secret value={f.accountNumber} mask={maskNum} notify={notify} copyLabel="Account number copied" big />
          </div>
          <Row icon="user" label="Account holder" action={f.holderName && copyBtn(f.holderName, 'Holder name')}><Val>{f.holderName || '—'}</Val></Row>
          <Row icon="card" label="Account type"><Val>{f.accountType || '—'}</Val></Row>
          <Row icon="coins" label="Currency"><Val>{f.currency || '—'}</Val></Row>
          {f.branch && <Row icon="pin" label="Branch"><Val>{f.branch}</Val></Row>}
          {f.otpPhone && <Row icon="phone" label="OTP phone"><Secret value={f.otpPhone} mask={maskPhone} notify={notify} copyLabel="Phone copied" /></Row>}
          {a.loginId && <Row icon="key" label="App login" action={copyBtn(a.loginId, 'Login')}><Val>{a.loginId}</Val></Row>}
        </> : <>
          {a.loginId && <Row icon={k === 'email' ? 'mail' : 'user'} label={k === 'email' ? 'Email address' : 'Login identifier'} action={copyBtn(a.loginId, 'Login')}><Val>{a.loginId}</Val></Row>}
          {f.username && <Row icon="user" label="Username" action={copyBtn(f.username, 'Username')}><Val>{f.username}</Val></Row>}
          {a.profileUrl && <Row icon="link" label={k === 'channel' ? 'URL' : 'Profile URL'} action={openBtn(a.profileUrl)}><Val><span className="mint">{a.profileUrl}</span></Val></Row>}
          {a.externalId && <Row icon="file" label={k === 'channel' ? 'Channel / Page ID' : 'ID'} action={copyBtn(a.externalId, 'ID')}><Val>{a.externalId}</Val></Row>}
          {f.topic && <Row icon="tag" label="Topic"><Val>{f.topic}</Val></Row>}
          {f.linkedPhone && <Row icon="phone" label="Linked phone"><Secret value={f.linkedPhone} mask={maskPhone} notify={notify} copyLabel="Phone copied" /></Row>}
          {f.website && <Row icon="link" label="Website" action={openBtn(f.website)}><Val><span className="mint">{f.website}</span></Val></Row>}
          {f.loginMethod && <Row icon="key" label="Login method"><Val>{f.loginMethod}</Val></Row>}
          {!a.loginId && !a.profileUrl && !a.externalId && <div className="ac-drow muted" style={{ fontSize: 14 }}>No login or profile info yet. Tap Edit to add it.</div>}
        </>}
      </div>
      <div className="card ac-card">
        <Row icon="user" label="Owner"><Val>{partyName(d, a.ownerId) || '—'}</Val></Row>
        {a.managerIds.length > 0 && <Row icon="users" label="Managed by"><Val>{a.managerIds.map((id) => partyName(d, id)).filter(Boolean).join(', ')}</Val></Row>}
        <Row icon="target" label="Purpose"><Val>{d.purposes.find((p) => p.id === a.purposeId)?.name || '—'}</Val></Row>
        {a.tagIds.length > 0 && <Row icon="tag" label="Tags"><div className="ac-chips" style={{ marginTop: 4 }}>{a.tagIds.map((id) => <TagChip key={id} tag={d.tags.find((x) => x.id === id)} />)}</div></Row>}
      </div>
      <div className="card ac-card">
        <Row icon="cal" label="Created"><Val>{fmtDate(a.createdOn, a.createdOnApprox) || 'Unknown'}</Val></Row>
        <Row icon="clock" label="Last reviewed"><Val>{reviewed ? <>{dmy(reviewed)} <span className="muted" style={{ fontWeight: 500 }}>· {ago(reviewed)} · every {reviewDaysFor(d, a)} days</span></> : 'Never'}</Val></Row>
        {a.notes && <Row icon="journal" label="Notes"><div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.notes}</div></Row>}
      </div>
    </>
  );
}

function SecurityTab({ d, a, nav, notify }) {
  const [ask, setAsk] = useState(false);
  const [hint, setHint] = useState(false);
  const hidden = useHiddenSignal();
  useEffect(() => setHint(false), [hidden]);
  useEffect(() => { if (!hint) return undefined; const tm = setTimeout(() => setHint(false), 30000); return () => clearTimeout(tm); }, [hint]);
  const ref = a.passwordRef;
  const tf = a.twoFactor;
  const iss = issues(d, a);
  const checks = [
    ['Recovery email set', a.recovery.emails.length > 0],
    ['Recovery phone set', a.recovery.phones.length > 0],
    ['2FA on', tf.state === 'on'],
    [`Reviewed within ${reviewDaysFor(d, a)} days`, !iss.some((x) => x.level === 'overdue')],
  ];
  return (
    <>
      <div className="ac-sec2">Password</div>
      <div className="card ac-card">
        <Row icon="key" label="Password hint · only you understand it"
          action={a.passwordHint ? <button className="ac-mini" onClick={() => setAsk(true)} aria-label="Reveal hint with PIN"><Icon name="lock" size={19} /></button> : null}>
          <Val>{a.passwordHint ? '••••••••••••' : <span className="muted" style={{ fontWeight: 500 }}>No hint saved</span>}</Val>
          {ref?.item && <div className="ac-lbl" style={{ marginTop: 2 }}>Also in {ref.manager} › {ref.item}</div>}
        </Row>
      </div>
      <div className="ac-sec2">Recovery</div>
      <div className="card ac-card">
        {a.recovery.emails.length ? a.recovery.emails.map((e, i) => {
          const r = e.accountId && accById(d, e.accountId);
          return (
            <Row key={i} icon="mail" label={<span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>Recovery email {r ? <button className="ac-linkchip" onClick={() => nav({ v: 'acc', id: r.id })}>{r.label}</button> : <span>· not in Accounts</span>}</span>}>
              <Secret value={r ? r.loginId : e.text} mask={maskEmail} notify={notify} copyLabel="Email copied" />
            </Row>);
        }) : <Row icon="mail" label="Recovery email"><Val><span className="muted" style={{ fontWeight: 500 }}>Not set</span></Val></Row>}
        {a.recovery.phones.length ? a.recovery.phones.map((p, i) => (
          <Row key={i} icon="phone" label="Recovery phone"><Secret value={p} mask={maskPhone} notify={notify} copyLabel="Phone copied" /></Row>
        )) : <Row icon="phone" label="Recovery phone"><Val><span className="muted" style={{ fontWeight: 500 }}>Not set</span></Val></Row>}
      </div>
      <div className="ac-sec2">Two-factor authentication</div>
      <div className="card ac-card">
        <Row icon="shield" label="Status" action={<span className={`chip ${tf.state === 'on' ? 'good' : tf.state === 'off' ? 'rose' : 'amber'}`} style={{ marginRight: 6 }}>{tf.state === 'on' ? 'On' : tf.state === 'off' ? 'Off' : 'Unknown'}</span>}>
          <Val>{tf.state === 'on' ? 'Enabled' : tf.state === 'off' ? 'Disabled' : 'Not checked yet'}</Val>
        </Row>
        {tf.methods.length > 0 && <Row icon="check" label="Methods"><div className="ac-chips" style={{ marginTop: 4 }}>{tf.methods.map((m) => <span key={m} className="chip">{TWO_FA_METHODS.find((x) => x.id === m)?.label || m}</span>)}</div></Row>}
      </div>
      <div className="ac-sec2">Checks</div>
      <div className="card ac-card ac-checks">
        {checks.map(([label, ok]) => <div key={label} className={ok ? 'good' : 'amber'}><Icon name={ok ? 'check' : 'alert'} size={18} />{label}</div>)}
      </div>
      {ask && <PinCheckSheet d={d} title="Password hint" onClose={() => setAsk(false)} onOk={() => { setAsk(false); setHint(true); }} />}
      {hint && (
        <Sheet title="Password hint" sub={`${a.label} · unlocked with PIN`} onClose={() => setHint(false)}>
          <div className="card" style={{ display: 'grid', gap: 6 }}>
            <span className="ac-lbl">Your hint</span>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{a.passwordHint}</div>
            <span className="ac-lbl"><Icon name="clock" size={13} /> Hides again in 30 s</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => nav({ v: 'edit', id: a.id })}><Icon name="pen" size={18} />Edit hint</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => setHint(false)}><Icon name="eyeOff" size={18} />Hide now</button>
          </div>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>Hints are never copied and are left out of exports and search.</p>
        </Sheet>
      )}
    </>
  );
}

function LinkedTab({ d, set, a, k, nav, onLink, save }) {
  const r = relations(d, a);
  const [edit, setEdit] = useState(null);
  const ext = a.fields?.externalManagers || [];
  const section = (title, items, sub) => items.length > 0 && (
    <>
      <div className="ac-sec2" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{title}</span><span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{sub || items.length}</span></div>
      <div className="card ac-list">
        {items.map((x) => (
          <div key={(x.link?.id || '') + x.acc.id} className="ac-row" style={{ paddingRight: 4 }}>
            <button className="ac-row-btn" onClick={() => nav({ v: 'acc', id: x.acc.id })}>
              <Av d={d} a={x.acc} size={36} />
              <span className="ac-row-main"><span className="ac-row-title">{x.acc.label}</span><span className="ac-row-sub">{catOf(d, x.acc)?.name}{x.acc.loginId ? ` · ${x.acc.loginId}` : ''}</span></span>
              {x.role && <span className={`chip ${x.role === 'Owner' ? 'mint' : ''}`}>{x.role}</span>}
            </button>
            {x.link && <button className="ac-mini" onClick={() => setEdit(x)} aria-label={`Edit link to ${x.acc.label}`}><Icon name="more" size={19} /></button>}
          </div>
        ))}
      </div>
    </>
  );
  const owners = r.access.filter((x) => x.role === 'Owner').length;
  return (
    <>
      {k === 'channel' && owners < 2 && (
        <div className="ac-warn"><Icon name="alert" size={20} /><span><b>{owners ? 'Only one Owner.' : 'No Owner linked.'}</b> If that account is lost, nobody can transfer this {platformOf(d, a)?.name || 'channel'}. Add a second Owner or a Manager account.</span></div>
      )}
      {section('Access · accounts with a role', r.access, 'role')}
      {ext.length > 0 && (
        <div className="card ac-list" style={{ marginTop: r.access.length ? -4 : 0 }}>
          {ext.map((e, i) => (
            <div key={i} className="ac-row">
              <span className="ac-av" style={{ width: 36, height: 36, fontSize: 12 }}>ext</span>
              <span className="ac-row-main"><span className="ac-row-title">{e.text}</span><span className="ac-row-sub">Not in Accounts · typed directly</span></span>
              <span className="chip">{e.role}</span>
              <button className="ac-mini" aria-label={`Remove ${e.text}`} onClick={() => save({ fields: { ...a.fields, externalManagers: ext.filter((_, j) => j !== i) } })}><Icon name="close" size={18} /></button>
            </div>
          ))}
        </div>
      )}
      {section('Manages', r.manages)}
      {section('Recovery email for', r.recoveryFor)}
      {section('Used to sign in to', r.signsInTo)}
      {section('Signs in with', r.signsInWith)}
      {section('Recovers this account', r.recoveredBy)}
      {section('Related', r.related)}
      {!linkCount(d, a) && <div className="card ac-empty-card"><Icon name="link" size={22} /><span>No linked profiles yet. Link the accounts that manage, recover or sign in to this one.</span></div>}
      <button className="btn ghost block" onClick={onLink}><Icon name="link" size={18} />Link a profile</button>
      {r.recoveryFor.length + r.recoveredBy.length > 0 && <p className="muted" style={{ fontSize: 12 }}>Recovery links come from each account’s Security tab. Edit them there.</p>}
      {edit && (
        <Sheet title={edit.acc.label} sub={LINK_TYPES[edit.link.type].label} onClose={() => setEdit(null)}>
          <div className="ac-form">
            {edit.link.type === 'has-access' && <>
              <div className="ac-flabel">Role</div>
              <Chips options={ROLES.map((x) => ({ id: x, label: x }))} value={edit.link.role} onChange={(v) => { if (!v) return; set((s) => ({ ...s, links: s.links.map((l) => (l.id === edit.link.id ? { ...l, role: v } : l)) })); setEdit(null); }} />
            </>}
            <button className="btn ghost" style={{ color: 'var(--rose)' }} onClick={() => { set((s) => ({ ...s, links: s.links.filter((l) => l.id !== edit.link.id) })); setEdit(null); }}><Icon name="trash" size={18} />Remove link</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function LinkSheet({ d, set, a, k, onClose, notify, nav }) {
  const [type, setType] = useState(k === 'channel' || k === 'email' || k === 'social' ? 'has-access' : 'signs-in-with');
  const [role, setRole] = useState('Owner');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('');
  const [typed, setTyped] = useState(null);
  // Hướng của quan hệ phụ thuộc loại hồ sơ đang xem.
  const iAmTarget = type === 'has-access' ? k === 'channel' : type === 'signs-in-with' ? !['email', 'social'].includes(k) : false;
  const existing = (o) => d.links.find((l) => l.type === type && ((l.fromId === a.id && l.toId === o.id) || (l.toId === a.id && l.fromId === o.id)));
  const cands = d.accounts.filter((o) => o.id !== a.id)
    .filter((o) => type !== 'has-access' || (iAmTarget ? kindOf(d, o) !== 'channel' : kindOf(d, o) === 'channel'))
    .filter((o) => { const t = q.toLowerCase(); return !t || `${o.label} ${o.loginId}`.toLowerCase().includes(t); })
    .slice(0, 30);
  const save = () => {
    if (typed !== null) {
      if (!typed.trim()) return;
      set((s) => ({ ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, fields: { ...x.fields, externalManagers: [...(x.fields?.externalManagers || []), { text: typed.trim(), role }] } } : x)) }));
      notify('Added'); onClose(); return;
    }
    if (!pick) return;
    const [fromId, toId] = iAmTarget ? [pick, a.id] : [a.id, pick];
    set((s) => ({ ...s, links: [...s.links, { id: uid(), fromId, toId, type, ...(type === 'has-access' ? { role } : {}) }] }));
    notify('Linked'); onClose();
  };
  return (
    <Sheet title="Link a profile" sub={`to ${a.label}`} onClose={onClose}>
      <div className="ac-form">
        <div className="ac-flabel">Relationship</div>
        <Chips options={Object.entries(LINK_TYPES).map(([id, t]) => ({ id, label: t.label }))} value={type} onChange={(v) => { if (v) { setType(v); setPick(''); } }} />
        {type === 'has-access' && <>
          <div className="ac-flabel">{iAmTarget ? 'Role of the linked account' : `Role of ${a.label}`}</div>
          <Chips options={ROLES.map((x) => ({ id: x, label: x }))} value={role} onChange={(v) => v && setRole(v)} />
        </>}
        {typed === null ? <>
          <label className="ac-search"><Icon name="search" size={20} /><input aria-label="Search saved profiles" placeholder={type === 'has-access' && !iAmTarget ? 'Search channels and pages' : 'Search saved profiles'} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="card ac-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {cands.length ? cands.map((o) => { const ex = existing(o); return (
              <button key={o.id} className="ac-row" disabled={!!ex} onClick={() => setPick(o.id)} aria-pressed={pick === o.id} style={ex ? { opacity: 0.55 } : undefined}>
                <Av d={d} a={o} size={36} />
                <span className="ac-row-main"><span className="ac-row-title">{o.label}</span><span className="ac-row-sub">{ex ? `Already linked${ex.role ? ` as ${ex.role}` : ''}` : o.loginId || catOf(d, o)?.name}</span></span>
                <span className={`ac-radio ${pick === o.id ? 'on' : ''}`} aria-hidden="true" />
              </button>); }) : <div className="empty">No saved profile matches.</div>}
          </div>
          <button className="ac-dashed" onClick={() => (type === 'has-access' && iAmTarget ? setTyped('') : nav({ v: 'add' }))}><Icon name="plus" size={18} />{type === 'has-access' && iAmTarget ? 'Not saved? Type an email instead' : 'Not saved? Create a profile'}</button>
        </> : (
          <div className="field"><label htmlFor="ac-typed">Email or name with access</label><input id="ac-typed" className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="editor@example.com" />
            <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => setTyped(null)}>Pick a saved profile instead</button></div>
        )}
        <button className="btn block" disabled={typed === null ? !pick : !typed.trim()} onClick={save}>{type === 'has-access' ? `Link as ${role}` : 'Link'}</button>
      </div>
    </Sheet>
  );
}
