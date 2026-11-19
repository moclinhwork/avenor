import { useEffect, useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { todayIso, uid } from '../../core/format.js';
import { BANK_TYPES, blankAccount, duplicateOf, KINDS, LOGIN_METHODS, MANAGERS, STATUSES, TWO_FA_METHODS } from './data.js';
import { Chips, TagChip, TopBar } from './ui.jsx';

const DRAFT = 'avenor-accounts-draft';
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } };
const writeDraft = (v) => { try { if (v) localStorage.setItem(DRAFT, JSON.stringify(v)); else localStorage.removeItem(DRAFT); } catch { /* bỏ qua */ } };
const isUrl = (s) => !s || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim());
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

/* ---------- Bước 1: chọn nhóm và nền tảng ---------- */
export function ChooseType({ d, set, params, nav, back }) {
  const [cat, setCat] = useState(params.cat || '');
  const [plat, setPlat] = useState(params.plat || '');
  const [newPlat, setNewPlat] = useState(null);
  const plats = d.platforms.filter((p) => p.categoryId === cat);
  const addPlat = () => {
    const name = newPlat.trim(); if (!name) return;
    const id = uid(); set((s) => ({ ...s, platforms: [...s.platforms, { id, categoryId: cat, name }] })); setPlat(id); setNewPlat(null);
  };
  return (
    <div className="ac-stack fade-in">
      <TopBar onBack={back} backLabel="Close"><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Step 1 of 2</span></TopBar>
      <div><h1 className="ac-h1">Add account</h1><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Pick a category and platform. The next step shows only the fields that fit.</p></div>
      <div style={{ display: 'grid', gap: 8 }}>
        {d.categories.map((c) => (
          <div key={c.id} style={{ display: 'grid', gap: 8 }}>
            <button className={`ac-opt ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setPlat(d.platforms.find((p) => p.categoryId === c.id)?.id || ''); }}>
              <span className="icon-tile"><Icon name={KINDS[c.kind]?.icon || 'grid'} size={20} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><b>{c.name}</b><span className="muted">{d.platforms.filter((p) => p.categoryId === c.id).map((p) => p.name).slice(0, 4).join(', ') || 'No platforms yet'}</span></span>
              {cat === c.id && <Icon name="check" size={20} className="mint" />}
            </button>
            {cat === c.id && (
              <div style={{ display: 'grid', gap: 8, padding: '0 4px 6px' }}>
                <span className="ac-flabel">Platform</span>
                <div className="ac-chips">
                  {plats.map((p) => <button key={p.id} className={`ac-chip ${plat === p.id ? 'on' : ''}`} onClick={() => setPlat(p.id)}>{p.name}</button>)}
                  {newPlat === null && <button className="ac-chip dashed" onClick={() => setNewPlat('')}><Icon name="plus" size={15} />New platform</button>}
                </div>
                {newPlat !== null && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" autoFocus aria-label="New platform name" placeholder="e.g. Shopee" value={newPlat} onChange={(e) => setNewPlat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlat()} />
                    <button className="btn sm" onClick={addPlat}>Add</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn block" disabled={!cat || !plat} onClick={() => nav({ v: 'add', cat, plat }, true)}>Continue{plat ? ` with ${d.platforms.find((p) => p.id === plat)?.name}` : ''}</button>
    </div>
  );
}

/* ---------- Bước 2: biểu mẫu thêm / sửa ---------- */
export default function AccountForm({ d, set, editing, params, nav, back, notify }) {
  const [useDraft, setUseDraft] = useState(() => { const dr = !editing && readDraft(); return !!dr && dr.categoryId === params.cat && dr.platformId === params.plat; });
  const [a, setA] = useState(() => editing ? structuredClone(editing) : useDraft ? readDraft() : blankAccount(d, params.cat, params.plat));
  const dirty = useRef(false);
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [newTag, setNewTag] = useState(null);
  const [newParty, setNewParty] = useState(null);
  const [recText, setRecText] = useState('');
  const formRef = useRef(null);
  const cat = d.categories.find((c) => c.id === a.categoryId) || d.categories[0];
  const k = cat.kind;
  const plat = d.platforms.find((p) => p.id === a.platformId);
  const dup = duplicateOf(d, a);

  useEffect(() => { if (!editing && (dirty.current || useDraft)) writeDraft(a); }, [a, editing]);
  useEffect(() => { if (!editing && !a.label && plat) setA((x) => ({ ...x, label: plat.name })); }, []);
  const discard = () => { writeDraft(null); dirty.current = false; setUseDraft(false); setA({ ...blankAccount(d, params.cat, params.plat), label: plat?.name || '' }); };

  const mark = () => { dirty.current = true; };
  const up = (patch) => { mark(); setA((x) => ({ ...x, ...patch })); };
  const upF = (patch) => mark() || setA((x) => ({ ...x, fields: { ...x.fields, ...patch } }));
  const upR = (patch) => mark() || setA((x) => ({ ...x, recovery: { ...x.recovery, ...patch } }));
  const upT = (patch) => mark() || setA((x) => ({ ...x, twoFactor: { ...x.twoFactor, ...patch } }));

  const validate = () => {
    const e = {};
    if (!a.label.trim()) e.label = 'Give this account a name you will recognise.';
    if (k === 'email' && !a.loginId.trim()) e.loginId = 'Enter the email address.';
    else if (k === 'email' && !isEmail(a.loginId)) e.loginId = 'This doesn’t look like an email address.';
    if (!isUrl(a.profileUrl)) e.profileUrl = 'This doesn’t look like a link. Example: facebook.com/moclinh';
    if (k === 'bank') {
      if (!a.fields.holderName?.trim()) e.holderName = 'Enter the account holder’s name.';
      if (!a.fields.accountNumber?.trim()) e.accountNumber = 'Enter the account number.';
      else if (!/^[\d\s+-]+$/.test(a.fields.accountNumber)) e.accountNumber = 'Use digits only.';
    }
    if (recText.trim() && !isEmail(recText)) e.recText = 'This doesn’t look like an email address.';
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate(); setErrs(e);
    if (Object.keys(e).length) { setTimeout(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus(), 0); return; }
    setSaving(true);
    const extra = recText.trim() ? [{ text: recText.trim() }] : [];
    const securityChanged = editing && JSON.stringify([editing.recovery, editing.twoFactor, editing.passwordHint]) !== JSON.stringify([a.recovery, a.twoFactor, a.passwordHint]);
    const rec = {
      ...a, label: a.label.trim(), loginId: a.loginId.trim(), profileUrl: a.profileUrl.trim(),
      recovery: { emails: [...a.recovery.emails, ...extra], phones: a.recovery.phones.map((p) => p.trim()).filter(Boolean) },
      passwordRef: a.passwordRef?.item?.trim() ? a.passwordRef : null,
      lastReviewedOn: securityChanged ? todayIso : a.lastReviewedOn,
      updatedAt: Date.now(),
    };
    if (editing) set((s) => ({ ...s, accounts: s.accounts.map((x) => (x.id === a.id ? rec : x)) }));
    else { rec.id = uid(); rec.createdAt = Date.now(); set((s) => ({ ...s, accounts: [...s.accounts, rec] })); writeDraft(null); }
    notify(editing ? 'Changes saved' : 'Account saved');
    setSaving(false);
    nav({ v: 'acc', id: rec.id, ...(editing ? {} : { fresh: '1' }) }, true);
  };

  const err = (key) => errs[key] && <span className="ac-err" id={`e-${key}`}><Icon name="alert" size={15} />{errs[key]}</span>;
  const inv = (key) => (errs[key] ? { 'aria-invalid': 'true', 'aria-describedby': `e-${key}` } : {});
  const emailAccounts = d.accounts.filter((x) => x.id !== a.id && d.categories.find((c) => c.id === x.categoryId)?.kind === 'email');
  const addParty = (field) => {
    const name = newParty?.name?.trim(); if (!name) return;
    const id = uid(); set((s) => ({ ...s, parties: [...s.parties, { id, name, type: 'person' }] }));
    if (field === 'owner') up({ ownerId: id }); else up({ managerIds: [...a.managerIds, id] });
    setNewParty(null);
  };
  const addTag = () => {
    const name = newTag.trim(); if (!name) return;
    const found = d.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const id = found?.id || uid();
    if (!found) set((s) => ({ ...s, tags: [...s.tags, { id, name, color: 'rust' }] }));
    if (!a.tagIds.includes(id)) up({ tagIds: [...a.tagIds, id] });
    setNewTag(null);
  };

  return (
    <form ref={formRef} className="ac-stack ac-form fade-in" onSubmit={submit} noValidate>
      <TopBar onBack={back}><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{editing ? 'Edit' : 'Step 2 of 2'}</span></TopBar>
      <div>
        <h1 className="ac-h1">{editing ? 'Edit account' : 'Add account'}</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{cat.name} › <b style={{ color: 'var(--text)' }}>{plat?.name || 'Other'}</b>{!editing && <button type="button" className="link" onClick={() => nav({ v: 'add', cat: a.categoryId })}>Change</button>}</div>
      </div>
      {useDraft && !editing && <div className="ac-note">Draft restored. <button type="button" className="link" onClick={discard}>Discard draft</button></div>}

      <div className="ac-sec2">Basics</div>
      <div className="field"><label htmlFor="f-label">Account label *</label><input id="f-label" className="input" value={a.label} onChange={(e) => up({ label: e.target.value })} {...inv('label')} />{err('label')}</div>
      {editing && (
        <div className="form-row">
          <div className="field"><label htmlFor="f-cat">Category</label><select id="f-cat" className="input" value={a.categoryId} onChange={(e) => up({ categoryId: e.target.value, platformId: d.platforms.find((p) => p.categoryId === e.target.value)?.id || '' })}>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="f-plat">Platform</label><select id="f-plat" className="input" value={a.platformId} onChange={(e) => up({ platformId: e.target.value })}>{d.platforms.filter((p) => p.categoryId === a.categoryId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
      )}
      {editing && editing.categoryId !== a.categoryId && d.categories.find((c) => c.id === editing.categoryId)?.kind !== k && <div className="ac-note">Fields that only fit {d.categories.find((c) => c.id === editing.categoryId)?.name} are hidden, not deleted.</div>}
      <div className="field"><label htmlFor="f-login">{KINDS[k].login}{k === 'email' ? ' *' : ''}</label>
        <input id="f-login" className="input" value={a.loginId} inputMode={k === 'email' ? 'email' : 'text'} autoCapitalize="none" onChange={(e) => up({ loginId: e.target.value })} {...inv('loginId')} />{err('loginId')}
        {dup && <div className="ac-dup"><Icon name="alert" size={18} /><span>Already saved as <b>{dup.label}</b>. <button type="button" className="link" onClick={() => nav({ v: 'acc', id: dup.id })}>Open it</button> or save anyway as a separate profile.</span></div>}
      </div>

      {k === 'social' && <div className="form-row">
        <div className="field"><label htmlFor="f-user">Username</label><input id="f-user" className="input" autoCapitalize="none" value={a.fields.username || ''} onChange={(e) => upF({ username: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-lp">Linked phone</label><input id="f-lp" className="input" inputMode="tel" value={a.fields.linkedPhone || ''} onChange={(e) => upF({ linkedPhone: e.target.value })} /></div>
      </div>}
      {k !== 'bank' && <div className="field"><label htmlFor="f-url">{k === 'channel' ? 'URL' : 'Profile URL'}</label><input id="f-url" className="input" inputMode="url" autoCapitalize="none" placeholder={k === 'channel' ? 'youtube.com/@yourchannel' : 'Optional'} value={a.profileUrl} onChange={(e) => up({ profileUrl: e.target.value })} {...inv('profileUrl')} />{err('profileUrl')}</div>}
      {(k === 'channel' || k === 'social') && <div className="field"><label htmlFor="f-ext">{k === 'channel' ? 'Channel / Page ID' : 'Profile ID'}</label><input id="f-ext" className="input" autoCapitalize="none" value={a.externalId} onChange={(e) => up({ externalId: e.target.value })} /></div>}
      {k === 'channel' && <div className="field"><label htmlFor="f-topic">Topic</label><input id="f-topic" className="input" value={a.fields.topic || ''} onChange={(e) => upF({ topic: e.target.value })} /></div>}
      {k === 'other' && <div className="form-row">
        <div className="field"><label htmlFor="f-web">Website</label><input id="f-web" className="input" inputMode="url" autoCapitalize="none" value={a.fields.website || ''} onChange={(e) => upF({ website: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-lm">Login method</label><select id="f-lm" className="input" value={a.fields.loginMethod || ''} onChange={(e) => upF({ loginMethod: e.target.value })}><option value="">—</option>{LOGIN_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
      </div>}
      {k === 'bank' && <>
        <div className="field"><label htmlFor="f-holder">Account holder *</label><input id="f-holder" className="input" autoCapitalize="characters" value={a.fields.holderName || ''} onChange={(e) => upF({ holderName: e.target.value })} {...inv('holderName')} />{err('holderName')}</div>
        <div className="field"><label htmlFor="f-num">{a.fields.accountType === 'E-wallet' ? 'Wallet phone number *' : 'Account number *'}</label><input id="f-num" className="input num" inputMode="numeric" autoComplete="off" value={a.fields.accountNumber || ''} onChange={(e) => upF({ accountNumber: e.target.value })} {...inv('accountNumber')} />{err('accountNumber')}</div>
        <div className="form-row">
          <div className="field"><label htmlFor="f-at">Account type</label><select id="f-at" className="input" value={a.fields.accountType || ''} onChange={(e) => upF({ accountType: e.target.value })}><option value="">—</option>{BANK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field"><label htmlFor="f-cur">Currency</label><input id="f-cur" className="input" autoCapitalize="characters" placeholder="VND" value={a.fields.currency || ''} onChange={(e) => upF({ currency: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label htmlFor="f-br">Branch</label><input id="f-br" className="input" value={a.fields.branch || ''} onChange={(e) => upF({ branch: e.target.value })} /></div>
          <div className="field"><label htmlFor="f-otp">OTP phone</label><input id="f-otp" className="input" inputMode="tel" value={a.fields.otpPhone || ''} onChange={(e) => upF({ otpPhone: e.target.value })} /></div>
        </div>
      </>}

      <div className="form-row">
        <div className="field"><label htmlFor="f-owner">Owner</label>
          <select id="f-owner" className="input" value={a.ownerId} onChange={(e) => (e.target.value === '__new' ? setNewParty({ field: 'owner', name: '' }) : up({ ownerId: e.target.value }))}>
            <option value="">—</option>{d.parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new">+ New person or org…</option>
          </select></div>
        <div className="field"><label htmlFor="f-purpose">Purpose</label>
          <select id="f-purpose" className="input" value={a.purposeId} onChange={(e) => up({ purposeId: e.target.value })}><option value="">—</option>{d.purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div className="field"><span className="ac-flabel">Managed by</span>
        <Chips multi options={d.parties.map((p) => ({ id: p.id, label: p.name }))} value={a.managerIds} onChange={(v) => up({ managerIds: v })} />
        {newParty === null && <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => setNewParty({ field: 'manager', name: '' })}>+ New person or org</button>}
      </div>
      {newParty !== null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" autoFocus aria-label="Name of person or organization" placeholder="Name" value={newParty.name} onChange={(e) => setNewParty({ ...newParty, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParty(newParty.field); } }} />
          <button type="button" className="btn sm" onClick={() => addParty(newParty.field)}>Add</button>
          <button type="button" className="btn sm ghost" onClick={() => setNewParty(null)}>Cancel</button>
        </div>
      )}
      <div className="field"><span className="ac-flabel">Tags</span>
        <div className="ac-chips">
          {a.tagIds.map((id) => <TagChip key={id} tag={d.tags.find((t) => t.id === id)} onRemove={() => up({ tagIds: a.tagIds.filter((x) => x !== id) })} />)}
          {d.tags.filter((t) => !a.tagIds.includes(t.id)).map((t) => <button type="button" key={t.id} className="ac-chip" onClick={() => up({ tagIds: [...a.tagIds, t.id] })}>+ {t.name}</button>)}
          {newTag === null ? <button type="button" className="ac-chip dashed" onClick={() => setNewTag('')}>+ New tag</button> : (
            <span style={{ display: 'flex', gap: 6 }}><input className="input" style={{ minHeight: 36, padding: '6px 10px', width: 140 }} autoFocus aria-label="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} /><button type="button" className="btn sm" onClick={addTag}>Add</button></span>
          )}
        </div>
      </div>
      <div className="field"><span className="ac-flabel">Status</span>
        <div className="tabs seg" style={{ marginBottom: 0 }}>{STATUSES.map((s) => <button type="button" key={s.id} className={`tab ${a.status === s.id ? 'active' : ''}`} onClick={() => up({ status: s.id })}>{s.label}</button>)}</div>
      </div>

      <div className="ac-sec2">Security · optional</div>
      <div className="card ac-form" style={{ padding: 14 }}>
        <div className="field"><span className="ac-flabel">Recovery email</span>
          {a.recovery.emails.map((e, i) => {
            const r = e.accountId && d.accounts.find((x) => x.id === e.accountId);
            return <div key={i} className="ac-recrow"><Icon name="mail" size={18} className="muted" /><span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{r ? <><b>{r.label}</b> <span className="muted">· linked profile</span></> : <>{e.text} <span className="muted">· typed</span></>}</span><button type="button" className="ac-mini" aria-label="Remove recovery email" onClick={() => upR({ emails: a.recovery.emails.filter((_, j) => j !== i) })}><Icon name="close" size={18} /></button></div>;
          })}
          {emailAccounts.length > 0 && (
            <select className="input" aria-label="Add a saved email profile as recovery" value="" onChange={(e) => e.target.value && upR({ emails: [...a.recovery.emails, { accountId: e.target.value }] })}>
              <option value="">+ Pick a saved email profile</option>
              {emailAccounts.filter((x) => !a.recovery.emails.some((e) => e.accountId === x.id)).map((x) => <option key={x.id} value={x.id}>{x.label} · {x.loginId}</option>)}
            </select>
          )}
          <input className="input" aria-label="Or type a recovery email not in Accounts" placeholder="Or type an address not in Accounts" inputMode="email" autoCapitalize="none" value={recText} onChange={(e) => setRecText(e.target.value)} {...inv('recText')} />{err('recText')}
        </div>
        <div className="field"><span className="ac-flabel">Recovery phone</span>
          {[...a.recovery.phones, ''].map((p, i) => (
            <input key={i} className="input" inputMode="tel" aria-label={`Recovery phone ${i + 1}`} placeholder={i === a.recovery.phones.length ? (i ? '+ Another phone' : '+84 …') : ''} value={p}
              onChange={(e) => { const next = [...a.recovery.phones]; next[i] = e.target.value; upR({ phones: next.filter((x, j) => x || j < next.length - 1) }); }} />
          ))}
        </div>
        <div className="field"><span className="ac-flabel">Two-factor authentication</span>
          <div className="tabs seg" style={{ marginBottom: 0 }}>{[['on', 'On'], ['off', 'Off'], ['unknown', 'Unknown']].map(([id, l]) => <button type="button" key={id} className={`tab ${a.twoFactor.state === id ? 'active' : ''}`} onClick={() => upT({ state: id })}>{l}</button>)}</div>
          {a.twoFactor.state === 'on' && <Chips multi options={TWO_FA_METHODS} value={a.twoFactor.methods} onChange={(v) => upT({ methods: v })} />}
        </div>
        <div className="field"><label htmlFor="f-hint">Password hint</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="f-hint" className="input" type={showHint ? 'text' : 'password'} autoComplete="off" value={a.passwordHint} onChange={(e) => up({ passwordHint: e.target.value })} />
            <button type="button" className="ac-sq" onClick={() => setShowHint((x) => !x)} aria-label={showHint ? 'Hide hint' : 'Show hint while typing'}><Icon name={showHint ? 'eyeOff' : 'eye'} size={20} /></button>
          </div>
          <span className="ac-hint">A reminder only you understand, not the password itself. Shown later only after your PIN.</span>
        </div>
        <div className="field"><span className="ac-flabel">Also saved in · optional</span>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 8 }}>
            <select className="input" aria-label="Password manager" value={a.passwordRef?.manager || ''} onChange={(e) => up({ passwordRef: e.target.value ? { manager: e.target.value, item: a.passwordRef?.item || '' } : null })}><option value="">None</option>{MANAGERS.map((m) => <option key={m}>{m}</option>)}</select>
            <input className="input" aria-label="Item name in the password manager" placeholder="Item name" disabled={!a.passwordRef} value={a.passwordRef?.item || ''} onChange={(e) => up({ passwordRef: { ...a.passwordRef, item: e.target.value } })} />
          </div>
        </div>
      </div>

      <div className="ac-sec2">Dates &amp; notes</div>
      <div className="form-row">
        <div className="field"><label htmlFor="f-cd">Created</label><input id="f-cd" type="date" className="input" value={a.createdOn} onChange={(e) => up({ createdOn: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-lr">Last reviewed</label><input id="f-lr" type="date" className="input" value={a.lastReviewedOn} onChange={(e) => up({ lastReviewedOn: e.target.value })} /></div>
      </div>
      {a.createdOn && <label className="ac-check"><input type="checkbox" checked={a.createdOnApprox} onChange={(e) => up({ createdOnApprox: e.target.checked })} />Created date is approximate (show month and year only)</label>}
      <div className="field"><label htmlFor="f-notes">Notes</label><textarea id="f-notes" className="input" rows={3} value={a.notes} onChange={(e) => up({ notes: e.target.value })} /></div>
      <p className="ac-hint" style={{ textAlign: 'center' }}>Empty fields can be filled in later.</p>
      {Object.keys(errs).length > 0 && <div className="ac-errbox" role="alert"><Icon name="alert" size={18} />Fix {Object.keys(errs).length === 1 ? 'the field' : `${Object.keys(errs).length} fields`} marked in red, then save again.</div>}
      <div className="ac-save">
        <button className="btn block" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : <><Icon name={editing ? 'check' : 'plus'} size={18} />{editing ? 'Save changes' : 'Save account'}</>}</button>
      </div>
    </form>
  );
}
