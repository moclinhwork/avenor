import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { addDays, daysFromToday, dmy, iso, TODAY, uid, vnd, vndShort } from '../../core/format.js';
import { Card, PageHead, Tabs } from '../../ui/common.jsx';
import { Donut } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { allTypes, CYCLES, monthlyCost, nextExpiry, status, typeOf } from './data.js';

function Runway({ docs }) {
  // Trục thời gian 12 tháng tới, mỗi giấy tờ là một điểm theo ngày hết hạn.
  const horizon = 365;
  const pts = docs.map((d) => ({ d, n: daysFromToday(d.expires) })).filter((x) => x.n <= horizon).sort((a, b) => a.n - b.n);
  return (
    <div style={{ position: 'relative', height: 110, margin: '8px 6px 0' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 54, height: 2, background: 'linear-gradient(90deg, var(--rose), var(--amber) 15%, var(--mint) 40%, var(--line-strong))' }} />
      {[0, 3, 6, 9, 12].map((mo) => (
        <span key={mo} className="faint" style={{ position: 'absolute', left: `${(mo / 12) * 100}%`, top: 64, fontSize: 11, transform: 'translateX(-50%)' }}>{mo === 0 ? 'Nay' : `+${mo}th`}</span>
      ))}
      {pts.map(({ d, n }, i) => {
        const x = Math.max(0, (n / horizon) * 100); const s = status(d); const up = i % 2 === 0;
        return (
          <div key={d.id} title={`${d.name} · ${dmy(d.expires)}`} style={{ position: 'absolute', left: `${x}%`, top: up ? 0 : 60, transform: 'translateX(-50%)', display: 'grid', justifyItems: 'center' }}>
            {!up && <span style={{ width: 1, height: 0 }} />}
            <span style={{ width: 12, height: 12, borderRadius: 9, background: `var(--${s.tone})`, boxShadow: `0 0 10px var(--${s.tone})`, position: 'absolute', top: up ? 48 : -12 }} />
          </div>
        );
      })}
    </div>
  );
}

const blank = () => ({ name: '', type: 'other', expires: iso(addDays(TODAY, 90)), remind: 30, cost: '', cycle: '', number: '', provider: '', note: '' });
const toForm = (x) => ({ ...blank(), ...x, cost: x.cost ? String(x.cost) : '', cycle: x.cycle || '', number: x.number || '', provider: x.provider || '', note: x.note || '' });
const fromForm = (f) => {
  const out = { ...f, name: f.name.trim(), remind: Math.max(0, Number(f.remind) || 0), cost: Number(String(f.cost).replace(/[^\d]/g, '')) || 0 };
  ['cost', 'cycle', 'number', 'provider', 'note'].forEach((k) => { if (!out[k]) delete out[k]; else if (typeof out[k] === 'string') out[k] = out[k].trim(); });
  return out;
};

// Form dùng chung cho thêm mới và sửa.
function DocForm({ f, setF, types, onNewType, idp }) {
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="field"><label htmlFor={`${idp}-name`}>Tên</label><input id={`${idp}-name`} className="input" value={f.name} onChange={up('name')} placeholder="Ví dụ: Tên miền moclinh.vn, Hosting, Truyền hình FPT" /></div>
      <div className="form-row">
        <div className="field"><label htmlFor={`${idp}-type`}>Loại</label>
          <select id={`${idp}-type`} className="input" value={f.type} onChange={(e) => { if (e.target.value === '__new') { const id = onNewType(); if (id) setF({ ...f, type: id }); } else setF({ ...f, type: e.target.value }); }}>
            {Object.entries(types).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            <option value="__new">+ Thêm loại mới…</option>
          </select></div>
        <div className="field"><label htmlFor={`${idp}-prov`}>Nhà cung cấp</label><input id={`${idp}-prov`} className="input" value={f.provider} onChange={up('provider')} placeholder="Không bắt buộc" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor={`${idp}-exp`}>Ngày hết hạn</label><input id={`${idp}-exp`} type="date" className="input" value={f.expires} onChange={up('expires')} /></div>
        <div className="field"><label htmlFor={`${idp}-rem`}>Nhắc trước (ngày)</label><input id={`${idp}-rem`} className="input" inputMode="numeric" value={f.remind} onChange={up('remind')} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor={`${idp}-cost`}>Phí gia hạn (₫)</label><input id={`${idp}-cost`} className="input" inputMode="numeric" value={f.cost ? Number(String(f.cost).replace(/[^\d]/g, '')).toLocaleString('vi-VN') : ''} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/[^\d]/g, '') })} placeholder="0" /></div>
        <div className="field"><label htmlFor={`${idp}-cyc`}>Chu kỳ</label>
          <select id={`${idp}-cyc`} className="input" value={f.cycle} onChange={up('cycle')}>{Object.entries(CYCLES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor={`${idp}-num`}>Số / tài khoản</label><input id={`${idp}-num`} className="input" value={f.number} onChange={up('number')} placeholder="Không bắt buộc. Đừng lưu mật khẩu ở đây." /></div>
      <div className="field"><label htmlFor={`${idp}-note`}>Ghi chú</label><input id={`${idp}-note`} className="input" value={f.note} onChange={up('note')} placeholder="Không bắt buộc" /></div>
    </>
  );
}

export default function DocumentsPage() {
  const [d, set] = useModule('documents');
  const notify = useNotify();
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState(null); // form của mục đang sửa (có id)
  const types = allTypes(d);
  const docs = [...d.docs].sort((a, b) => a.expires.localeCompare(b.expires));
  const used = Object.keys(types).filter((k) => docs.some((x) => x.type === k));
  const list = docs.filter((x) => filter === 'all' || x.type === filter);
  const groups = { rose: docs.filter((x) => !x.handled && status(x).tone === 'rose').length, amber: docs.filter((x) => !x.handled && status(x).tone === 'amber').length, mint: docs.filter((x) => x.handled || status(x).tone === 'mint').length };
  const perMonth = docs.reduce((s, x) => s + monthlyCost(x), 0);

  const newType = () => {
    const label = (window.prompt('Tên loại mới (ví dụ: Thẻ thành viên, Phần mềm)') || '').trim();
    if (!label) return null;
    const exist = Object.entries(types).find(([, t]) => t.label.toLowerCase() === label.toLowerCase());
    if (exist) return exist[0];
    const id = `t-${uid()}`;
    set((s) => ({ ...s, types: [...(s.types || []), { id, label }] }));
    notify(`Đã thêm loại "${label}"`);
    return id;
  };
  const add = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify('Nhập tên');
    set((s) => ({ ...s, docs: [...s.docs, { id: uid(), ...fromForm(form) }] }));
    setForm({ ...blank(), type: form.type });
    notify('Đã lưu, sẽ nhắc trước khi hết hạn');
  };
  const save = (e) => {
    e.preventDefault();
    if (!edit.name.trim()) return notify('Nhập tên');
    const v = fromForm(edit);
    set((s) => ({ ...s, docs: s.docs.map((x) => (x.id === edit.id ? { id: x.id, handled: x.expires === v.expires ? x.handled : false, ...v } : x)) }));
    setEdit(null);
    notify('Đã lưu thay đổi');
  };
  const renew = (x) => {
    const next = nextExpiry(x);
    set((s) => ({ ...s, docs: s.docs.map((y) => (y.id === x.id ? { ...y, expires: next, handled: false } : y)) }));
    setEdit(null);
    notify(`Đã gia hạn ${x.name} đến ${dmy(next)}`);
  };
  const remove = (x) => {
    if (!window.confirm(`Xóa "${x.name}"? Không thể hoàn tác.`)) return;
    set((s) => ({ ...s, docs: s.docs.filter((y) => y.id !== x.id) }));
    setEdit(null);
    notify('Đã xóa');
  };

  return (
    <div className="fade-in">
      <PageHead title="Giấy tờ & Gia hạn" subtitle="Không để giấy tờ, tên miền, hosting hay gói dịch vụ hết hạn bất ngờ." />
      <div className="grid g-main">
        <Card title="Trục hết hạn 12 tháng tới" icon="clock" glow>
          <Runway docs={docs} />
          <div className="legend" style={{ marginTop: 6 }}><span><i style={{ background: 'var(--rose)' }} />Đã hết hạn</span><span><i style={{ background: 'var(--amber)' }} />Trong thời gian nhắc</span><span><i style={{ background: 'var(--mint)' }} />Còn xa</span></div>
        </Card>
        <Card title="Tình trạng" icon="shield">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut size={124} thickness={14} segments={[{ value: groups.rose, color: 'var(--rose)' }, { value: groups.amber, color: 'var(--amber)' }, { value: groups.mint, color: 'var(--mint)' }]}>
              <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{docs.length}</div><div className="muted" style={{ fontSize: 11 }}>mục</div></div>
            </Donut>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              <span><b className="num rose">{groups.rose}</b> đã hết hạn</span>
              <span><b className="num amber">{groups.amber}</b> cần gia hạn sớm</span>
              <span><b className="num mint">{groups.mint}</b> còn hiệu lực</span>
              <span className="muted">Phí gia hạn định kỳ: ~{vndShort(perMonth)}/tháng</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Tabs value={used.includes(filter) ? filter : 'all'} onChange={setFilter} tabs={[{ id: 'all', label: `Tất cả (${docs.length})` }, ...used.map((k) => ({ id: k, label: types[k].label }))]} />
      </div>
      <div className="grid g-main">
        <Card>
          <div className="list">
            {list.map((x) => {
              const s = status(x); const t = typeOf(d, x.type);
              if (edit?.id === x.id) return (
                <form key={x.id} className="doc-edit" onSubmit={save}>
                  <DocForm f={edit} setF={setEdit} types={types} onNewType={newType} idp={`e-${x.id}`} />
                  {x.cycle && <button type="button" className="btn ghost" onClick={() => renew(x)}><Icon name="refresh" size={16} />Đã gia hạn thêm 1 kỳ, đến {dmy(nextExpiry(x))}</button>}
                  <div className="gl-actions">
                    <button type="button" className="btn sm ghost danger" onClick={() => remove(x)}><Icon name="trash" size={15} />Xóa</button>
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn sm ghost" onClick={() => setEdit(null)}>Hủy</button>
                    <button type="submit" className="btn sm">Lưu</button>
                  </div>
                </form>
              );
              return (
                <button className="row doc-row" key={x.id} onClick={() => setEdit({ id: x.id, ...toForm(x) })} aria-label={`Sửa ${x.name}`}>
                  <span className={`icon-tile ${x.handled || s.tone === 'mint' ? '' : s.tone}`}><Icon name={t.icon} size={18} /></span>
                  <span className="row-main">
                    <span className={`row-title ${x.handled ? 'done-text' : ''}`} style={{ display: 'block' }}>{x.name}</span>
                    <span className="row-sub" style={{ display: 'block' }}>Hết hạn {dmy(x.expires)}{x.cost ? ` · ${vnd(x.cost)}${x.cycle ? `/${x.cycle}` : ''}` : ''}{x.provider ? ` · ${x.provider}` : ''}{x.number ? ` · ${x.number}` : ''}</span>
                    {x.note && <span className="row-sub" style={{ display: 'block', color: 'var(--amber)' }}>{x.note}</span>}
                  </span>
                  <span className={`chip ${x.handled ? '' : s.tone}`}>{x.handled ? 'Đã xử lý' : s.label}</span>
                  <Icon name="pen" size={15} className="faint" />
                </button>
              );
            })}
            {!list.length && <div className="empty">Chưa có mục nào.</div>}
          </div>
        </Card>
        <Card title="Thêm mục cần gia hạn" icon="plus">
          <form style={{ display: 'grid', gap: 10 }} onSubmit={add}>
            <DocForm f={form} setF={setForm} types={types} onNewType={newType} idp="d" />
            <button className="btn" type="submit"><Icon name="plus" size={18} />Lưu</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
