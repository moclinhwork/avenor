import { useEffect, useMemo, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { issues, kindOf, maskNum, matches, partyName, platformOf, STATUSES } from './data.js';
import { Av, Chips, Sheet, StatusChip } from './ui.jsx';

const KEY = 'avenor-accounts-filters';
const BLANK = { cat: '', plat: [], owner: [], status: [], tags: [], only: [], sort: 'review' };
const load = () => { try { return { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return BLANK; } };
const SORTS = [{ id: 'review', label: 'Needs review first' }, { id: 'name', label: 'Name' }, { id: 'reviewed', label: 'Last reviewed' }, { id: 'recent', label: 'Recently added' }];
const ONLY = [{ id: 'review', label: 'Needs review' }, { id: '2fa', label: '2FA off' }, { id: 'norec', label: 'No recovery info' }];

export default function Directory({ d, nav, params }) {
  const [f, setF] = useState(() => {
    const base = load();
    if (params.cat || params.owner || params.only) return { ...BLANK, cat: params.cat || '', owner: params.owner ? [params.owner] : [], only: params.only ? [params.only] : [] };
    return base;
  });
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* bỏ qua */ } }, [f]);
  const upd = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'cat' ? { plat: [] } : {}) }));

  const pass = (a, skipCat) => (skipCat || !f.cat || a.categoryId === f.cat)
    && (!f.plat.length || f.plat.includes(a.platformId))
    && (!f.owner.length || f.owner.includes(a.ownerId))
    && (!f.status.length || f.status.includes(a.status))
    && (!f.tags.length || f.tags.some((t) => a.tagIds.includes(t)))
    && (!f.only.includes('review') || issues(d, a).length > 0)
    && (!f.only.includes('2fa') || a.twoFactor.state === 'off')
    && (!f.only.includes('norec') || (!a.recovery.emails.length && !a.recovery.phones.length));

  const list = useMemo(() => {
    const out = d.accounts.filter((a) => pass(a) && matches(d, a, q));
    const by = {
      review: (a, b) => issues(d, b).length - issues(d, a).length || a.label.localeCompare(b.label),
      name: (a, b) => a.label.localeCompare(b.label),
      reviewed: (a, b) => (a.lastReviewedOn || '').localeCompare(b.lastReviewedOn || ''),
      recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    }[f.sort];
    return out.sort(by);
  }, [d, f, q]);
  const outside = q && !list.length ? d.accounts.filter((a) => matches(d, a, q)).length : 0;

  const groups = [];
  list.forEach((a) => { const p = platformOf(d, a)?.name || 'Other'; const g = groups.find((x) => x.p === p); if (g) g.items.push(a); else groups.push({ p, items: [a] }); });
  const active = [
    ...f.plat.map((id) => ({ k: 'plat', id, label: d.platforms.find((p) => p.id === id)?.name })),
    ...f.owner.map((id) => ({ k: 'owner', id, label: `Owner: ${partyName(d, id)}` })),
    ...f.status.map((id) => ({ k: 'status', id, label: `Status: ${STATUSES.find((s) => s.id === id)?.label}` })),
    ...f.tags.map((id) => ({ k: 'tags', id, label: `#${d.tags.find((t) => t.id === id)?.name}` })),
    ...f.only.map((id) => ({ k: 'only', id, label: ONLY.find((o) => o.id === id)?.label })),
  ];
  const sub = (a) => {
    const k = kindOf(d, a); const iss = issues(d, a);
    if (iss.length) return { text: iss[0].text, tone: iss[0].level === 'security' ? 'rose' : 'amber' };
    const id = k === 'bank' ? maskNum(a.fields?.accountNumber) : k === 'channel' ? (a.profileUrl || a.fields?.topic) : a.loginId;
    return { text: [id, partyName(d, a.ownerId)].filter(Boolean).join(' · ') };
  };

  return (
    <div className="ac-stack">
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="ac-search">
          <Icon name="search" size={20} />
          <input aria-label="Search accounts" placeholder="Name, email, phone, username" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><Icon name="close" size={16} /></button>}
        </label>
        <button className="ac-filter-btn" onClick={() => setSheet(true)} aria-label={`Filters, ${active.length} active`}>
          <Icon name="filter" size={20} />{active.length > 0 && <span className="badge">{active.length}</span>}
        </button>
      </div>
      <div className="ac-chips scroll">
        <button className={`ac-chip ${!f.cat ? 'on' : ''}`} onClick={() => upd('cat', '')}>All <span className="ac-n">{d.accounts.filter((a) => pass(a, true)).length}</span></button>
        {d.categories.map((c) => <button key={c.id} className={`ac-chip ${f.cat === c.id ? 'on' : ''}`} onClick={() => upd('cat', f.cat === c.id ? '' : c.id)}>{c.name.split(' ')[0]} <span className="ac-n">{d.accounts.filter((a) => a.categoryId === c.id && pass(a, true)).length}</span></button>)}
      </div>
      {active.length > 0 && (
        <div className="ac-chips">
          {active.map((x) => <button key={x.k + x.id} className="ac-fchip" onClick={() => upd(x.k, f[x.k].filter((v) => v !== x.id))} aria-label={`Remove filter ${x.label}`}>{x.label}<Icon name="close" size={15} /></button>)}
          <button className="link" onClick={() => setF({ ...BLANK, cat: f.cat, sort: f.sort })}>Clear all</button>
        </div>
      )}
      <div className="ac-meta"><span className="muted">{list.length} {list.length === 1 ? 'account' : 'accounts'}</span>
        <label className="ac-sort">Sort
          <select value={f.sort} onChange={(e) => upd('sort', e.target.value)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
      </div>

      {list.length ? groups.map((g) => (
        <div key={g.p}>
          <div className="ac-grp">{g.p}</div>
          <div className="card ac-list">
            {g.items.map((a) => { const s = sub(a); const iss = issues(d, a).length > 0; return (
              <button key={a.id} className="ac-row" onClick={() => nav({ v: 'acc', id: a.id })}>
                <Av d={d} a={a} />
                <span className="ac-row-main"><span className="ac-row-title">{a.label}</span><span className={`ac-row-sub ${s.tone || ''}`}>{s.text}</span></span>
                {iss && a.status === 'active' ? <span className="chip rose">Review</span> : <StatusChip status={a.status} />}
                <Icon name="chev" size={18} className="muted" />
              </button>); })}
          </div>
        </div>
      )) : (
        <div className="ac-empty" style={{ paddingTop: 30 }}>
          <span className="ac-empty-ic" style={{ background: 'var(--surface-3)', color: 'var(--mint)' }}><Icon name="search" size={30} /></span>
          <h2 style={{ fontSize: 19 }}>No accounts match</h2>
          <p className="muted">{q ? `Nothing matches “${q}”${active.length || f.cat ? ' with these filters' : ''}.` : 'No account fits these filters.'}{outside ? ` ${outside} ${outside === 1 ? 'account' : 'accounts'} outside these filters match.` : ''}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            {(active.length > 0 || f.cat) && <button className="btn ghost" onClick={() => setF({ ...BLANK, sort: f.sort })}>Clear filters</button>}
            <button className="btn" onClick={() => nav({ v: 'add', cat: f.cat })}><Icon name="plus" size={18} />Add account</button>
          </div>
        </div>
      )}
      {list.length > 0 && <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Search covers label, login, username, profile URL/ID, tags, notes and recovery email. Phone and account numbers match by digits.</p>}

      {sheet && (
        <Sheet title="Filters" onClose={() => setSheet(false)}>
          <div className="ac-form">
            <div className="ac-flabel">Category</div>
            <Chips options={d.categories.map((c) => ({ id: c.id, label: c.name }))} value={f.cat} onChange={(v) => upd('cat', v)} />
            <div className="ac-flabel">Platform{f.cat ? <span className="muted"> · within {d.categories.find((c) => c.id === f.cat)?.name}</span> : ''}</div>
            <Chips multi options={d.platforms.filter((p) => !f.cat || p.categoryId === f.cat).filter((p) => d.accounts.some((a) => a.platformId === p.id)).map((p) => ({ id: p.id, label: p.name }))} value={f.plat} onChange={(v) => upd('plat', v)} />
            <div className="ac-flabel">Owner</div>
            <Chips multi options={d.parties.map((p) => ({ id: p.id, label: p.name }))} value={f.owner} onChange={(v) => upd('owner', v)} />
            <div className="ac-flabel">Status</div>
            <Chips multi options={STATUSES.map((s) => ({ id: s.id, label: s.label }))} value={f.status} onChange={(v) => upd('status', v)} />
            {d.tags.length > 0 && <><div className="ac-flabel">Tags <span className="muted">· match any</span></div>
              <Chips multi options={d.tags.map((t) => ({ id: t.id, label: t.name }))} value={f.tags} onChange={(v) => upd('tags', v)} /></>}
            <div className="ac-flabel">Show only</div>
            <Chips multi options={ONLY} value={f.only} onChange={(v) => upd('only', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setF({ ...BLANK, sort: f.sort })}>Reset</button>
              <button className="btn" onClick={() => setSheet(false)}>Show {list.length} {list.length === 1 ? 'account' : 'accounts'}</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
