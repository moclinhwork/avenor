import { useState } from 'react';
import { daysFromToday, num, TODAY, vndShort, ym } from '../../core/format.js';
import { go } from '../../core/router.js';
import { BarChart } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { monthTx, totals } from '../finance/data.js';
import { progress } from '../goals/data.js';
import { finishedIn } from '../books/data.js';

// Phần đầu màn Hôm nay: thu chi tháng và ô tóm tắt các module chính.
export default function Summary({ state }) {
  const [period, setPeriod] = useState('this');
  const key = period === 'this' ? ym() : ym(new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1));
  const f = state.finance;
  const tx = f ? monthTx(f, key) : [];
  const tot = totals(tx);
  const weeks = [[1, 7], [8, 14], [15, 21], [22, 31]];
  const inWeek = (x, [a, b]) => { const d = Number(x.date.slice(8, 10)); return d >= a && d <= b; };
  const series = [
    { name: 'Thu', color: 'var(--lav)', values: weeks.map((w) => tx.filter((x) => x.type === 'in' && inWeek(x, w)).reduce((s, x) => s + x.amount, 0)) },
    { name: 'Chi', color: 'var(--expense)', values: weeks.map((w) => tx.filter((x) => x.type === 'out' && inWeek(x, w)).reduce((s, x) => s + x.amount, 0)) },
  ];

  const h = state.health;
  const lastW = h?.entries?.length ? [...h.entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1).weight : null;
  const goals = state.goals?.goals || [];
  const goalsDone = goals.filter((g) => progress(g) === 100).length;
  const books = state.books;
  const read = books ? finishedIn(books.books, TODAY.getFullYear()).length : 0;
  const trip = (state.travel?.trips || []).filter((t) => daysFromToday(t.start) >= 0).sort((a, b) => a.start.localeCompare(b.start))[0];

  const tiles = [
    { id: 'health', icon: 'heart', label: 'Sức khỏe', value: lastW != null ? `${num(lastW)} kg` : '—' },
    { id: 'goals', icon: 'target', label: 'Mục tiêu', value: `${goalsDone} / ${goals.length}`, sub: 'đã hoàn thành' },
    { id: 'books', icon: 'book', label: 'Đọc sách', value: `${read} / ${books?.yearGoal || 0}`, sub: `cuốn năm ${TODAY.getFullYear()}` },
    { id: 'travel', icon: 'plane', label: 'Sắp đi', value: trip ? trip.name : 'Chưa có', sub: trip ? (daysFromToday(trip.start) === 0 ? 'hôm nay' : `còn ${daysFromToday(trip.start)} ngày`) : '' },
  ];

  return (
    <div className="stack" style={{ marginBottom: 14 }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Thu chi ròng</div>
            <div className="big-num" style={{ color: tot.net < 0 ? 'var(--rose)' : 'var(--text)' }}>{tot.net >= 0 ? '' : '−'}{vndShort(Math.abs(tot.net))}</div>
          </div>
          <select className="input" aria-label="Chọn tháng" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto', minHeight: 38, padding: '7px 12px', borderRadius: 999, fontSize: 13.5 }}>
            <option value="this">Tháng này</option>
            <option value="last">Tháng trước</option>
          </select>
        </div>
        <div className="grid g2" style={{ marginTop: 14, gap: 10 }}>
          <div className="money-tile in"><Icon name="arrowUR" size={22} /><div><div style={{ fontSize: 12.5 }}>Thu nhập</div><div className="v">{vndShort(tot.income)}</div></div></div>
          <div className="money-tile out"><Icon name="arrowDR" size={22} /><div><div style={{ fontSize: 12.5 }}>Chi tiêu</div><div className="v">{vndShort(tot.expense)}</div></div></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <BarChart labels={['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4']} series={series} height={170} format={(v) => vndShort(v)} />
        </div>
      </section>

      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.id} className="tile" onClick={() => go(t.id)}>
            <span className="icon-tile"><Icon name={t.icon} size={18} /></span>
            <span className="tile-main">
              <span className="tile-label" style={{ display: 'block' }}>{t.label}</span>
              <span className="tile-value" style={{ display: 'block' }}>{t.value}</span>
              {t.sub && <span className="tile-sub" style={{ display: 'block' }}>{t.sub}</span>}
            </span>
            <Icon name="chevR" size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
