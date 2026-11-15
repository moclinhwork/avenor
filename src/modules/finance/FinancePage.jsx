import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { dm, monthLabel, pct, relDays, TODAY, todayIso, uid, vnd, vndShort, ym } from '../../core/format.js';
import { Card, Check, PageHead, Tabs } from '../../ui/common.jsx';
import { BarChart, Donut, Progress, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { byCategory, CATEGORIES, catById, fundSaved, monthlySeries, monthTx, totals } from './data.js';

const INCOME_LABEL = { income: 'Lương', freelance: 'Thu nhập thêm' };

export default function FinancePage() {
  const [f, set] = useModule('finance');
  const notify = useNotify();
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ type: 'out', title: '', amount: '', cat: 'food', date: todayIso });
  const [contrib, setContrib] = useState('');

  const tx = monthTx(f);
  const tot = totals(tx);
  const cats = byCategory(tx);
  const spentCats = cats.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const budget = CATEGORIES.reduce((s, c) => s + c.budget, 0);
  const saved = fundSaved(f.fund);
  const hist = monthlySeries(f);
  const past = hist.slice(0, -1).filter((h) => h.expense > 0);
  const avgExpense = past.reduce((s, h) => s + h.expense, 0) / (past.length || 1);
  const mLabel = `Tháng ${TODAY.getMonth() + 1}/${TODAY.getFullYear()}`;

  const addTx = (e) => {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(/[^\d]/g, ''));
    if (!form.title.trim() || !amount) return notify('Nhập nội dung và số tiền');
    set((s) => ({ ...s, transactions: [{ id: uid(), date: form.date, title: form.title.trim(), amount, cat: form.type === 'in' ? 'freelance' : form.cat, type: form.type }, ...s.transactions] }));
    setForm({ ...form, title: '', amount: '' });
    notify(form.type === 'in' ? 'Đã ghi khoản thu' : 'Đã ghi khoản chi');
  };
  const addContrib = () => {
    const amount = Number(String(contrib).replace(/[^\d]/g, ''));
    if (!amount) return;
    set((s) => ({ ...s, fund: { ...s.fund, contributions: [...s.fund.contributions, { m: monthLabel(ym()), amount }] } }));
    setContrib('');
    notify('Đã nạp vào quỹ dự phòng');
  };
  const toggleBill = (id) => set((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)) }));

  return (
    <div className="fade-in">
      <PageHead title="Tài chính" subtitle={`Theo dõi thu chi, ngân sách và tiết kiệm · ${mLabel}`} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Tổng quan' }, { id: 'tx', label: 'Thu chi' }, { id: 'budget', label: 'Ngân sách' }, { id: 'fund', label: 'Quỹ dự phòng' }]} />

      {tab === 'overview' && (
        <div className="stack">
          <div className="grid g3">
            <section className="card"><div className="stat-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="up" size={15} className="mint" />Thu nhập</div><div className="stat-value" style={{ marginTop: 6 }}>{vndShort(tot.income)}</div><div className="row-sub">{vnd(tot.income)}</div></section>
            <section className="card"><div className="stat-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="down" size={15} className="lav" />Chi tiêu</div><div className="stat-value" style={{ marginTop: 6 }}>{vndShort(tot.expense)}</div><div className="row-sub">{pct(tot.expense, budget)}% ngân sách tháng</div></section>
            <section className="card glow"><div className="stat-label">Dòng tiền ròng</div><div className="stat-value mint" style={{ marginTop: 6 }}>+{vndShort(tot.net)}</div><div className="row-sub">Tỷ lệ tiết kiệm {pct(tot.net, tot.income)}%</div></section>
          </div>
          <div className="grid g-main">
            <Card title="Dòng tiền 6 tháng" icon="chart" glow>
              <BarChart labels={hist.map((h) => h.m)} series={[{ name: 'Thu', color: 'var(--mint)', values: hist.map((h) => h.income) }, { name: 'Chi', color: 'var(--lav)', values: hist.map((h) => h.expense) }]} format={(v) => (v ? `${v / 1e6}tr` : '0')} highlight={hist.length - 1} />
              <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--mint)' }} />Thu nhập</span><span><i style={{ background: 'var(--lav)' }} />Chi tiêu</span><span className="faint">{hist[hist.length - 1].m} tính đến ngày {dm(todayIso)}</span></div>
            </Card>
            <Card title="Cơ cấu chi tiêu" icon="pie">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <Donut segments={spentCats.map((c) => ({ value: c.spent, color: c.color }))} size={150} thickness={18}>
                  <div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{vndShort(tot.expense)}</div><div className="muted" style={{ fontSize: 11 }}>đã chi</div></div>
                </Donut>
                <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 140 }}>
                  {spentCats.slice(0, 6).map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: c.color, marginRight: 8 }} />{c.label}</span>
                      <b className="num">{pct(c.spent, tot.expense)}%</b>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <div className="grid g-main">
            <Card title="Ngân sách nổi bật" icon="target" action={<button className="link" onClick={() => setTab('budget')}>Chi tiết<Icon name="chevR" size={14} /></button>}>
              <div style={{ display: 'grid', gap: 14 }}>
                {cats.slice(0, 6).map((c) => { const p = pct(c.spent, c.budget); return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span>{c.label}</span><span className="num muted">{vndShort(c.spent)} / {vndShort(c.budget)}</span></div>
                    <Progress value={p} tone={p > 100 ? 'rose' : p > 85 ? 'amber' : ''} />
                  </div>); })}
              </div>
            </Card>
            <Card title="Hóa đơn sắp đến hạn" icon="card">
              <div className="list">
                {[...f.bills].sort((a, b) => a.due.localeCompare(b.due)).map((b) => (
                  <div className="row" key={b.id}>
                    <Check on={b.paid} onClick={() => toggleBill(b.id)} label={`Đã thanh toán ${b.name}`} />
                    <div className="row-main"><div className={`row-title ${b.paid ? 'done-text' : ''}`}>{b.name}</div><div className="row-sub">{b.paid ? 'Đã thanh toán' : relDays(b.due)}</div></div>
                    <b className="num">{vndShort(b.amount)}</b>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'tx' && (
        <div className="grid g-main">
          <Card title={`Giao dịch ${mLabel.toLowerCase()}`} icon="journal">
            <div className="list">
              {[...tx].sort((a, b) => b.date.localeCompare(a.date)).map((x) => {
                const c = catById[x.cat];
                return (
                  <div className="row" key={x.id}>
                    <span className="icon-tile" style={{ width: 34, height: 34, background: x.type === 'in' ? 'var(--mint-soft)' : 'var(--surface-3)', color: x.type === 'in' ? 'var(--mint)' : c?.color }}><Icon name={x.type === 'in' ? 'up' : c?.icon || 'grid'} size={16} /></span>
                    <div className="row-main"><div className="row-title">{x.title}</div><div className="row-sub">{dm(x.date)} · {x.type === 'in' ? INCOME_LABEL[x.cat] || 'Thu nhập' : c?.label}</div></div>
                    <b className={`num ${x.type === 'in' ? 'mint' : ''}`}>{x.type === 'in' ? '+' : '−'}{vndShort(x.amount)}</b>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Ghi giao dịch" icon="plus">
            <form onSubmit={addTx} style={{ display: 'grid', gap: 12 }}>
              <div className="tabs seg" style={{ margin: 0 }}>
                {[['out', 'Khoản chi'], ['in', 'Khoản thu']].map(([k, l]) => <button type="button" key={k} className={`tab ${form.type === k ? 'active' : ''}`} onClick={() => setForm({ ...form, type: k })}>{l}</button>)}
              </div>
              <div className="field"><label htmlFor="tx-title">Nội dung</label><input id="tx-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Ăn trưa với đồng nghiệp" /></div>
              <div className="form-row">
                <div className="field"><label htmlFor="tx-amount">Số tiền (₫)</label><input id="tx-amount" className="input" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="150000" /></div>
                <div className="field"><label htmlFor="tx-date">Ngày</label><input id="tx-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              {form.type === 'out' && (
                <div className="field"><label htmlFor="tx-cat">Danh mục</label><select id="tx-cat" className="input" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              )}
              <button className="btn" type="submit"><Icon name="plus" size={18} />Lưu giao dịch</button>
            </form>
          </Card>
        </div>
      )}

      {tab === 'budget' && (
        <div className="grid g-main">
          <Card title="Chi tiêu so với ngân sách" icon="chart" glow>
            <BarChart labels={cats.map((c) => c.label.split(' ')[0])} series={[{ name: 'Ngân sách', color: 'var(--lav-mid)', values: cats.map((c) => c.budget) }, { name: 'Đã chi', color: 'var(--mint)', values: cats.map((c) => c.spent) }]} format={(v) => (v ? `${v / 1e6}tr` : '0')} height={220} />
            <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--lav-mid)' }} />Ngân sách</span><span><i style={{ background: 'var(--mint)' }} />Đã chi</span></div>
          </Card>
          <Card title={`Tổng ngân sách ${vndShort(budget)}`} icon="wallet">
            <div style={{ display: 'grid', gap: 14 }}>
              {cats.map((c) => { const p = pct(c.spent, c.budget); return (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, gap: 8 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name={c.icon} size={15} style={{ color: c.color }} />{c.label}</span>
                    <span className="num"><b>{p}%</b> <span className="muted">· còn {vndShort(Math.max(0, c.budget - c.spent))}</span></span>
                  </div>
                  <Progress value={p} tone={p > 100 ? 'rose' : p > 85 ? 'amber' : ''} />
                </div>); })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'fund' && (
        <div className="grid g-main">
          <Card title="Quỹ dự phòng" icon="shield" glow>
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <Ring value={pct(saved, f.fund.target)} size={150} thickness={14}>
                <div><div className="num" style={{ fontSize: 30, fontWeight: 600 }}>{pct(saved, f.fund.target)}%</div><div className="muted" style={{ fontSize: 11 }}>của mục tiêu</div></div>
              </Ring>
              <div style={{ display: 'grid', gap: 10 }}>
                <div><div className="muted" style={{ fontSize: 12.5 }}>Đã tích lũy</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{vnd(saved)}</div></div>
                <div><div className="muted" style={{ fontSize: 12.5 }}>Mục tiêu (6 tháng chi tiêu)</div><div className="num" style={{ fontSize: 18 }}>{vnd(f.fund.target)}</div></div>
                <span className="chip mint">Đủ chi {(saved / avgExpense).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tháng</span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <BarChart labels={f.fund.contributions.map((c, i) => `${c.m}${f.fund.contributions.filter((x, j) => j < i && x.m === c.m).length ? '+' : ''}`)} series={[{ name: 'Nạp', color: 'var(--mint)', values: f.fund.contributions.map((c) => c.amount) }]} format={(v) => (v ? `${v / 1e6}tr` : '0')} height={170} />
            </div>
          </Card>
          <Card title="Nạp thêm" icon="plus">
            <div className="field"><label htmlFor="fund-add">Số tiền (₫)</label><input id="fund-add" className="input" inputMode="numeric" placeholder="5000000" value={contrib} onChange={(e) => setContrib(e.target.value)} /></div>
            <button className="btn block" style={{ marginTop: 12 }} onClick={addContrib}><Icon name="plus" size={18} />Nạp vào quỹ</button>
            <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Với mức nạp trung bình {vndShort(saved / f.fund.contributions.length)}/tháng, bạn sẽ đạt mục tiêu sau khoảng {Math.ceil((f.fund.target - saved) / (saved / f.fund.contributions.length))} tháng nữa.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
