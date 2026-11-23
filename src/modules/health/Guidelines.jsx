import { Component, useMemo, useRef, useState } from 'react';
import { go } from '../../core/router.js';
import { dmy, todayIso } from '../../core/format.js';
import Icon from '../../ui/Icon.jsx';
import {
  CAT_COLORS, CAT_ICONS, DIRECTION_ORDER, DIRECTIONS, METRICS, SOURCES, STATUSES,
  addGroup, blankForm, catOf, comparePairs, deleteCat, deleteGroup, deleteItem, emptyGuidelines, groupOf,
  isFoodCat, matches, metricLink, metricValue, moveCat, patchItem, removeSamples, safeUrl, saveCat, saveItem, shortNote,
  sortItems, toFormData, validate,
} from './guidelines.js';

/* ---------- điều hướng bằng hash: mỗi màn con là một mục lịch sử, nút Quay lại của điện thoại đi đúng màn trước ---------- */
const BASE = 'health?tab=guidelines';
const url = (p = {}) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
  return s ? `${BASE}&${s}` : BASE;
};
const stack = []; // các hash đã đi qua bằng `to`, để nút Quay lại trong app khớp với nút Quay lại của hệ thống
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { if (stack.length && stack[stack.length - 1] === window.location.hash) stack.pop(); });
}
const to = (p) => { stack.push(window.location.hash); go(url(p)); };
const replaceTo = (p) => window.location.replace(`#${url(p)}`);
const goBack = (parent = {}) => { if (stack.length) window.history.back(); else replaceTo(parent); };

const STATUS_FILTER = [
  ['current', 'Đang áp dụng & tạm dừng'], ['active', 'Đang áp dụng'], ['paused', 'Tạm dừng'], ['archived', 'Lưu trữ'], ['all', 'Tất cả trạng thái'],
];
const statusOk = (x, s) => (s === 'all' ? true : s === 'current' ? x.status !== 'archived' : x.status === s);
const shortDate = (t) => (t ? dmy(String(t).slice(0, 10)) : '');

// Bảo đảm dữ liệu đủ trường (dữ liệu cũ hoặc lỗi đồng bộ không làm vỡ màn hình).
function normalize(raw) {
  const base = emptyGuidelines();
  return {
    ...base, ...raw,
    cats: Array.isArray(raw.cats) && raw.cats.length ? raw.cats : base.cats,
    groups: Array.isArray(raw.groups) && raw.groups.length ? raw.groups : base.groups,
    items: (Array.isArray(raw.items) ? raw.items : []).filter((x) => x && x.id && x.title)
      .map((x) => ({ ...blankForm(x.category), ...x, related: Array.isArray(x.related) ? x.related : [], metrics: Array.isArray(x.metrics) ? x.metrics : [] })),
  };
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card hg-state" role="alert">
        <span className="icon-tile rose"><Icon name="bell" size={18} /></span>
        <b>Chưa hiển thị được phần Nguyên tắc</b>
        <span className="muted">Dữ liệu của bạn không bị xóa. Hãy thử lại.</span>
        <div className="gl-actions" style={{ justifyContent: 'center' }}>
          <button className="btn sm" onClick={() => this.setState({ err: null })}><Icon name="refresh" size={15} />Thử lại</button>
          <button className="btn sm ghost" onClick={() => { this.setState({ err: null }); replaceTo({}); }}>Về trang Nguyên tắc</button>
        </div>
      </div>
    );
  }
}

export default function Guidelines({ h, set, notify, ready, q }) {
  const [f, setF] = useState({ q: '', cat: 'all', metric: '', status: 'current' });
  const [lf, setLf] = useState({ q: '', dir: 'all', group: 'all', compare: false });
  const raw = h.guidelines;
  const g = useMemo(() => (raw ? normalize(raw) : null), [raw]);
  if (!g) {
    return (
      <div className="card hg-state" aria-live="polite">
        <span className="brief-dot" />
        <span className="muted">{ready ? 'Đang chuẩn bị danh sách nguyên tắc…' : 'Đang tải dữ liệu tài khoản…'}</span>
      </div>
    );
  }
  const setG = (next) => set((s) => ({ ...s, guidelines: next }));
  const v = q.get('v') || 'home';
  const id = q.get('id') || '';
  const cat = q.get('cat') || '';
  const props = { g, h, setG, notify };
  return (
    <Boundary key={`${v}-${id}-${cat}`}>
      <div className="hg fade-in">
        {v === 'detail' ? <Detail {...props} id={id} />
          : v === 'form' ? <Form {...props} id={id} cat={cat} />
            : v === 'cats' ? <Cats {...props} />
              : v === 'list' ? <CatList {...props} cat={cat} lf={lf} setLf={setLf} />
                : <Home {...props} f={f} setF={setF} />}
      </div>
    </Boundary>
  );
}

/* ---------- phần dùng chung ---------- */
function DirChip({ d, small }) {
  const D = DIRECTIONS[d];
  if (!D) return null;
  return <span className={`hg-dir hg-${D.tone} ${small ? 'sm' : ''}`}><Icon name={D.icon} size={small ? 12 : 14} />{D.label}</span>;
}
function CatDot({ c }) {
  return <span className="hg-catdot" style={{ background: c.color }} aria-hidden="true" />;
}
function SubHead({ title, sub, onBack, action }) {
  return (
    <div className="hg-subhead">
      <button className="bare-btn" onClick={onBack} aria-label="Quay lại"><Icon name="chevL" size={22} /></button>
      <div className="hg-subhead-main"><h2>{title}</h2>{sub && <div className="muted">{sub}</div>}</div>
      {action}
    </div>
  );
}
function Search({ value, onChange, placeholder }) {
  return (
    <div className="input-icon hg-search">
      <Icon name="search" size={18} />
      <input className="input" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && <button className="eye" onClick={() => onChange('')} aria-label="Xóa tìm kiếm"><Icon name="close" size={16} /></button>}
    </div>
  );
}
function ItemCard({ x, g, showCat }) {
  const c = catOf(g, x.category);
  const grp = isFoodCat(g, x.category) ? groupOf(g, x.foodGroup) : null;
  const note = shortNote(x);
  const due = x.review && x.review <= todayIso && x.status !== 'archived';
  return (
    <button className={`hg-card hg-${DIRECTIONS[x.direction]?.tone || 'enc'} ${x.status !== 'active' ? 'dim' : ''}`} onClick={() => to({ v: 'detail', id: x.id })}>
      <span className="hg-card-top">
        <span className="hg-card-title">{x.title}</span>
        {x.pinned && <Icon name="pin" size={15} />}
      </span>
      <span className="hg-card-meta">
        <DirChip d={x.direction} small />
        {showCat && <span className="hg-meta"><CatDot c={c} />{c.name}</span>}
        {grp && <span className="hg-meta">{grp.name}</span>}
        {x.status !== 'active' && <span className="chip">{STATUSES[x.status]?.label}</span>}
        {x.sample && <span className="chip">Mẫu</span>}
        {due && <span className="chip amber">Đến hạn xem lại</span>}
      </span>
      {x.preparation && <span className="hg-card-prep">{x.preparation}</span>}
      {note && <span className="hg-card-note">{note}</span>}
      {x.metrics.length > 0 && (
        <span className="hg-card-metrics">{x.metrics.filter((m) => METRICS[m]).map((m) => <span key={m}><Icon name={METRICS[m].icon} size={12} />{METRICS[m].label}</span>)}</span>
      )}
    </button>
  );
}
function Block({ d, list, g, showCat, empty }) {
  const D = DIRECTIONS[d];
  return (
    <section className={`hg-block hg-${D.tone}`} aria-label={D.label}>
      <div className="hg-block-head">
        <span className="hg-block-icon"><Icon name={D.icon} size={16} /></span>
        <b>{D.label}</b><span className="hg-count">{list.length}</span>
        <span className="hg-block-hint">{D.hint}</span>
      </div>
      {list.length ? <div className="hg-cards">{list.map((x) => <ItemCard key={x.id} x={x} g={g} showCat={showCat} />)}</div>
        : <div className="hg-empty">{empty}</div>}
    </section>
  );
}

/* ---------- Màn chính ---------- */
function Home({ g, h, setG, notify, f, setF }) {
  const list = g.items.filter((x) => (f.cat === 'all' || x.category === f.cat) && (!f.metric || x.metrics.includes(f.metric)) && statusOk(x, f.status) && matches(x, f.q));
  const filtered = f.q || f.cat !== 'all' || f.metric || f.status !== 'current';
  const samples = g.items.filter((x) => x.sample).length;
  const usedMetrics = Object.keys(METRICS).filter((m) => g.items.some((x) => x.metrics.includes(m)));
  const selCat = f.cat !== 'all' && g.cats.find((c) => c.id === f.cat);
  const clearSamples = () => {
    if (!window.confirm(`Xóa ${samples} mục mẫu? Các mục bạn tự tạo vẫn giữ nguyên.`)) return;
    setG(removeSamples(g)); notify('Đã xóa dữ liệu mẫu');
  };
  return (
    <>
      <div className="hg-toolbar">
        <div style={{ minWidth: 0 }}>
          <h2 className="hg-h2">Nguyên tắc sức khỏe</h2>
          <div className="muted hg-lead">Những gì nên ưu tiên, hạn chế hoặc tránh trong ăn uống và thói quen.</div>
        </div>
        <button className="btn" onClick={() => to({ v: 'form', cat: f.cat !== 'all' ? f.cat : '' })}><Icon name="plus" size={18} />Thêm nguyên tắc</button>
      </div>

      {samples > 0 && (
        <div className="hg-notice">
          <Icon name="bulb" size={16} />
          <span>Đang có {samples} mục <b>mẫu</b>, chỉ mang tính tham khảo chung, không phải lời khuyên y tế cho riêng bạn. Bạn có thể sửa, giữ lại hoặc xóa.</span>
          <button className="link" onClick={clearSamples}>Xóa dữ liệu mẫu</button>
        </div>
      )}

      <Search value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Tìm theo tên, cách chế biến, ghi chú…" />

      <div className="hg-chips" role="group" aria-label="Lọc theo nhóm">
        <button className={`hg-chip ${f.cat === 'all' ? 'on' : ''}`} onClick={() => setF({ ...f, cat: 'all' })}>Tất cả</button>
        {g.cats.map((c) => (
          <button key={c.id} className={`hg-chip ${f.cat === c.id ? 'on' : ''}`} onClick={() => setF({ ...f, cat: c.id })}>
            <Icon name={c.icon} size={14} />{c.name}<span className="hg-chip-n">{g.items.filter((x) => x.category === c.id && x.status !== 'archived').length}</span>
          </button>
        ))}
        <button className="hg-chip ghost" onClick={() => to({ v: 'cats' })}><Icon name="pen" size={13} />Quản lý nhóm</button>
      </div>

      <div className="hg-filters">
        <label className="hg-select"><span>Chỉ số</span>
          <select className="input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>
            <option value="">Tất cả chỉ số</option>
            {Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}{usedMetrics.includes(k) ? '' : ' (chưa liên kết)'}</option>)}
          </select>
        </label>
        <label className="hg-select"><span>Trạng thái</span>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUS_FILTER.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {selCat && (
        <button className="hg-open-list" onClick={() => to({ v: 'list', cat: selCat.id })}>
          <span className="icon-tile" style={{ background: `${selCat.color}22`, color: selCat.color }}><Icon name={selCat.icon} size={18} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><b>Danh sách {selCat.name.toLowerCase()}</b><span className="muted">{isFoodCat(g, selCat.id) ? 'Lọc theo nhóm thực phẩm, so sánh các món liên quan' : 'Lọc theo mức áp dụng, so sánh các mục liên quan'}</span></span>
          <Icon name="chevR" size={18} />
        </button>
      )}

      {filtered && (
        <div className="hg-result">
          <span>{list.length} mục phù hợp</span>
          <button className="link" onClick={() => setF({ q: '', cat: 'all', metric: '', status: 'current' })}>Bỏ lọc</button>
        </div>
      )}

      {g.items.length === 0 ? (
        <div className="card hg-state">
          <span className="icon-tile"><Icon name="leaf" size={18} /></span>
          <b>Chưa có nguyên tắc nào</b>
          <span className="muted">Ghi lại món nên ưu tiên, nên hạn chế hoặc cần tránh để tra nhanh khi đi chợ, gọi món.</span>
          <button className="btn" onClick={() => to({ v: 'form' })}><Icon name="plus" size={18} />Thêm nguyên tắc đầu tiên</button>
        </div>
      ) : (
        <div className="hg-blocks">
          {DIRECTION_ORDER.map((d) => (
            <Block key={d} d={d} g={g} showCat={f.cat === 'all'} list={sortItems(list.filter((x) => x.direction === d))}
              empty={filtered ? 'Không có mục phù hợp bộ lọc.' : 'Chưa có mục nào.'} />
          ))}
        </div>
      )}
      <p className="faint hg-foot">Đây là ghi chú cá nhân để tự theo dõi. Khi có bệnh lý hoặc đang điều trị, hãy làm theo hướng dẫn của bác sĩ, chuyên gia dinh dưỡng.</p>
    </>
  );
}

/* ---------- Danh sách theo nhóm (Danh sách thực phẩm) ---------- */
function CatList({ g, cat, lf, setLf }) {
  const c = g.cats.find((x) => x.id === cat);
  if (!c) return <NotFound text="Nhóm này không còn tồn tại." />;
  const food = isFoodCat(g, cat);
  const inCat = g.items.filter((x) => x.category === cat && x.status !== 'archived');
  const list = sortItems(inCat.filter((x) => (lf.dir === 'all' || x.direction === lf.dir) && (!food || lf.group === 'all' || x.foodGroup === lf.group) && matches(x, lf.q)));
  const groups = food ? g.groups.filter((gr) => inCat.some((x) => x.foodGroup === gr.id)) : [];
  const pairs = lf.compare ? comparePairs(list, g.items) : [];
  const noun = food ? 'thực phẩm' : 'mục';
  return (
    <>
      <SubHead title={food ? 'Danh sách thực phẩm' : c.name} sub={food ? `${inCat.length} thực phẩm` : `${inCat.length} mục`} onBack={() => goBack({})}
        action={<button className="btn sm" onClick={() => to({ v: 'form', cat })}><Icon name="plus" size={16} />{food ? 'Thêm thực phẩm' : 'Thêm'}</button>} />
      <Search value={lf.q} onChange={(v) => setLf({ ...lf, q: v })} placeholder={food ? 'Tìm tên món, cách chế biến, ghi chú…' : 'Tìm tên, ghi chú…'} />
      <div className="tabs seg hg-seg" role="tablist" aria-label="Mức áp dụng">
        {[['all', 'Tất cả'], ...DIRECTION_ORDER.map((d) => [d, DIRECTIONS[d].short])].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={lf.dir === k} className={`tab ${lf.dir === k ? 'active' : ''} ${k !== 'all' ? `hg-tab-${DIRECTIONS[k].tone}` : ''}`} onClick={() => setLf({ ...lf, dir: k })}>{l}</button>
        ))}
      </div>
      {food && groups.length > 0 && (
        <div className="hg-chips" role="group" aria-label="Nhóm thực phẩm">
          <button className={`hg-chip ${lf.group === 'all' ? 'on' : ''}`} onClick={() => setLf({ ...lf, group: 'all' })}>Mọi nhóm</button>
          {groups.map((gr) => <button key={gr.id} className={`hg-chip ${lf.group === gr.id ? 'on' : ''}`} onClick={() => setLf({ ...lf, group: gr.id })}>{gr.name}</button>)}
        </div>
      )}
      <div className="hg-result">
        <span>{lf.compare ? `${pairs.length} cặp để so sánh` : `${list.length} ${noun}`}</span>
        <button className={`hg-chip ${lf.compare ? 'on' : ''}`} onClick={() => setLf({ ...lf, compare: !lf.compare })} aria-pressed={lf.compare}><Icon name="layers" size={14} />So sánh</button>
      </div>

      {lf.compare ? (
        pairs.length ? (
          <div className="hg-pairs">
            {pairs.map(([a, b]) => (
              <div key={`${a.id}-${b.id}`} className="hg-pair">
                {[a, b].map((x) => (
                  <button key={x.id} className={`hg-pair-side hg-${DIRECTIONS[x.direction].tone}`} onClick={() => to({ v: 'detail', id: x.id })}>
                    <DirChip d={x.direction} small />
                    <b>{x.title}</b>
                    {x.preparation && <span className="hg-card-prep">{x.preparation}</span>}
                    {shortNote(x) && <span className="hg-pair-note">{shortNote(x)}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : <div className="card hg-state"><b>Chưa có cặp nào để so sánh</b><span className="muted">Mở một mục, chọn Sửa và thêm “Mục liên quan” (ví dụ Đậu phụ ↔ Đậu phụ chiên ngập dầu).</span></div>
      ) : list.length ? (
        <div className="hg-cards">{list.map((x) => <ItemCard key={x.id} x={x} g={g} />)}</div>
      ) : (
        <div className="card hg-state">
          <b>{inCat.length ? 'Không có mục phù hợp' : `Chưa có ${noun} nào trong nhóm này`}</b>
          {inCat.length ? <button className="link" onClick={() => setLf({ q: '', dir: 'all', group: 'all', compare: false })}>Bỏ lọc</button>
            : <button className="btn" onClick={() => to({ v: 'form', cat })}><Icon name="plus" size={18} />{food ? 'Thêm thực phẩm' : 'Thêm mục'}</button>}
        </div>
      )}
    </>
  );
}

function NotFound({ text }) {
  return (
    <>
      <SubHead title="Không tìm thấy" onBack={() => goBack({})} />
      <div className="card hg-state"><b>{text}</b><button className="btn ghost" onClick={() => replaceTo({})}>Về trang Nguyên tắc</button></div>
    </>
  );
}

/* ---------- Chi tiết ---------- */
function Detail({ g, h, setG, notify, id }) {
  const x = g.items.find((i) => i.id === id);
  if (!x) return <NotFound text="Mục này đã bị xóa hoặc không còn tồn tại." />;
  const c = catOf(g, x.category);
  const food = isFoodCat(g, x.category);
  const grp = food ? groupOf(g, x.foodGroup) : null;
  const related = x.related.map((r) => g.items.find((i) => i.id === r)).filter(Boolean);
  const link = safeUrl(x.url);
  const patch = (p, msg) => { setG(patchItem(g, x.id, p)); notify(msg); };
  const remove = () => {
    if (!window.confirm(`Xóa "${x.title}"?${related.length ? ` Liên kết với ${related.length} mục liên quan cũng được gỡ.` : ''} Không thể hoàn tác.`)) return;
    setG(deleteItem(g, x.id)); notify('Đã xóa');
    goBack(food ? { v: 'list', cat: x.category } : {});
  };
  const due = x.review && x.review <= todayIso && x.status !== 'archived';
  return (
    <>
      <SubHead title="Chi tiết" onBack={() => goBack({})}
        action={<button className="btn sm" onClick={() => to({ v: 'form', id: x.id })}><Icon name="pen" size={15} />Sửa</button>} />
      <article className={`card hg-detail hg-${DIRECTIONS[x.direction].tone}`}>
        <div className="hg-detail-top">
          <DirChip d={x.direction} />
          {x.pinned && <span className="chip mint"><Icon name="pin" size={12} />Đã ghim</span>}
          {x.status !== 'active' && <span className="chip">{STATUSES[x.status]?.label}</span>}
          {x.sample && <span className="chip">Dữ liệu mẫu</span>}
        </div>
        <h2 className="hg-detail-title">{x.title}</h2>
        <div className="hg-detail-meta">
          <span><CatDot c={c} />{c.name}</span>
          {grp && <span>{grp.name}</span>}
          {x.preparation && <span>{x.preparation}</span>}
        </div>
        {[['Lý do', x.reason], ['Hướng dẫn', x.instructions], ['Điều kiện áp dụng', x.conditions]].filter(([, t]) => t).map(([l, t]) => (
          <div key={l} className="hg-sec"><div className="hg-sec-label">{l}</div><p>{t}</p></div>
        ))}
        {!x.reason && !x.instructions && !x.conditions && <p className="muted" style={{ margin: '12px 0 0' }}>Chưa có ghi chú. Bấm Sửa để thêm lý do hoặc hướng dẫn.</p>}
      </article>

      {x.metrics.length > 0 && (
        <section className="card hg-panel">
          <h3 className="card-title"><Icon name="chart" size={18} />Chỉ số liên quan</h3>
          <div className="list">
            {x.metrics.filter((m) => METRICS[m]).map((m) => (
              <button key={m} className="row hg-rowbtn" onClick={() => go(metricLink(m))}>
                <span className="icon-tile lav" style={{ width: 34, height: 34 }}><Icon name={METRICS[m].icon} size={16} /></span>
                <span className="row-main"><span className="row-title">{METRICS[m].label}</span><span className="row-sub">{metricValue(h, m) || 'Chưa có số liệu'} · xem lịch sử</span></span>
                <Icon name="chevR" size={18} />
              </button>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="card hg-panel">
          <h3 className="card-title"><Icon name="layers" size={18} />Mục liên quan</h3>
          <div className="hg-cards">{related.map((r) => <ItemCard key={r.id} x={r} g={g} />)}</div>
        </section>
      )}

      <section className="card hg-panel">
        <h3 className="card-title"><Icon name="book" size={18} />Nguồn và thông tin</h3>
        <dl className="hg-dl">
          <dt>Loại nguồn</dt><dd>{SOURCES[x.source]?.label || 'Ghi chú cá nhân'}</dd>
          {x.sourceDetail && <><dt>Chi tiết nguồn</dt><dd>{x.sourceDetail}</dd></>}
          {link && <><dt>Đường dẫn</dt><dd><a href={link} target="_blank" rel="noopener noreferrer" className="hg-url">{link}</a></dd></>}
          {x.review && <><dt>Ngày xem lại</dt><dd>{dmy(x.review)}{due && <span className="chip amber" style={{ marginLeft: 6 }}>Đến hạn</span>}</dd></>}
          <dt>Tạo lúc</dt><dd>{shortDate(x.created)}</dd>
          <dt>Cập nhật</dt><dd>{shortDate(x.updated)}</dd>
        </dl>
      </section>

      <div className="hg-actions">
        <button className="btn ghost" onClick={() => patch({ pinned: !x.pinned }, x.pinned ? 'Đã bỏ ghim' : 'Đã ghim lên đầu')}><Icon name="pin" size={16} />{x.pinned ? 'Bỏ ghim' : 'Ghim'}</button>
        {x.status !== 'archived' && (
          <button className="btn ghost" onClick={() => patch({ status: x.status === 'paused' ? 'active' : 'paused' }, x.status === 'paused' ? 'Đã áp dụng lại' : 'Đã tạm dừng')}>
            <Icon name={x.status === 'paused' ? 'play' : 'pause'} size={16} />{x.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
          </button>
        )}
        <button className="btn ghost" onClick={() => patch({ status: x.status === 'archived' ? 'active' : 'archived' }, x.status === 'archived' ? 'Đã khôi phục' : 'Đã lưu trữ')}>
          <Icon name={x.status === 'archived' ? 'refresh' : 'inbox'} size={16} />{x.status === 'archived' ? 'Khôi phục' : 'Lưu trữ'}
        </button>
        <button className="btn ghost danger" onClick={remove}><Icon name="trash" size={16} />Xóa</button>
      </div>
    </>
  );
}

/* ---------- Thêm / sửa ---------- */
function Form({ g, h, setG, notify, id, cat }) {
  const existing = id ? g.items.find((x) => x.id === id) : null;
  const [form, setForm] = useState(() => (existing ? toFormData(existing) : blankForm(g.cats.some((c) => c.id === cat) ? cat : g.cats[0]?.id)));
  const [errors, setErrors] = useState({});
  const [more, setMore] = useState(() => !!existing && !!(existing.instructions || existing.conditions || existing.metrics.length || existing.related.length || existing.sourceDetail || existing.url || existing.review || existing.status !== 'active'));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [newGroup, setNewGroup] = useState(null);
  const [rq, setRq] = useState('');
  if (id && !existing) return <NotFound text="Mục cần sửa không còn tồn tại." />;
  const food = isFoodCat(g, form.category);
  const val = (k) => (e) => { setForm((s) => ({ ...s, [k]: e.target.value })); if (errors[k] || errors._) setErrors((er) => ({ ...er, [k]: undefined, _: undefined })); };
  const toggle = (k, v) => setForm((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const others = sortItems(g.items.filter((x) => x.id !== form.id));
  const shownRel = others.filter((x) => form.related.includes(x.id) || (rq.trim() && matches(x, rq))).slice(0, 40);
  const suggest = rq.trim() ? [] : others.filter((x) => !form.related.includes(x.id) && x.category === form.category && x.title.split(' ')[0].toLowerCase() === form.title.trim().split(' ')[0]?.toLowerCase()).slice(0, 5);

  const submit = (e) => {
    e.preventDefault();
    if (lock.current) return; // chặn bấm Lưu hai lần
    lock.current = true; setBusy(true);
    try {
      const errs = Object.fromEntries(Object.entries(validate(g, form)).filter(([, v]) => v));
      if (Object.keys(errs).length) {
        setErrors(errs);
        if (errs.url) setMore(true);
        setTimeout(() => document.querySelector('.hg-form .hg-err')?.closest('.field')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
        return;
      }
      const r = saveItem(g, form);
      setG(r.g);
      notify(existing ? 'Đã lưu thay đổi' : 'Đã thêm nguyên tắc');
      // Chỉ đóng sau khi lưu thành công. Thêm mới: thay màn nhập bằng màn chi tiết; sửa: quay về chi tiết.
      if (existing) goBack({ v: 'detail', id: r.id }); else replaceTo({ v: 'detail', id: r.id });
    } catch {
      setErrors({ _: 'Chưa lưu được. Nội dung bạn nhập vẫn còn nguyên, hãy thử lại.' });
    } finally { lock.current = false; setBusy(false); }
  };
  const addFoodGroup = () => {
    const r = addGroup(g, newGroup || '');
    if (r.error) return notify(r.error);
    setG(r.g); setForm((s) => ({ ...s, foodGroup: r.id })); setNewGroup(null); notify('Đã thêm nhóm thực phẩm');
  };
  const Err = ({ k }) => (errors[k] ? <span className="hg-err" role="alert">{errors[k]}</span> : null);

  return (
    <>
      <SubHead title={existing ? 'Sửa nguyên tắc' : food ? 'Thêm thực phẩm' : 'Thêm nguyên tắc'} onBack={() => goBack({})} />
      <form className="card hg-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="hg-title">Tên <span className="hg-req">*</span></label>
          <input id="hg-title" className={`input ${errors.title ? 'bad' : ''}`} value={form.title} onChange={val('title')} placeholder={food ? 'Ví dụ: Đậu phụ' : 'Ví dụ: Ngủ trước 23 giờ'} autoComplete="off" maxLength={120} />
          <Err k="title" />
        </div>

        <div className="field">
          <span className="hg-label">Mức áp dụng <span className="hg-req">*</span></span>
          <div className="hg-dirpick" role="radiogroup" aria-label="Mức áp dụng">
            {DIRECTION_ORDER.map((d) => (
              <button type="button" key={d} role="radio" aria-checked={form.direction === d} className={`hg-${DIRECTIONS[d].tone} ${form.direction === d ? 'on' : ''}`}
                onClick={() => { setForm((s) => ({ ...s, direction: d })); setErrors((er) => ({ ...er, direction: undefined, reason: undefined })); }}>
                <Icon name={DIRECTIONS[d].icon} size={18} /><b>{DIRECTIONS[d].label}</b>
              </button>
            ))}
          </div>
          <span className="faint" style={{ fontSize: 12 }}>{DIRECTIONS[form.direction]?.hint}</span>
          <Err k="direction" />
        </div>

        <div className="field">
          <label htmlFor="hg-cat">Nhóm <span className="hg-req">*</span></label>
          <select id="hg-cat" className="input" value={form.category} onChange={val('category')}>
            {g.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Err k="category" />
        </div>

        {food && (
          <div className="form-row">
            <div className="field">
              <label htmlFor="hg-group">Nhóm thực phẩm</label>
              {newGroup === null ? (
                <select id="hg-group" className="input" value={form.foodGroup} onChange={(e) => (e.target.value === '__new' ? setNewGroup('') : val('foodGroup')(e))}>
                  {g.groups.map((gr) => <option key={gr.id} value={gr.id}>{gr.name}</option>)}
                  <option value="__new">+ Thêm nhóm thực phẩm…</option>
                </select>
              ) : (
                <div className="hg-inline">
                  <input id="hg-group" className="input" autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Tên nhóm mới" maxLength={40}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFoodGroup(); } }} />
                  <button type="button" className="btn sm" onClick={addFoodGroup}>Thêm</button>
                  <button type="button" className="btn sm ghost" onClick={() => setNewGroup(null)}>Hủy</button>
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="hg-prep">Cách chế biến</label>
              <input id="hg-prep" className="input" value={form.preparation} onChange={val('preparation')} placeholder="Hấp, luộc, chiên ngập dầu…" maxLength={80} />
            </div>
          </div>
        )}
        {food && <span className="faint hg-tip">Cùng một món nhưng chế biến khác (ví dụ đậu phụ hấp và đậu phụ chiên) nên lưu thành hai mục riêng.</span>}

        <div className="field">
          <label htmlFor="hg-reason">Lý do {form.direction === 'avoid' && <span className="hg-req">* (hoặc điều kiện)</span>}</label>
          <textarea id="hg-reason" className={`input ${errors.reason ? 'bad' : ''}`} rows={2} value={form.reason} onChange={val('reason')} placeholder="Vì sao nên ưu tiên, hạn chế hoặc tránh?" />
          <Err k="reason" />
        </div>

        <button type="button" className="hg-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <Icon name={more ? 'chevD' : 'chevR'} size={16} />{more ? 'Ẩn bớt' : 'Thêm chi tiết'}
          <span className="faint">hướng dẫn, điều kiện, chỉ số, nguồn, mục liên quan, trạng thái</span>
        </button>

        {more && (
          <div className="hg-extra">
            <div className="field">
              <label htmlFor="hg-ins">Hướng dẫn</label>
              <textarea id="hg-ins" className="input" rows={2} value={form.instructions} onChange={val('instructions')} placeholder="Lượng, thời điểm, cách dùng…" />
            </div>
            <div className="field">
              <label htmlFor="hg-cond">Điều kiện áp dụng</label>
              <textarea id="hg-cond" className="input" rows={2} value={form.conditions} onChange={val('conditions')} placeholder="Ví dụ: khi huyết áp trên 140/90, trong giai đoạn giảm cân…" />
            </div>

            <div className="field">
              <span className="hg-label">Chỉ số liên quan</span>
              <div className="hg-picks">
                {Object.entries(METRICS).map(([k, m]) => {
                  const on = form.metrics.includes(k); const v = metricValue(h, k);
                  return (
                    <button type="button" key={k} className={`hg-pick ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle('metrics', k)}>
                      <Icon name={on ? 'check' : m.icon} size={14} />{m.label}{v && <span className="faint"> · {v}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <span className="hg-label">Mục liên quan <span className="faint">(liên kết hai chiều)</span></span>
              <Search value={rq} onChange={setRq} placeholder="Tìm mục đã lưu để liên kết…" />
              {suggest.length > 0 && (
                <div className="hg-picks">{suggest.map((x) => <button type="button" key={x.id} className="hg-pick" onClick={() => toggle('related', x.id)}><Icon name="plus" size={13} />{x.title}{x.preparation && <span className="faint"> · {x.preparation}</span>}</button>)}</div>
              )}
              {shownRel.length > 0 ? (
                <div className="hg-rel">
                  {shownRel.map((x) => (
                    <label key={x.id} className="hg-rel-row">
                      <input type="checkbox" checked={form.related.includes(x.id)} onChange={() => toggle('related', x.id)} />
                      <span className="row-main"><span className="row-title">{x.title}</span><span className="row-sub">{[DIRECTIONS[x.direction]?.label, x.preparation, catOf(g, x.category).name].filter(Boolean).join(' · ')}</span></span>
                    </label>
                  ))}
                </div>
              ) : <span className="faint" style={{ fontSize: 12.5 }}>{rq.trim() ? 'Không tìm thấy mục phù hợp.' : others.length ? 'Gõ để tìm, ví dụ cùng một món với cách chế biến khác.' : 'Chưa có mục nào khác để liên kết.'}</span>}
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="hg-src">Loại nguồn</label>
                <select id="hg-src" className="input" value={form.source} onChange={val('source')}>
                  {Object.entries(SOURCES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="hg-srcd">Chi tiết nguồn</label>
                <input id="hg-srcd" className="input" value={form.sourceDetail} onChange={val('sourceDetail')} placeholder="Bác sĩ, tài liệu, ngày khám…" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="hg-url">Đường dẫn nguồn</label>
              <input id="hg-url" className={`input ${errors.url ? 'bad' : ''}`} type="url" inputMode="url" value={form.url} onChange={val('url')} placeholder="https://…" autoComplete="off" />
              <Err k="url" />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="hg-status">Trạng thái</label>
                <select id="hg-status" className="input" value={form.status} onChange={val('status')}>
                  {Object.entries(STATUSES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="hg-review">Ngày xem lại</label>
                <input id="hg-review" className="input" type="date" value={form.review} onChange={val('review')} />
              </div>
            </div>
            <label className="hg-check"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm((s) => ({ ...s, pinned: e.target.checked }))} />Ghim lên đầu danh sách</label>
          </div>
        )}

        {errors._ && <div className="chip rose" style={{ whiteSpace: 'normal' }} role="alert">{errors._}</div>}
        {Object.values(errors).some(Boolean) && !errors._ && <div className="hg-err" role="alert">Kiểm tra lại các trường được đánh dấu.</div>}
        <div className="hg-form-actions">
          <button type="button" className="btn ghost" onClick={() => goBack({})} disabled={busy}>Hủy</button>
          <button type="submit" className="btn" disabled={busy}><Icon name="check" size={18} />{busy ? 'Đang lưu…' : existing ? 'Lưu thay đổi' : 'Lưu'}</button>
        </div>
      </form>
    </>
  );
}

/* ---------- Quản lý nhóm ---------- */
function Cats({ g, setG, notify }) {
  const [edit, setEdit] = useState(null); // { id?, name, icon, color, err }
  const [del, setDel] = useState(null); // { id, replacement, err }
  const [grp, setGrp] = useState('');
  const count = (id) => g.items.filter((x) => x.category === id).length;
  const saveEdit = (e) => {
    e.preventDefault();
    const r = saveCat(g, edit);
    if (r.error) return setEdit({ ...edit, err: r.error });
    setG(r.g); notify(edit.id ? 'Đã lưu nhóm' : 'Đã thêm nhóm'); setEdit(null);
  };
  const askDelete = (c) => {
    if (g.cats.length <= 1) return notify('Cần giữ ít nhất một nhóm');
    if (!count(c.id)) {
      if (!window.confirm(`Xóa nhóm "${c.name}"?`)) return;
      const r = deleteCat(g, c.id); if (r.error) return notify(r.error);
      setG(r.g); notify('Đã xóa nhóm'); return;
    }
    setDel({ id: c.id, replacement: g.cats.find((x) => x.id !== c.id).id });
  };
  const confirmDelete = () => {
    const r = deleteCat(g, del.id, del.replacement);
    if (r.error) return setDel({ ...del, err: r.error });
    setG(r.g); notify(`Đã xóa nhóm, chuyển các mục sang "${catOf(g, del.replacement).name}"`); setDel(null);
  };
  const addG = (e) => {
    e.preventDefault();
    const r = addGroup(g, grp); if (r.error) return notify(r.error);
    if (r.g === g) notify('Nhóm thực phẩm này đã có'); else { setG(r.g); notify('Đã thêm nhóm thực phẩm'); }
    setGrp('');
  };
  const delG = (gr) => {
    const n = g.items.filter((x) => x.foodGroup === gr.id).length;
    if (!window.confirm(`Xóa nhóm thực phẩm "${gr.name}"?${n ? ` ${n} mục sẽ chuyển sang "Khác".` : ''}`)) return;
    const r = deleteGroup(g, gr.id); if (r.error) return notify(r.error);
    setG(r.g); notify('Đã xóa nhóm thực phẩm');
  };
  const delCat = del && g.cats.find((c) => c.id === del.id);

  return (
    <>
      <SubHead title="Quản lý nhóm" sub="Đổi tên, biểu tượng, màu và thứ tự hiển thị" onBack={() => goBack({})}
        action={<button className="btn sm" onClick={() => setEdit({ name: '', icon: 'tag', color: CAT_COLORS[3] })}><Icon name="plus" size={16} />Thêm nhóm</button>} />
      <section className="card">
        <div className="list">
          {g.cats.map((c, i) => (
            <div key={c.id} className="row hg-catrow">
              <span className="icon-tile" style={{ background: `${c.color}22`, color: c.color }}><Icon name={c.icon} size={18} /></span>
              <div className="row-main"><div className="row-title">{c.name}</div><div className="row-sub">{count(c.id)} mục{c.kind === 'food' ? ' · có nhóm thực phẩm, cách chế biến' : ''}</div></div>
              <div className="hg-catbtns">
                <button className="icon-btn" onClick={() => setG(moveCat(g, c.id, -1))} disabled={i === 0} aria-label={`Đưa ${c.name} lên`}><Icon name="up" size={15} /></button>
                <button className="icon-btn" onClick={() => setG(moveCat(g, c.id, 1))} disabled={i === g.cats.length - 1} aria-label={`Đưa ${c.name} xuống`}><Icon name="down" size={15} /></button>
                <button className="icon-btn" onClick={() => setEdit({ ...c })} aria-label={`Sửa ${c.name}`}><Icon name="pen" size={15} /></button>
                <button className="icon-btn" onClick={() => askDelete(c)} aria-label={`Xóa ${c.name}`}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card hg-panel">
        <h3 className="card-title"><Icon name="fork" size={18} />Nhóm thực phẩm</h3>
        <div className="hg-picks">
          {g.groups.map((gr) => (
            <span key={gr.id} className="hg-pick static">{gr.name}<span className="faint">{g.items.filter((x) => x.foodGroup === gr.id).length}</span>
              {gr.custom && <button className="hg-x" onClick={() => delG(gr)} aria-label={`Xóa nhóm thực phẩm ${gr.name}`}><Icon name="close" size={13} /></button>}</span>
          ))}
        </div>
        <form className="hg-inline" onSubmit={addG} style={{ marginTop: 12 }}>
          <input className="input" value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="Thêm nhóm thực phẩm, ví dụ Hải sản" maxLength={40} aria-label="Tên nhóm thực phẩm mới" />
          <button className="btn sm" type="submit" disabled={!grp.trim()}>Thêm</button>
        </form>
      </section>

      {edit && (
        <>
          <div className="sheet-backdrop" onClick={() => setEdit(null)} />
          <form className="sheet hg-sheet" role="dialog" aria-modal="true" aria-label={edit.id ? 'Sửa nhóm' : 'Thêm nhóm'} onSubmit={saveEdit}>
            <div className="sheet-grip" />
            <b className="hg-sheet-title">{edit.id ? 'Sửa nhóm' : 'Thêm nhóm'}</b>
            <div className="field">
              <label htmlFor="hg-cname">Tên nhóm</label>
              <input id="hg-cname" className={`input ${edit.err ? 'bad' : ''}`} autoFocus value={edit.name} maxLength={40} onChange={(e) => setEdit({ ...edit, name: e.target.value, err: '' })} placeholder="Ví dụ: Thực phẩm bổ sung" />
              {edit.err && <span className="hg-err" role="alert">{edit.err}</span>}
            </div>
            <div className="field"><span className="hg-label">Biểu tượng</span>
              <div className="hg-iconpick">{CAT_ICONS.map((ic) => (
                <button type="button" key={ic} className={edit.icon === ic ? 'on' : ''} onClick={() => setEdit({ ...edit, icon: ic })} aria-label={`Biểu tượng ${ic}`} aria-pressed={edit.icon === ic}><Icon name={ic} size={20} /></button>
              ))}</div>
            </div>
            <div className="field"><span className="hg-label">Màu</span>
              <div className="hg-colorpick">{CAT_COLORS.map((col) => (
                <button type="button" key={col} className={edit.color === col ? 'on' : ''} style={{ background: col }} onClick={() => setEdit({ ...edit, color: col })} aria-label={`Màu ${col}`} aria-pressed={edit.color === col} />
              ))}</div>
            </div>
            <div className="hg-preview"><span className="icon-tile" style={{ background: `${edit.color}22`, color: edit.color }}><Icon name={edit.icon} size={18} /></span><b>{edit.name || 'Tên nhóm'}</b></div>
            <div className="hg-form-actions">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Hủy</button>
              <button type="submit" className="btn"><Icon name="check" size={18} />Lưu</button>
            </div>
          </form>
        </>
      )}

      {del && delCat && (
        <>
          <div className="sheet-backdrop" onClick={() => setDel(null)} />
          <div className="sheet hg-sheet" role="dialog" aria-modal="true" aria-label="Xóa nhóm">
            <div className="sheet-grip" />
            <b className="hg-sheet-title">Xóa nhóm “{delCat.name}”</b>
            <p className="muted" style={{ margin: 0 }}>Nhóm đang có {count(delCat.id)} mục. Chọn nhóm sẽ nhận các mục này trước khi xóa.</p>
            <div className="field">
              <label htmlFor="hg-repl">Chuyển các mục sang</label>
              <select id="hg-repl" className="input" value={del.replacement} onChange={(e) => setDel({ ...del, replacement: e.target.value, err: '' })}>
                {g.cats.filter((c) => c.id !== del.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {del.err && <span className="hg-err" role="alert">{del.err}</span>}
            </div>
            <div className="hg-form-actions">
              <button className="btn ghost" onClick={() => setDel(null)}>Hủy</button>
              <button className="btn danger-solid" onClick={confirmDelete}><Icon name="trash" size={16} />Chuyển và xóa</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

