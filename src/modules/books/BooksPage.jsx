import { useState } from 'react';
import { useModule, useNotify } from '../../core/store.jsx';
import { dmy, pct, TODAY, todayIso, uid } from '../../core/format.js';
import { BookCover, Card, PageHead, Tabs } from '../../ui/common.jsx';
import { BarChart, Progress, Ring } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { finishedIn, STATUS } from './data.js';

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

export default function BooksPage() {
  const [d, set] = useModule('books');
  const notify = useNotify();
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [note, setNote] = useState({ book: 'b9', text: '' });
  const [nb, setNb] = useState({ title: '', author: '', pages: '' });

  const year = TODAY.getFullYear();
  const done = finishedIn(d.books, year);
  const shown = TODAY.getMonth() + 1;
  const weeksLeft = Math.max(0, Math.ceil((new Date(year, 11, 31) - TODAY) / 6048e5));
  const reading = d.books.filter((x) => x.status === 'reading');
  const perMonth = MONTHS.map((_, i) => done.filter((x) => Number(x.finished.slice(5, 7)) === i + 1).length);
  const counts = { read: d.books.filter((x) => x.status === 'read').length, reading: reading.length, unread: d.books.filter((x) => x.status === 'unread').length };
  const p = pct(done.length, d.yearGoal);
  const shelf = d.books.filter((x) => (filter === 'all' || x.status === filter) && (`${x.title} ${x.author}`.toLowerCase().includes(q.toLowerCase())));

  const upd = (id, fn) => set((s) => ({ ...s, books: s.books.map((x) => (x.id === id ? fn(x) : x)) }));
  const bump = (id, n) => upd(id, (x) => {
    const read = Math.min(x.pages, Math.max(0, x.read + n));
    return read >= x.pages ? { ...x, read, status: 'read', finished: todayIso } : { ...x, read, status: read > 0 ? 'reading' : x.status };
  });

  return (
    <div className="fade-in">
      <PageHead title="Sách" subtitle="Đọc nhiều hơn, học nhiều hơn, lớn lên mỗi ngày." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Tổng quan' }, { id: 'shelf', label: 'Tủ sách' }, { id: 'goal', label: 'Mục tiêu năm' }, { id: 'notes', label: 'Ghi chú' }]} />

      {tab === 'overview' && (
        <div className="stack">
          <div className="grid g-main">
            <Card title={`Mục tiêu đọc ${year}`} icon="target" glow>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{done.length} <span className="muted" style={{ fontSize: 26 }}>/ {d.yearGoal}</span></div>
                  <div className="muted" style={{ marginTop: 4 }}>cuốn đã đọc</div>
                  <span className="chip mint" style={{ marginTop: 10 }}><Icon name="book" size={13} />Còn {Math.max(0, d.yearGoal - done.length)} cuốn · {weeksLeft} tuần</span>
                </div>
                <Ring value={p} size={130} thickness={13}><div className="num" style={{ fontSize: 28, fontWeight: 600 }}>{p}%</div></Ring>
              </div>
              <div style={{ marginTop: 16 }}>
                <BarChart labels={MONTHS.slice(0, shown)} series={[{ name: 'Sách', color: 'var(--lav)', values: perMonth.slice(0, shown) }]} height={150} />
              </div>
            </Card>
            <div className="stack">
              <Card title="Phân loại tủ sách" icon="layers">
                <div className="grid g3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
                  {[['read', 'var(--mint)'], ['reading', 'var(--lav)'], ['unread', 'var(--faint)']].map(([k, c]) => (
                    <div key={k}><div className="num" style={{ fontSize: 26, fontWeight: 600 }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, background: c, marginRight: 6, verticalAlign: 6 }} />{counts[k]}</div><div className="muted" style={{ fontSize: 12.5 }}>{STATUS[k].label}</div></div>
                  ))}
                </div>
                <div style={{ display: 'flex', height: 8, borderRadius: 9, overflow: 'hidden', marginTop: 12, gap: 2 }}>
                  <i style={{ flex: counts.read, background: 'var(--mint)' }} /><i style={{ flex: counts.reading, background: 'var(--lav)' }} /><i style={{ flex: counts.unread, background: 'var(--surface-3)' }} />
                </div>
              </Card>
              <Card title="Phút đọc 7 ngày" icon="clock">
                <BarChart labels={['T6', 'T7', 'CN', 'T2', 'T3', 'T4', 'T5']} series={[{ name: 'Phút', color: 'var(--mint)', values: d.sessions }]} height={130} highlight={6} />
              </Card>
            </div>
          </div>
          <Card title="Đang đọc" icon="book">
            <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
              {reading.map((x) => (
                <div key={x.id} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <BookCover book={x} width={70} />
                  <div className="row-main">
                    <div className="row-title">{x.title}</div><div className="row-sub">{x.author}</div>
                    <Progress value={pct(x.read, x.pages)} tone="lav" style={{ margin: '8px 0 6px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="row-sub num">Trang {x.read}/{x.pages} · {pct(x.read, x.pages)}%</span>
                      <button className="btn sm ghost" onClick={() => bump(x.id, 20)}>+20 trang</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'shelf' && (
        <div className="stack">
          <div className="form-row">
            <div className="field" style={{ flex: '2 1 220px' }}><label htmlFor="b-q">Tìm sách</label><input id="b-q" className="input" placeholder="Tên sách hoặc tác giả" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="tabs" style={{ margin: 0, flex: '1 1 260px' }}>{[['all', 'Tất cả'], ['reading', 'Đang đọc'], ['read', 'Đã đọc'], ['unread', 'Chưa đọc']].map(([k, l]) => <button key={k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
            {shelf.map((x) => (
              <section key={x.id} className="card" style={{ display: 'flex', gap: 12, padding: 12 }}>
                <BookCover book={x} width={62} />
                <div className="row-main">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <div className="row-title">{x.title}</div>
                    <button className="icon-btn" style={{ width: 30, height: 30, color: x.fav ? 'var(--mint)' : 'var(--muted)' }} aria-label="Yêu thích" onClick={() => upd(x.id, (y) => ({ ...y, fav: !y.fav }))}><Icon name="star" size={15} style={{ fill: x.fav ? 'currentColor' : 'none' }} /></button>
                  </div>
                  <div className="row-sub">{x.author} · {x.pages} trang</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className={`chip ${STATUS[x.status].chip}`}>{STATUS[x.status].label}{x.status === 'reading' ? ` (${pct(x.read, x.pages)}%)` : ''}</span>
                    {x.finished && <span className="chip">Xong {dmy(x.finished)}</span>}
                    {x.status === 'unread' && <button className="chip mint" style={{ border: 0 }} onClick={() => bump(x.id, 1)}>Bắt đầu đọc</button>}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <Card title="Thêm sách vào tủ" icon="plus">
            <div className="form-row">
              <div className="field" style={{ flex: '2 1 180px' }}><label htmlFor="nb-t">Tên sách</label><input id="nb-t" className="input" value={nb.title} onChange={(e) => setNb({ ...nb, title: e.target.value })} /></div>
              <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor="nb-a">Tác giả</label><input id="nb-a" className="input" value={nb.author} onChange={(e) => setNb({ ...nb, author: e.target.value })} /></div>
              <div className="field"><label htmlFor="nb-p">Số trang</label><input id="nb-p" className="input" inputMode="numeric" value={nb.pages} onChange={(e) => setNb({ ...nb, pages: e.target.value })} /></div>
              <button className="btn sm" style={{ height: 42 }} onClick={() => {
                if (!nb.title.trim()) return notify('Nhập tên sách');
                set((s) => ({ ...s, books: [{ id: uid(), title: nb.title.trim(), author: nb.author.trim() || 'Chưa rõ', status: 'unread', pages: Number(nb.pages) || 300, read: 0, colors: ['#24433b', '#d9fff1'], fav: false }, ...s.books] }));
                setNb({ title: '', author: '', pages: '' }); notify('Đã thêm vào tủ sách');
              }}><Icon name="plus" size={16} />Thêm</button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'goal' && (
        <div className="grid g-main">
          <Card title={`Mục tiêu năm ${year}`} icon="target" glow>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <Ring value={p} size={170} thickness={16} color="var(--mint)">
                <div><div className="num" style={{ fontSize: 34, fontWeight: 700 }}>{done.length}/{d.yearGoal}</div><div className="muted">cuốn</div></div>
              </Ring>
              <div style={{ display: 'grid', gap: 12 }}>
                <div><div className="num" style={{ fontSize: 30, fontWeight: 700 }}>{Math.max(0, d.yearGoal - done.length)}</div><div className="muted">cuốn còn lại</div></div>
                <div className="field"><label htmlFor="b-goal">Số sách mỗi năm</label>
                  <select id="b-goal" className="input" value={d.yearGoal} onChange={(e) => { set((s) => ({ ...s, yearGoal: Number(e.target.value) })); notify('Đã cập nhật mục tiêu'); }}>{[6, 8, 10, 12, 15, 18, 24, 30].map((n) => <option key={n} value={n}>{n} cuốn</option>)}</select></div>
              </div>
            </div>
          </Card>
          <Card title="Hoàn thành gần đây" icon="check">
            <div className="list">
              {[...done].sort((a, b) => b.finished.localeCompare(a.finished)).slice(0, 6).map((x) => (
                <div className="row" key={x.id}>
                  <BookCover book={x} width={38} />
                  <div className="row-main"><div className="row-title">{x.title}</div><div className="row-sub">{x.author}</div></div>
                  <span className="row-sub">{dmy(x.finished)}</span>
                  <span className="icon-tile" style={{ width: 24, height: 24, borderRadius: 99, background: 'var(--mint)', color: 'var(--on-accent)' }}><Icon name="check" size={14} stroke={2.6} /></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'notes' && (
        <div className="grid g-main">
          <div className="stack">
            {[...d.notes].sort((a, b) => b.date.localeCompare(a.date)).map((n) => {
              const bk = d.books.find((x) => x.id === n.book);
              return (
                <section key={n.id} className="card" style={{ display: 'flex', gap: 14 }}>
                  <Icon name="pen" size={20} className="mint" />
                  <div className="row-main">
                    <p style={{ fontStyle: 'italic', fontSize: 15 }}>“{n.text}”</p>
                    <div className="row-sub" style={{ marginTop: 6 }}>{bk?.title} · {dmy(n.date)}</div>
                  </div>
                </section>
              );
            })}
          </div>
          <Card title="Ghi chú mới" icon="pen">
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="field"><label htmlFor="n-book">Sách</label><select id="n-book" className="input" value={note.book} onChange={(e) => setNote({ ...note, book: e.target.value })}>{d.books.filter((x) => x.status !== 'unread').map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></div>
              <div className="field"><label htmlFor="n-text">Ý tưởng, trích dẫn</label><textarea id="n-text" className="input" rows={4} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} /></div>
              <button className="btn" onClick={() => { if (!note.text.trim()) return; set((s) => ({ ...s, notes: [{ id: uid(), book: note.book, text: note.text.trim(), date: todayIso }, ...s.notes] })); setNote({ ...note, text: '' }); notify('Đã lưu ghi chú'); }}><Icon name="plus" size={18} />Lưu ghi chú</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
