// Health → Pickleball: buổi chơi hằng tuần, điểm danh, chi phí, chia tiền, thống kê.
// Giao diện tiếng Anh theo yêu cầu; tên thành viên giữ nguyên tiếng Việt.
import { useEffect, useMemo, useState } from 'react';
import { iso, parse, TODAY, todayIso, uid } from '../../core/format.js';
import Icon from '../../ui/Icon.jsx';
import {
  costs, ensureUpcoming, fmtDate, KINDS, memberName, money, monthName, newSession, organizer, participants, pbSeed,
  playedIds, sessionState, settle, stats, summaryText, toMoney, WEEKDAYS,
} from './pickleball.js';

const TONES = ['good', '', 'lav', 'amber', 'blue'];
const toneOf = (pb, id) => TONES[Math.max(0, pb.members.findIndex((m) => m.id === id)) % TONES.length];

function Avatar({ tone = '', guest }) {
  return <span className={`pb-av ${guest ? 'guest' : tone}`}><Icon name="user" size={18} /></span>;
}

function MoneyInput({ value, onChange, id, placeholder = '0', autoFocus }) {
  return (
    <div className="pb-money">
      <input id={id} className="input" inputMode="numeric" autoFocus={autoFocus} placeholder={placeholder}
        value={value ? Number(value).toLocaleString('vi-VN') : ''} onChange={(e) => onChange(toMoney(e.target.value))} />
      <span>₫</span>
    </div>
  );
}

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* dùng cách cũ */ }
  try {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
};

/* ================= Sessions (Overview) ================= */
function SessionForm({ init, title, onSave, onClose, showDate }) {
  const [f, setF] = useState(init);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card pb-form">
      <h3 className="card-title" style={{ marginBottom: 12 }}>{title}</h3>
      <div className="stack" style={{ gap: 10 }}>
        {showDate === 'weekday' && (
          <div className="field"><label htmlFor="pb-wd">Day</label>
            <select id="pb-wd" className="input" value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>Every {w}</option>)}
            </select>
          </div>
        )}
        {showDate === 'date' && (
          <div className="field"><label htmlFor="pb-date">Date</label><input id="pb-date" type="date" className="input" value={f.date} onChange={up('date')} /></div>
        )}
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field"><label htmlFor="pb-st">Start</label><input id="pb-st" type="time" className="input" value={f.start} onChange={up('start')} /></div>
          <div className="field"><label htmlFor="pb-en">End</label><input id="pb-en" type="time" className="input" value={f.end} onChange={up('end')} /></div>
        </div>
        <div className="field"><label htmlFor="pb-court">Court</label><input id="pb-court" className="input" placeholder="e.g. Sân Pickleball Thảo Điền, court 3" value={f.court} onChange={up('court')} /></div>
        {'price' in f && <div className="field"><label htmlFor="pb-price">Usual court price</label><MoneyInput id="pb-price" value={f.price} onChange={(v) => setF({ ...f, price: v })} /></div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onSave(f)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Rsvp({ pb, s, setSession }) {
  const toggle = (id) => setSession(s.id, (x) => ({ ...x, confirmed: x.confirmed.includes(id) ? x.confirmed.filter((y) => y !== id) : [...x.confirmed, id] }));
  return (
    <div>
      <div className="pb-label">Who's coming? <span className="muted">Tap to confirm</span></div>
      <div className="pb-rsvp">
        {pb.members.filter((m) => !m.archived).map((m) => {
          const on = s.confirmed.includes(m.id);
          return (
            <button key={m.id} className={`pb-rsvp-chip ${on ? 'on' : ''}`} onClick={() => toggle(m.id)} aria-pressed={on}>
              {on ? <Icon name="check" size={14} stroke={2.6} /> : null}{m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sessions({ pb, setPb, setSession, open }) {
  const [edit, setEdit] = useState(null); // 'schedule' | 'one' | 'add'
  const active = pb.members.filter((m) => !m.archived);
  const upcoming = pb.sessions.filter((s) => s.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming.find((s) => s.status !== 'cancelled') || upcoming[0];
  const past = pb.sessions.filter((s) => s.date < todayIso || (s.date === todayIso && s.locked)).sort((a, b) => b.date.localeCompare(a.date));
  const attention = past.filter((s) => ['attendance', 'expenses', 'collecting', 'refund'].includes(sessionState(pb, s).key));
  const sc = pb.schedule;

  const saveOne = (f) => { setSession(next.id, (x) => ({ ...x, start: f.start, end: f.end, court: f.court, custom: true })); setEdit(null); };
  const saveSchedule = (f) => { setPb((p) => ensureUpcoming({ ...p, schedule: { ...p.schedule, ...f, active: true } })); setEdit(null); };
  const addOne = (f) => {
    setPb((p) => (p.sessions.some((s) => s.date === f.date) ? p : { ...p, sessions: [...p.sessions, newSession(p, f.date, { start: f.start, end: f.end, court: f.court, custom: true })] }));
    setEdit(null);
  };
  const cancelToggle = (s) => setSession(s.id, (x) => ({ ...x, status: x.status === 'cancelled' ? 'scheduled' : 'cancelled', custom: true }));

  return (
    <div className="stack">
      {next ? (
        <section className={`card pb-hero ${next.status === 'cancelled' ? 'off' : ''}`}>
          <div className="pb-hero-art" aria-hidden="true"><span className="pb-ball" /></div>
          <div className="pb-hero-title">{WEEKDAYS[parse(next.date).getDay()]}<br />Pickleball</div>
          <div className="pb-meta"><Icon name="users" size={18} />{active.length} members</div>
          <div className="pb-meta"><Icon name="cal" size={18} />{fmtDate(next.date)} · {next.start}–{next.end}</div>
          <div className="pb-meta"><Icon name="pin" size={18} />{next.court || <button className="link-btn" onClick={() => setEdit('one')}>Add court</button>}</div>
          {next.status === 'cancelled' ? (
            <div className="pb-cancelled"><span className="chip rose">This session is cancelled</span><button className="btn sm ghost" onClick={() => cancelToggle(next)}>Restore</button></div>
          ) : (
            <>
              <div className="pb-hero-tiles">
                <div className="pb-tile ok"><Icon name="checkCircle" size={26} /><div><b>{next.confirmed.length}</b><span>confirmed</span></div></div>
                <button className="pb-tile go" onClick={() => open(next.id)}><Icon name="users" size={24} /><span>Open<br />session</span></button>
              </div>
              <Rsvp pb={pb} s={next} setSession={setSession} />
              <div className="pb-actions">
                <button className="btn sm ghost" onClick={() => setEdit('one')}><Icon name="pen" size={14} />Change time / court</button>
                <button className="btn sm ghost" onClick={() => cancelToggle(next)}><Icon name="close" size={14} />Cancel this session</button>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="card"><div className="empty">No upcoming session. Set a weekly schedule or add a one-off session.</div></section>
      )}
      {edit === 'one' && next && <SessionForm title={`Change ${fmtDate(next.date)} only`} init={{ start: next.start, end: next.end, court: next.court }} onSave={saveOne} onClose={() => setEdit(null)} />}

      {attention.length > 0 && (
        <section className="card">
          <div className="card-head"><h3 className="card-title"><Icon name="bell" size={18} />Needs attention</h3></div>
          {attention.map((s) => <SessionRow key={s.id} pb={pb} s={s} open={open} />)}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3 className="card-title"><Icon name="repeat" size={18} />Weekly schedule</h3>
          {sc.active && <button className="btn sm ghost" onClick={() => setEdit('schedule')}>Edit</button>}
        </div>
        {sc.active ? (
          <div className="row" style={{ paddingTop: 2 }}>
            <span className="icon-tile"><Icon name="cal" size={18} /></span>
            <div className="row-main">
              <div className="row-title">Every {WEEKDAYS[sc.weekday]} · {sc.start}–{sc.end}</div>
              <div className="row-sub">{sc.court || 'No court set'}{sc.price ? ` · usually ${money(sc.price)}` : ''}</div>
            </div>
            <button className="btn sm ghost" onClick={() => setPb((p) => ensureUpcoming({ ...p, schedule: { ...p.schedule, active: false } }))}>Pause</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="muted">Weekly schedule is paused.</span>
            <button className="btn sm" onClick={() => setEdit('schedule')}>Set weekly schedule</button>
          </div>
        )}
        <div style={{ marginTop: 10 }}><button className="btn sm ghost" onClick={() => setEdit('add')}><Icon name="plus" size={14} />Add one-off session</button></div>
      </section>
      {edit === 'schedule' && <SessionForm title="Weekly schedule" showDate="weekday" init={{ weekday: sc.weekday, start: sc.start, end: sc.end, court: sc.court, price: sc.price || 0 }} onSave={saveSchedule} onClose={() => setEdit(null)} />}
      {edit === 'add' && <SessionForm title="One-off session" showDate="date" init={{ date: todayIso, start: sc.start, end: sc.end, court: sc.court }} onSave={addOne} onClose={() => setEdit(null)} />}

      <section className="card">
        <div className="card-head"><h3 className="card-title"><Icon name="clock" size={18} />History</h3></div>
        {past.filter((x) => !attention.includes(x)).length ? past.filter((x) => !attention.includes(x)).map((s) => <SessionRow key={s.id} pb={pb} s={s} open={open} />) : <div className="empty">Past sessions will appear here.</div>}
        {upcoming.filter((s) => s !== next).map((s) => <SessionRow key={s.id} pb={pb} s={s} open={open} />)}
      </section>
    </div>
  );
}

function SessionRow({ pb, s, open }) {
  const st = sessionState(pb, s);
  const n = s.locked ? participants(pb, s).length : s.confirmed.length;
  return (
    <button className="row pb-row" onClick={() => open(s.id)}>
      <span className="pb-date"><b>{parse(s.date).getDate()}</b>{monthName(parse(s.date).getMonth())}</span>
      <span className="row-main">
        <span className="row-title" style={{ display: 'block' }}>{fmtDate(s.date)} · {s.start}–{s.end}</span>
        <span className="row-sub" style={{ display: 'block' }}>{s.locked ? `${n} played` : `${n} confirmed`}{s.locked && s.expenses.length ? ` · ${money(costs(s).total)}` : ''}{s.example ? ' · example' : ''}</span>
      </span>
      <span className={`chip ${st.tone}`}>{st.label}</span>
    </button>
  );
}

/* ================= Team ================= */
function Team({ pb, setPb }) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const patch = (id, p) => setPb((x) => ({ ...x, members: x.members.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  const add = () => {
    const n = name.trim(); if (!n) return;
    setPb((x) => ({ ...x, members: [...x.members, { id: `m-${uid()}`, name: n }] }));
    setName(''); setAdding(false);
  };
  const setOrganizer = (id) => setPb((x) => ({ ...x, members: x.members.map((m) => ({ ...m, organizer: m.id === id })) }));
  const list = pb.members.filter((m) => !m.archived);
  const archived = pb.members.filter((m) => m.archived);
  return (
    <div className="stack pb-team">
      {list.map((m) => (
        <div key={m.id} className="pb-member">
          <button className="pb-member-main" onClick={() => setEditing(editing === m.id ? null : m.id)} aria-expanded={editing === m.id}>
            <Avatar tone={toneOf(pb, m.id)} />
            <span className="pb-name">{m.name}</span>
            {pb.me === m.id && <span className="chip">You</span>}
            {m.organizer && <span className="pb-pill">Organizer</span>}
          </button>
          {editing === m.id && (
            <div className="pb-member-edit">
              <input className="input" value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} aria-label="Member name" />
              <div className="pb-actions">
                {!m.organizer && <button className="btn sm ghost" onClick={() => setOrganizer(m.id)}>Make organizer</button>}
                {pb.me !== m.id && <button className="btn sm ghost" onClick={() => setPb((x) => ({ ...x, me: m.id }))}>This is me</button>}
                {!m.organizer && pb.me !== m.id && <button className="btn sm ghost" style={{ color: 'var(--rose)' }} onClick={() => { patch(m.id, { archived: true }); setEditing(null); }}>Remove from team</button>}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>Removing keeps their past sessions and payments.</div>
            </div>
          )}
        </div>
      ))}
      {archived.length > 0 && (
        <div className="muted" style={{ fontSize: 13 }}>
          Former members: {archived.map((m, i) => <span key={m.id}>{i ? ', ' : ''}{m.name} <button className="link-btn" onClick={() => patch(m.id, { archived: false })}>restore</button></span>)}
        </div>
      )}
      {adding ? (
        <div className="card pb-form">
          <div className="field"><label htmlFor="pb-new">New member</label>
            <input id="pb-new" className="input" autoFocus placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn" onClick={add} disabled={!name.trim()}>Add</button>
          </div>
        </div>
      ) : (
        <button className="btn block pb-cta" onClick={() => setAdding(true)}><Icon name="userPlus" size={22} />Add member</button>
      )}
    </div>
  );
}

/* ================= Một buổi: Attendance / Expenses / Split ================= */
function Attendance({ pb, s, setSession, go }) {
  const [guest, setGuest] = useState('');
  const ids = playedIds(s);
  const members = pb.members.filter((m) => !m.archived || ids.includes(m.id));
  const total = members.length + s.guests.length;
  const toggle = (id) => setSession(s.id, (x) => {
    const cur = playedIds(x);
    return { ...x, played: cur.includes(id) ? cur.filter((y) => y !== id) : [...cur, id] };
  });
  const addGuest = () => {
    const n = guest.trim(); if (!n) return;
    const id = `g-${uid()}`;
    setSession(s.id, (x) => ({ ...x, guests: [...x.guests, { id, name: n }], played: [...playedIds(x), id] }));
    setGuest('');
  };
  const removeGuest = (id) => setSession(s.id, (x) => ({ ...x, guests: x.guests.filter((g) => g.id !== id), played: playedIds(x).filter((y) => y !== id) }));
  const n = ids.length;
  return (
    <div className="stack">
      <div className={`pb-big ${s.locked ? 'ok' : ''}`}>
        <span className="pb-big-ic"><Icon name="check" size={26} stroke={2.6} /></span>
        <div><b>{n} played</b><span>of {total} {s.guests.length ? 'people' : 'members'}{s.locked ? ' · confirmed' : ''}</span></div>
      </div>
      {s.played == null && s.confirmed.length > 0 && <div className="muted" style={{ fontSize: 13 }}>Pre-filled from who confirmed. Untick anyone who didn't show up.</div>}
      <div className="pb-list">
        {members.map((m) => {
          const on = ids.includes(m.id);
          return (
            <label key={m.id} className={`pb-check-row ${s.locked ? 'locked' : ''}`}>
              <Avatar tone={toneOf(pb, m.id)} />
              <span className="pb-name">{m.name}{s.confirmed.includes(m.id) && !on && <small className="muted"> · confirmed, absent</small>}</span>
              <input type="checkbox" className="pb-box" checked={on} disabled={s.locked} onChange={() => toggle(m.id)} />
            </label>
          );
        })}
        {s.guests.map((g) => (
          <label key={g.id} className={`pb-check-row ${s.locked ? 'locked' : ''}`}>
            <Avatar guest />
            <span className="pb-name">{g.name} <small className="muted">· guest</small></span>
            {!s.locked && <button className="bare-btn" style={{ margin: 0 }} onClick={(e) => { e.preventDefault(); removeGuest(g.id); }} aria-label={`Remove ${g.name}`}><Icon name="trash" size={16} /></button>}
            <input type="checkbox" className="pb-box" checked={ids.includes(g.id)} disabled={s.locked} onChange={() => toggle(g.id)} />
          </label>
        ))}
      </div>
      {!s.locked && (
        <div className="pb-guest">
          <input className="input" placeholder="Add a guest for this session" value={guest} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} />
          <button className="btn ghost" onClick={addGuest} disabled={!guest.trim()}><Icon name="plus" size={16} />Guest</button>
        </div>
      )}
      {s.locked ? (
        <div className="pb-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" onClick={() => setSession(s.id, (x) => ({ ...x, locked: false }))}>Edit attendance</button>
          <button className="btn" onClick={() => go('expenses')}>Next: expenses<Icon name="chevR" size={16} /></button>
        </div>
      ) : (
        <button className="btn block pb-cta" disabled={!n} onClick={() => { setSession(s.id, (x) => ({ ...x, played: playedIds(x), locked: true })); go('expenses'); }}>Confirm attendance</button>
      )}
    </div>
  );
}

function Expenses({ pb, s, setSession, go }) {
  const org = organizer(pb);
  const c = costs(s);
  const [form, setForm] = useState(null);
  const people = [...pb.members.filter((m) => !m.archived), ...s.guests];
  const startAdd = (kind, amount = 0) => setForm({ id: null, kind, amount, label: '', paidBy: org?.id });
  const save = () => {
    if (!form.amount) return;
    const item = { id: form.id || uid(), kind: form.kind, amount: form.amount, paidBy: form.paidBy, label: form.kind === 'other' ? form.label.trim() : '' };
    setSession(s.id, (x) => ({ ...x, expenses: form.id ? x.expenses.map((e) => (e.id === form.id ? item : e)) : [...x.expenses, item] }));
    setForm(null);
  };
  const del = (id) => { setSession(s.id, (x) => ({ ...x, expenses: x.expenses.filter((e) => e.id !== id) })); setForm(null); };
  const hasDeposit = s.expenses.some((e) => e.kind === 'deposit');
  return (
    <div className="stack">
      <div className="pb-court-edit">
        <label htmlFor="pb-cp">Court total for this session</label>
        <MoneyInput id="pb-cp" value={s.courtPrice} onChange={(v) => setSession(s.id, (x) => ({ ...x, courtPrice: v }))} />
      </div>
      <div className="pb-court">
        <div className="pb-court-cell"><span>Court total</span><b>{money(c.courtPrice)}</b></div>
        <div className="pb-court-cell ok"><span>Deposit paid</span><b>{money(c.deposit)}</b></div>
        <div className={`pb-court-cell ${c.remaining ? 'due' : 'ok'}`}><span>Remaining</span><b>{money(c.remaining)}</b></div>
      </div>
      {c.courtPaid > c.courtPrice && c.courtPrice > 0 && <div className="pb-warn">Court payments ({money(c.courtPaid)}) are more than the court total. Check you didn't record the deposit twice.</div>}

      <div className="pb-actions">
        {!hasDeposit && <button className="btn sm ghost" onClick={() => startAdd('deposit')}><Icon name="plus" size={14} />Deposit</button>}
        {c.remaining > 0 && <button className="btn sm" onClick={() => startAdd('court', c.remaining)}><Icon name="plus" size={14} />Pay remaining {money(c.remaining)}</button>}
        <button className="btn sm ghost" onClick={() => startAdd('water')}><Icon name="plus" size={14} />Water</button>
        <button className="btn sm ghost" onClick={() => startAdd('other')}><Icon name="plus" size={14} />Other</button>
      </div>

      {form && (
        <div className="card pb-form">
          <div className="stack" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="pb-kind">Item</label>
              <select id="pb-kind" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}{v.court ? ' (part of court total)' : ''}</option>)}
              </select>
            </div>
            {form.kind === 'other' && <div className="field"><label htmlFor="pb-lbl">What for</label><input id="pb-lbl" className="input" placeholder="e.g. balls, parking" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>}
            <div className="field"><label htmlFor="pb-amt">Amount</label><MoneyInput id="pb-amt" autoFocus value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></div>
            <div className="field"><label htmlFor="pb-by">Paid by</label>
              <select id="pb-by" className="input" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === org?.id ? ' (organizer)' : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {form.id ? <button className="btn ghost" style={{ color: 'var(--rose)' }} onClick={() => del(form.id)}><Icon name="trash" size={16} />Delete</button> : <span />}
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="btn" onClick={save} disabled={!form.amount}>Save</button>
              </span>
            </div>
          </div>
        </div>
      )}

      <section className="card">
        {s.expenses.length ? s.expenses.map((e) => (
          <button key={e.id} className="row pb-row" onClick={() => setForm({ ...e, label: e.label || '' })}>
            <span className={`icon-tile ${KINDS[e.kind]?.court ? '' : 'lav'}`}><Icon name={e.kind === 'water' ? 'drop' : KINDS[e.kind]?.court ? 'paddle' : 'coins'} size={18} /></span>
            <span className="row-main">
              <span className="row-title" style={{ display: 'block' }}>{e.label || KINDS[e.kind]?.label}</span>
              <span className="row-sub" style={{ display: 'block' }}>Paid by {s.guests.find((g) => g.id === e.paidBy)?.name || memberName(pb, e.paidBy)}</span>
            </span>
            <b className="num">{money(e.amount)}</b>
          </button>
        )) : <div className="empty">No expenses yet. Start with the deposit you paid when booking.</div>}
        <div className="pb-total"><span>Total</span><b>{money(c.total)}</b></div>
      </section>
      {s.expenses.length > 0 && <button className="btn block pb-cta" onClick={() => go('split')}>Next: split & settle</button>}
    </div>
  );
}

const STATUS = {
  unpaid: ['Unpaid', 'rose'], partial: ['Partly paid', 'amber'], paid: ['Paid', 'good'], overpaid: ['Overpaid', 'amber'],
  owed: ['To reimburse', 'lav'], reimbursed: ['Reimbursed', 'good'], none: ['Even', ''],
};

function Split({ pb, s, setSession, notify, go }) {
  const st = settle(pb, s);
  const c = st.costs;
  const setReceived = (id, v) => setSession(s.id, (x) => {
    const r = { ...(x.received || {}) };
    if (v) r[id] = v; else delete r[id];
    return { ...x, received: r };
  });
  const copy = async () => notify((await copyText(summaryText(pb, s))) ? 'Summary copied. Paste it in your Zalo group.' : 'Could not copy on this device');
  const warn = !s.locked ? 'Attendance is not confirmed yet, so the split may change.' : c.remaining > 0 ? `Court balance of ${money(c.remaining)} is not recorded yet.` : '';
  if (!st.n) return <div className="card"><div className="empty">Confirm who played first. <button className="link-btn" onClick={() => go('attendance')}>Go to attendance</button></div></div>;
  return (
    <div className="stack">
      {warn && <div className="pb-warn">{warn}</div>}
      <div className="pb-split-hero">
        <Icon name="users" size={30} />
        <div className="pb-split-main"><b>{money(st.share)}</b><span>per player</span></div>
        <div className="pb-split-n"><b>{st.n}</b><span>players</span></div>
      </div>
      <div className="grid g2" style={{ gap: 10 }}>
        <div className="pb-tile2 ok"><Icon name="wallet" size={22} /><span>Paid by</span><b>{st.collectorName}</b><small>{money(st.collectorPaid)} · own share {money(st.collectorShare)}</small></div>
        <div className="pb-tile2 due"><Icon name="download" size={22} /><span>To collect</span><b>{money(st.toCollect)}</b><small>{st.outstanding ? `${money(st.outstanding)} still unpaid` : 'All collected'}</small></div>
      </div>
      <div className="pb-total big"><span>Total</span><b>{money(st.total)}</b></div>
      <section className="card pb-pay">
        {st.rows.map((r) => {
          const [label, tone] = STATUS[r.status];
          return (
            <div key={r.id} className="pb-pay-row">
              <Avatar tone={r.guest ? '' : toneOf(pb, r.id)} guest={r.guest} />
              <div className="row-main">
                <div className="row-title">{r.name}{!r.played && <small className="muted"> · didn't play</small>}</div>
                <div className="row-sub">
                  {r.net > 0 ? `Owes ${money(r.net)}` : r.net < 0 ? `${st.collectorName} owes ${money(-r.net)}` : 'Nothing to pay'}
                  {r.paid > 0 && ` · advanced ${money(r.paid)}`}
                  {r.received !== 0 && r.due !== 0 && <> · <b className={r.due > 0 ? 'rose' : 'mint'}>{r.due > 0 ? `received ${money(r.received)}, ${money(r.due)} more` : `refund ${money(-r.due)}`}</b></>}
                </div>
              </div>
              <div className="pb-pay-side">
              <span className={`chip ${tone}`}>{label}</span>
              {r.due !== 0 ? (
                <button className="pb-mark" onClick={() => setReceived(r.id, r.net)}>{r.net > 0 && r.due > 0 ? 'Mark paid' : r.net < 0 && r.due < 0 && r.received === 0 ? 'Mark returned' : 'Settle diff'}</button>
              ) : r.net !== 0 ? (
                <button className="pb-mark ghost" onClick={() => setReceived(r.id, 0)} aria-label={`Undo payment for ${r.name}`}>Undo</button>
              ) : null}
              </div>
            </div>
          );
        })}
        {!st.rows.length && <div className="empty">Only {st.collectorName} played and paid. Nothing to split.</div>}
      </section>
      <button className="btn block pb-cta" onClick={copy}><Icon name="copy" size={20} />Copy summary</button>
      <details className="pb-preview"><summary>Preview summary</summary><pre>{summaryText(pb, s)}</pre></details>
    </div>
  );
}

function SessionView({ pb, s, setSession, setPb, back, notify }) {
  const st = sessionState(pb, s);
  const [tab, setTab] = useState(!s.locked ? 'attendance' : !s.expenses.length ? 'expenses' : 'split');
  const [editing, setEditing] = useState(false);
  const del = () => {
    if (!window.confirm(`Delete the session on ${fmtDate(s.date)} with its attendance and expenses?`)) return;
    setPb((p) => ({ ...p, sessions: p.sessions.filter((x) => x.id !== s.id), ...(s.date >= todayIso ? { skipped: [...(p.skipped || []), s.date] } : {}) }));
    back();
  };
  const steps = [['attendance', 'Attendance'], ['expenses', 'Expenses'], ['split', 'Split & settle', 'Settle']];
  return (
    <div className="stack">
      <div className="pb-sub-head">
        <button className="bare-btn" onClick={back} aria-label="Back to sessions"><Icon name="back" size={22} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pb-sub-title">{fmtDate(s.date)}</div>
          <div className="muted" style={{ fontSize: 13 }}>{s.start}–{s.end}{s.court ? ` · ${s.court}` : ''}</div>
        </div>
        <span className={`chip ${st.tone}`}>{st.label}</span>
      </div>
      {editing && <SessionForm title="This session" showDate="date" init={{ date: s.date, start: s.start, end: s.end, court: s.court }} onSave={(f) => { setSession(s.id, (x) => ({ ...x, ...f, custom: true })); setEditing(false); }} onClose={() => setEditing(false)} />}
      {s.status === 'cancelled' ? (
        <div className="card"><div className="empty">This session is cancelled. <button className="link-btn" onClick={() => setSession(s.id, (x) => ({ ...x, status: 'scheduled' }))}>Restore it</button></div></div>
      ) : (
        <>
          <div className="tabs seg pb-steps" role="tablist">
            {steps.map(([k, l, short], i) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}><i>{i + 1}</i><span className="pb-long">{l}</span>{short && <span className="pb-short">{short}</span>}</button>
            ))}
          </div>
          {tab === 'attendance' && <Attendance pb={pb} s={s} setSession={setSession} go={setTab} />}
          {tab === 'expenses' && <Expenses pb={pb} s={s} setSession={setSession} go={setTab} />}
          {tab === 'split' && <Split pb={pb} s={s} setSession={setSession} notify={notify} go={setTab} />}
        </>
      )}
      <div className="pb-actions" style={{ marginTop: 6 }}>
        <button className="btn sm ghost" onClick={() => setEditing(true)}><Icon name="pen" size={14} />Edit date / time / court</button>
        {s.status !== 'cancelled' && !s.locked && <button className="btn sm ghost" onClick={() => setSession(s.id, (x) => ({ ...x, status: 'cancelled', custom: true }))}><Icon name="close" size={14} />Cancel session</button>}
        <button className="btn sm ghost" style={{ color: 'var(--rose)' }} onClick={del}><Icon name="trash" size={14} />Delete</button>
      </div>
    </div>
  );
}

/* ================= Stats ================= */
function Stats({ pb }) {
  const [mode, setMode] = useState('month');
  const [ref, setRef] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const from = mode === 'month' ? iso(ref) : `${ref.getFullYear()}-01-01`;
  const to = mode === 'month' ? iso(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)) : `${ref.getFullYear()}-12-31`;
  const s = useMemo(() => stats(pb, from, to), [pb, from, to]);
  const shift = (k) => setRef((r) => (mode === 'month' ? new Date(r.getFullYear(), r.getMonth() + k, 1) : new Date(r.getFullYear() + k, r.getMonth(), 1)));
  const label = mode === 'month' ? `${monthName(ref.getMonth())} ${ref.getFullYear()}` : String(ref.getFullYear());
  const rows = pb.members.filter((m) => !m.archived || s.per[m.id]).map((m) => ({ ...m, n: s.per[m.id] || 0 })).sort((a, b) => b.n - a.n);
  const guests = Object.keys(s.per).filter((id) => id.startsWith('g-')).reduce((t, id) => t + s.per[id], 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="stack">
      <div className="pb-period">
        <div className="tabs seg" style={{ margin: 0 }}>
          {[['month', 'Month'], ['year', 'Year']].map(([k, l]) => <button key={k} className={`tab ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <div className="pb-period-nav">
          <button className="bare-btn" style={{ margin: 0 }} onClick={() => shift(-1)} aria-label="Previous"><Icon name="chevL" size={18} /></button>
          <b>{label}</b>
          <button className="bare-btn" style={{ margin: 0 }} onClick={() => shift(1)} aria-label="Next"><Icon name="chevR" size={18} /></button>
        </div>
      </div>
      <div className="grid g2" style={{ gap: 10 }}>
        <div className="pb-stat"><Icon name="cal" size={22} /><b>{s.sessions}</b><span>sessions played</span></div>
        <div className="pb-stat"><Icon name="coins" size={22} /><b className="mint">{money(s.myShare)}</b><span>Your share ({s.myPlayed} played)</span></div>
        <div className="pb-stat due wide"><Icon name="layers" size={22} /><b>{money(s.outstanding)}</b><span>Outstanding to collect</span></div>
        <div className="pb-stat"><Icon name="wallet" size={22} /><b>{money(s.advanced)}</b><span>You advanced</span></div>
        <div className="pb-stat"><Icon name="chart" size={22} /><b>{money(s.avg)}</b><span>Avg cost / session</span></div>
      </div>
      <section className="card">
        <div className="card-head"><h3 className="card-title">Attendance</h3><span className="muted" style={{ fontSize: 13 }}>{pb.members.find((m) => m.id === pb.me)?.name ? `“You” = ${memberName(pb, pb.me)}` : ''}</span></div>
        {s.sessions ? (
          <div className="pb-bars">
            {rows.map((r, i) => (
              <div key={r.id} className="pb-bar-row">
                <span>{r.name}</span>
                <div className="pb-bar"><i style={{ width: `${(r.n / max) * 100}%`, opacity: 1 - Math.min(i, 4) * 0.15 }} /></div>
                <b>{r.n}</b>
              </div>
            ))}
            {guests > 0 && <div className="muted" style={{ fontSize: 13 }}>Guests: {guests} visits</div>}
          </div>
        ) : <div className="empty">No confirmed sessions in {label}.</div>}
      </section>
    </div>
  );
}

/* ================= Tab chính ================= */
export default function Pickleball({ h, set, notify }) {
  const pb = h.pickleball || null;
  const [view, setView] = useState('sessions');
  const [openId, setOpenId] = useState(null);
  const setPb = (fn) => set((s) => ({ ...s, pickleball: fn(s.pickleball || pbSeed()) }));
  const setSession = (id, fn) => setPb((p) => ({ ...p, sessions: p.sessions.map((x) => (x.id === id ? fn(x) : x)) }));

  // Lần đầu: tạo nhóm 5 người và buổi ví dụ; sau đó luôn có buổi sắp tới theo lịch tuần.
  useEffect(() => {
    if (!pb) { set((s) => ({ ...s, pickleball: ensureUpcoming(s.pickleball || pbSeed()) })); return; }
    const next = ensureUpcoming(pb);
    if (next !== pb) set((s) => ({ ...s, pickleball: ensureUpcoming(s.pickleball) }));
  }, [pb]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pb) return null;
  const open = (id) => { setOpenId(id); window.scrollTo({ top: 0 }); };
  const s = openId && pb.sessions.find((x) => x.id === openId);
  if (s) return <div className="pb"><SessionView key={s.id} pb={pb} s={s} setSession={setSession} setPb={setPb} back={() => setOpenId(null)} notify={notify} /></div>;

  return (
    <div className="pb">
      <div className="pb-nav" role="tablist">
        {[['sessions', 'cal', 'Sessions'], ['team', 'users', 'Team'], ['stats', 'chart', 'Stats']].map(([k, ic, l]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'active' : ''} onClick={() => setView(k)}><Icon name={ic} size={22} />{l}</button>
        ))}
      </div>
      {view === 'sessions' && <Sessions pb={pb} setPb={setPb} setSession={setSession} open={open} />}
      {view === 'team' && <Team pb={pb} setPb={setPb} />}
      {view === 'stats' && <Stats pb={pb} />}
    </div>
  );
}
