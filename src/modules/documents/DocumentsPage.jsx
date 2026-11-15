import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { addDays, daysFromToday, dmy, iso, TODAY, uid, vnd, vndShort } from '../../core/format.js';
import { Card, PageHead, Tabs } from '../../ui/common.jsx';
import { Donut } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { status, TYPES } from './data.js';

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

export default function DocumentsPage() {
  const [d, set] = useModule('documents');
  const notify = useNotify();
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ name: '', type: 'other', expires: iso(addDays(TODAY, 90)), remind: 30 });
  const docs = [...d.docs].sort((a, b) => a.expires.localeCompare(b.expires));
  const list = docs.filter((x) => filter === 'all' || x.type === filter);
  const groups = { rose: docs.filter((x) => status(x).tone === 'rose').length, amber: docs.filter((x) => status(x).tone === 'amber').length, mint: docs.filter((x) => status(x).tone === 'mint').length };
  const subs = docs.filter((x) => x.type === 'sub');
  const subMonthly = subs.reduce((s, x) => s + (x.cost || 0), 0);

  return (
    <div className="fade-in">
      <PageHead title="Giấy tờ & Gia hạn" subtitle="Không bao giờ để hộ chiếu, bảo hiểm hay gói đăng ký hết hạn bất ngờ." />
      <div className="grid g-main">
        <Card title="Trục hết hạn 12 tháng tới" icon="clock" glow>
          <Runway docs={docs} />
          <div className="legend" style={{ marginTop: 6 }}><span><i style={{ background: 'var(--rose)' }} />Đã hết hạn</span><span><i style={{ background: 'var(--amber)' }} />Trong thời gian nhắc</span><span><i style={{ background: 'var(--mint)' }} />Còn xa</span></div>
        </Card>
        <Card title="Tình trạng" icon="shield">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut size={124} thickness={14} segments={[{ value: groups.rose, color: 'var(--rose)' }, { value: groups.amber, color: 'var(--amber)' }, { value: groups.mint, color: 'var(--mint)' }]}>
              <div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{docs.length}</div><div className="muted" style={{ fontSize: 11 }}>giấy tờ</div></div>
            </Donut>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              <span><b className="num rose">{groups.rose}</b> đã hết hạn</span>
              <span><b className="num amber">{groups.amber}</b> cần gia hạn sớm</span>
              <span><b className="num mint">{groups.mint}</b> còn hiệu lực</span>
              <span className="muted">Gói đăng ký: {vndShort(subMonthly)}/tháng</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'Tất cả' }, ...Object.entries(TYPES).map(([k, t]) => ({ id: k, label: t.label }))]} />
      </div>
      <div className="grid g-main">
        <Card>
          <div className="list">
            {list.map((x) => { const s = status(x); return (
              <div className="row" key={x.id}>
                <span className={`icon-tile ${s.tone === 'mint' ? '' : s.tone}`}><Icon name={TYPES[x.type].icon} size={18} /></span>
                <div className="row-main">
                  <div className={`row-title ${x.handled ? 'done-text' : ''}`}>{x.name}</div>
                  <div className="row-sub">Hết hạn {dmy(x.expires)}{x.cost ? ` · ${vnd(x.cost)}${x.cycle ? `/${x.cycle}` : ''}` : ''}{x.number ? ` · ${x.number}` : ''}</div>
                  {x.note && <div className="row-sub" style={{ color: 'var(--amber)' }}>{x.note}</div>}
                </div>
                <span className={`chip ${x.handled ? '' : s.tone}`}>{x.handled ? 'Đã xử lý' : s.label}</span>
              </div>); })}
          </div>
        </Card>
        <Card title="Thêm giấy tờ" icon="plus">
          <form style={{ display: 'grid', gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return notify('Nhập tên giấy tờ'); set((s) => ({ ...s, docs: [...s.docs, { id: uid(), ...form, name: form.name.trim(), remind: Number(form.remind) }] })); setForm({ ...form, name: '' }); notify('Đã lưu, sẽ nhắc trước khi hết hạn'); }}>
            <div className="field"><label htmlFor="d-name">Tên</label><input id="d-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Visa Nhật Bản" /></div>
            <div className="field"><label htmlFor="d-type">Loại</label><select id="d-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></div>
            <div className="form-row">
              <div className="field"><label htmlFor="d-exp">Ngày hết hạn</label><input id="d-exp" type="date" className="input" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></div>
              <div className="field"><label htmlFor="d-rem">Nhắc trước (ngày)</label><input id="d-rem" className="input" inputMode="numeric" value={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.value })} /></div>
            </div>
            <button className="btn" type="submit"><Icon name="plus" size={18} />Lưu giấy tờ</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
