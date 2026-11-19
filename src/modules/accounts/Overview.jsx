import Icon from '../../ui/Icon.jsx';
import { KINDS, LEVEL_LABEL, reviewList } from './data.js';
import { Av } from './ui.jsx';

const OWNER_COLORS = ['var(--mint)', 'var(--lav)', 'var(--expense)', 'var(--sky)', 'var(--amber)'];

export default function Overview({ d, nav }) {
  const all = d.accounts;
  const count = (st) => all.filter((a) => a.status === st).length;
  const review = reviewList(d);
  const sec = review.filter((x) => x.list[0].level === 'security').length;
  const owners = d.parties.map((p) => ({ p, n: all.filter((a) => a.ownerId === p.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const restOwner = all.filter((a) => !d.parties.some((p) => p.id === a.ownerId)).length;

  if (!all.length) return <Empty nav={nav} />;
  return (
    <div className="ac-stack">
      <div className="grid g2">
        <div className="ac-hero good">
          <Icon name="layers" size={24} />
          <b className="num">{all.length}</b><span>Accounts</span>
          <small>{count('active')} active{count('locked') ? ` · ${count('locked')} locked` : ''}{count('closed') ? ` · ${count('closed')} closed` : ''}</small>
        </div>
        <button className="ac-hero rust" onClick={() => nav({ v: 'dir', only: 'review' })}>
          <Icon name="alert" size={24} />
          <b className="num">{review.length}</b><span>Need review</span>
          <small>{review.length ? `${sec} security · ${review.length - sec} other` : 'All accounts reviewed'}</small>
        </button>
      </div>

      <div className="ac-sec"><b>By category</b><button className="link" onClick={() => nav({ v: 'cat' })}>Manage</button></div>
      <div className="grid g2">
        {d.categories.map((c) => (
          <button key={c.id} className="ac-tile" onClick={() => nav({ v: 'dir', cat: c.id })}>
            <Icon name={KINDS[c.kind]?.icon || 'grid'} size={20} />
            <span className="ac-tile-row"><span>{c.name}</span><b className="num">{all.filter((a) => a.categoryId === c.id).length}</b></span>
          </button>
        ))}
      </div>

      {owners.length > 0 && <>
        <div className="ac-sec"><b>By owner</b><span className="muted" style={{ fontSize: 12 }}>{all.length} total</span></div>
        <div className="card ac-owner">
          <div className="ac-bar">{owners.map((x, i) => <i key={x.p.id} style={{ flex: x.n, background: OWNER_COLORS[i % OWNER_COLORS.length] }} />)}{restOwner > 0 && <i style={{ flex: restOwner, background: 'var(--track)' }} />}</div>
          {owners.map((x, i) => (
            <button key={x.p.id} className="ac-owner-row" onClick={() => nav({ v: 'dir', owner: x.p.id })}>
              <i style={{ background: OWNER_COLORS[i % OWNER_COLORS.length] }} /><span>{x.p.name}</span><b className="num">{x.n}</b>
            </button>
          ))}
        </div>
      </>}

      <div className="ac-sec"><b>Needs review</b>{review.length > 3 && <button className="link" onClick={() => nav({ v: 'dir', only: 'review' })}>View all {review.length}</button>}</div>
      {review.length ? (
        <div className="card ac-list">
          {review.slice(0, 4).map(({ a, list }) => (
            <button key={a.id} className="ac-row" onClick={() => nav({ v: 'acc', id: a.id, tab: list[0].level === 'overdue' ? 'details' : 'security' })}>
              <Av d={d} a={a} />
              <span className="ac-row-main"><span className="ac-row-title">{a.label}</span><span className={`ac-row-sub ${LEVEL_LABEL[list[0].level][1]}`}>{list[0].text}{list.length > 1 ? ` · +${list.length - 1} more` : ''}</span></span>
              <span className={`chip ${LEVEL_LABEL[list[0].level][1]}`}>{LEVEL_LABEL[list[0].level][0]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card ac-allgood"><Icon name="check" size={20} /><span>All accounts reviewed. Nothing needs attention.</span></div>
      )}
    </div>
  );
}

function Empty({ nav }) {
  return (
    <div className="ac-empty">
      <span className="ac-empty-ic"><Icon name="layers" size={34} /></span>
      <h2>Keep track of every account</h2>
      <p className="muted">Start with your main email. Everything else links back to it, so recovery chains stay easy to follow.</p>
      <button className="btn block" onClick={() => nav({ v: 'add' })}><Icon name="plus" size={18} />Add your first account</button>
      <div className="ac-sec" style={{ width: '100%' }}><b style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }} className="muted">Or start from</b></div>
      <button className="ac-quick" onClick={() => nav({ v: 'add', cat: 'email', plat: 'google' })}><span className="icon-tile"><Icon name="mail" size={18} /></span>A Google or Outlook email</button>
      <button className="ac-quick" onClick={() => nav({ v: 'add', cat: 'bank' })}><span className="icon-tile"><Icon name="bank" size={18} /></span>A bank account</button>
    </div>
  );
}
