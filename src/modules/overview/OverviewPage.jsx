import { useStore } from '../../core/store.jsx';
import { collectAgenda, collectEvents } from '../../core/agenda.js';
import { daysFromToday, dm, dmy, dow, iso, num, parse, pct, TODAY, todayIso, vndShort, weekDays, weekStart } from '../../core/format.js';
import { go } from '../../core/router.js';
import { BookCover, Card, Cover, Delta, PageHead } from '../../ui/common.jsx';
import { BarChart, Donut, LineChart, Progress, Radar, Ring, Sparkline } from '../../ui/charts.jsx';
import Icon from '../../ui/Icon.jsx';
import { byCategory, fundSaved, monthlySeries, monthTx, totals } from '../finance/data.js';
import { onTrack as isOnTrack, progress } from '../goals/data.js';
import { finishedIn } from '../books/data.js';
import { status as docStatus } from '../documents/data.js';
import { weekCount } from '../habits/HabitsPage.jsx';
import { effectiveAll } from '../habits/link.js';
import { AgendaList } from '../today/TodayPage.jsx';
import { KINDS } from '../today/data.js';

const More = ({ to, label = 'Xem' }) => <button className="link" onClick={() => go(to)}>{label}<Icon name="chevR" size={14} /></button>;

export default function OverviewPage() {
  const { state, update } = useStore();
  const { health, finance, goals, books, travel, documents, journal, learning } = state;
  const habits = { ...state.habits, habits: effectiveAll(state.habits, state.health) };

  // Sức khỏe
  const hs = [...health.entries].sort((a, b) => a.date.localeCompare(b.date));
  const w = hs[hs.length - 1];
  const w30 = hs[Math.max(0, hs.length - 11)];
  const healthPct = Math.round(((hs[0].weight - w.weight) / (hs[0].weight - health.goalWeight)) * 100);
  // Tài chính
  const tx = monthTx(finance);
  const tot = totals(tx);
  const hist = monthlySeries(finance);
  const mNow = hist[hist.length - 1].m;
  const spent = byCategory(tx).filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const fundPct = pct(fundSaved(finance.fund), finance.fund.target);
  // Mục tiêu
  const active = goals.goals.filter((g) => progress(g) < 100);
  const onTrack = active.filter(isOnTrack);
  // Sách
  const read = finishedIn(books.books, TODAY.getFullYear()).length;
  const reading = books.books.filter((b) => b.status === 'reading');
  // Du lịch
  const nextTrip = travel.trips.filter((t) => t.start >= todayIso).sort((a, b) => a.start.localeCompare(b.start))[0];
  // Thói quen
  const ws = weekStart(TODAY);
  const habitRate = Math.round((habits.habits.reduce((s, h) => s + Math.min(1, weekCount(h, ws) / (h.target * 4 / 7)), 0) / habits.habits.length) * 100);
  // Nhật ký
  const moods = [...journal.entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const moodAvg = moods.reduce((s, e) => s + e.mood, 0) / moods.length;
  // Học tập
  const learnPct = Math.round(learning.courses.reduce((s, c) => s + c.done / c.total, 0) / learning.courses.length * 100);
  // Lịch
  const days = weekDays();
  const events = collectEvents(state);
  const agenda = collectAgenda(state, todayIso);
  const docsSoon = documents.docs.filter((d) => docStatus(d).tone !== 'mint' && !d.handled).sort((a, b) => a.expires.localeCompare(b.expires));

  const balance = [
    { label: 'Sức khỏe', value: Math.min(100, healthPct) },
    { label: 'Tài chính', value: fundPct },
    { label: 'Mục tiêu', value: Math.round(active.reduce((s, g) => s + progress(g), 0) / (active.length || 1)) },
    { label: 'Đọc sách', value: pct(read, books.yearGoal) },
    { label: 'Học tập', value: learnPct },
    { label: 'Thói quen', value: Math.min(100, habitRate) },
    { label: 'Tinh thần', value: Math.round(moodAvg * 20) },
  ];

  return (
    <div className="fade-in">
      <PageHead title="Tổng quan" subtitle="Cuộc sống, mục tiêu, tài chính và kế hoạch của bạn ở một nơi.">
        <span className="select"><Icon name="cal" size={16} />Tuần {dm(days[0])} – {dmy(days[6])}</span>
      </PageHead>

      <div className="grid g4">
        <section className="card" onClick={() => go('health')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="icon-tile"><Icon name="heart" size={19} /></span><Sparkline values={hs.slice(-10).map((e) => e.weight)} /></div>
          <div className="stat-value" style={{ marginTop: 10 }}>{num(w.weight)}<small>kg</small></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="stat-label">Cân nặng</span><Delta value={+(w.weight - w30.weight).toFixed(1)} unit=" kg" /></div>
        </section>
        <section className="card" onClick={() => go('finance')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="icon-tile"><Icon name="wallet" size={19} /></span><Sparkline bars values={hist.map((h) => h.income - h.expense)} width={90} /></div>
          <div className="stat-value" style={{ marginTop: 10 }}>{vndShort(tot.net)}<small>₫</small></div>
          <div className="stat-label">Dòng tiền ròng {mNow}</div>
        </section>
        <section className="card" onClick={() => go('goals')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div><span className="icon-tile"><Icon name="target" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{onTrack.length}/{active.length}</div><div className="stat-label">Mục tiêu đúng tiến độ</div></div>
          <Ring value={pct(onTrack.length, active.length)} size={76} thickness={9} />
        </section>
        <section className="card" onClick={() => go('books')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div><span className="icon-tile lav"><Icon name="book" size={19} /></span><div className="stat-value" style={{ marginTop: 10 }}>{read}/{books.yearGoal}</div><div className="stat-label">Sách đã đọc {TODAY.getFullYear()}</div></div>
          <Ring value={pct(read, books.yearGoal)} size={76} thickness={9} color="var(--lav)" />
        </section>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <Card title="Lịch tuần này" icon="cal" glow action={<More to="today" label="Mở lịch" />}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(112px, 1fr))', gap: 8, minWidth: 820 }}>
              {days.map((x) => {
                const k = iso(x); const isT = k === todayIso;
                const evs = events.filter((e) => e.date === k).sort((a, b) => (a.time || '00').localeCompare(b.time || '00'));
                return (
                  <div key={k} style={{ borderRadius: 14, padding: 8, minHeight: 132, background: isT ? 'var(--mint-soft)' : 'var(--surface)', border: `1px solid ${isT ? 'var(--mint-border)' : 'var(--line)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, color: isT ? 'var(--mint)' : 'var(--muted)', fontWeight: 600 }}>{dow(x)}</span>
                      <span className="num" style={{ fontSize: 18, fontWeight: 700, color: isT ? 'var(--mint)' : 'var(--text)' }}>{x.getDate()}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {evs.slice(0, 4).map((e, i) => (
                        <div key={i} title={e.title} style={{ fontSize: 11.5, lineHeight: 1.3, padding: '5px 7px', borderRadius: 8, background: 'var(--track)', borderLeft: `2px solid ${e.own ? (KINDS[e.kind]?.color || 'var(--mint)') : 'var(--lav)'}`, minWidth: 0 }}>
                          <div className="num faint" style={{ fontSize: 10.5 }}>{e.time || (e.done ? 'Đã xong' : 'Cả ngày')}</div>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                        </div>
                      ))}
                      {evs.length > 4 && <span className="faint" style={{ fontSize: 10.5 }}>+{evs.length - 4} mục</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Dòng tiền" icon="chart" action={<More to="finance" />}>
          <BarChart labels={hist.map((h) => h.m)} series={[{ name: 'Thu', color: 'var(--mint)', values: hist.map((h) => h.income) }, { name: 'Chi', color: 'var(--lav)', values: hist.map((h) => h.expense) }]} format={(v) => (v ? `${v / 1e6}tr` : '0')} height={210} />
          <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--mint)' }} />Thu nhập {mNow} <b className="num" style={{ color: 'var(--text)', marginLeft: 4 }}>{vndShort(tot.income)}</b></span><span><i style={{ background: 'var(--lav)' }} />Chi tiêu {mNow} <b className="num" style={{ color: 'var(--text)', marginLeft: 4 }}>{vndShort(tot.expense)}</b></span></div>
        </Card>
        <Card title="Việc hôm nay" icon="today" action={<More to="today" />}>
          <AgendaList compact items={agenda.filter((i) => !i.done).slice(0, 6)} onToggle={(it) => update(it.module, it.toggle)} />
          <div className="row-sub" style={{ marginTop: 8 }}>{agenda.filter((i) => i.done).length}/{agenda.length} việc đã xong hôm nay</div>
        </Card>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        <Card title="Cân bằng cuộc sống" icon="sparkle">
          <Radar axes={balance} />
          <div className="row-sub" style={{ textAlign: 'center' }}>Điểm 0–100 tính từ tiến độ của từng module</div>
        </Card>
        <Card title="Mục tiêu nổi bật" icon="target" action={<More to="goals" />}>
          <div style={{ display: 'grid', gap: 14 }}>
            {active.slice(0, 4).map((g) => (
              <div key={g.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}><span style={{ fontWeight: 500 }}>{g.title}</span><b className="num">{progress(g)}%</b></div>
                <div className="row-sub" style={{ marginBottom: 6 }}>Còn {daysFromToday(g.deadline)} ngày</div>
                <Progress value={progress(g)} tone={g.cat === 'books' || g.cat === 'learning' ? 'lav' : ''} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Chi tiêu theo mục" icon="pie" action={<More to="finance" />}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <Donut segments={spent.map((c) => ({ value: c.spent, color: c.color }))} size={150} thickness={18}>
              <div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{vndShort(tot.expense)}</div><div className="muted" style={{ fontSize: 11 }}>đã chi {mNow}</div></div>
            </Donut>
            <div className="legend" style={{ justifyContent: 'center' }}>{spent.slice(0, 5).map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.label} {pct(c.spent, tot.expense)}%</span>)}</div>
          </div>
        </Card>
      </div>

      <div className="grid g-main" style={{ marginTop: 14 }}>
        <Card title="Xu hướng cân nặng" icon="trend" action={<More to="health" />}>
          <LineChart data={hs.slice(-11).map((e) => ({ label: dm(e.date), value: e.weight }))} goal={health.goalWeight} format={(v) => `${num(v)}kg`} yFormat={(v) => num(v)} height={230} />
        </Card>
        {nextTrip && (
          <div role="button" tabIndex={0} onClick={() => go('travel')} onKeyDown={(e) => e.key === 'Enter' && go('travel')} style={{ cursor: 'pointer', minHeight: 240 }}>
            <Cover photo={nextTrip.photo} kind={nextTrip.scene} sky={nextTrip.sky} height="100%" radius={22}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
                <span className="chip mint" style={{ alignSelf: 'flex-start' }}><Icon name="plane" size={13} />Chuyến đi sắp tới</span>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{nextTrip.name}</div>
                  <div style={{ color: '#dfeee9', fontSize: 13 }}>{dm(nextTrip.start)} – {dmy(nextTrip.end)} · còn <b className="num">{daysFromToday(nextTrip.start)}</b> ngày</div>
                </div>
              </div>
            </Cover>
          </div>
        )}
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        <Card title="Đang đọc" icon="book" action={<More to="books" />}>
          <div style={{ display: 'grid', gap: 12 }}>
            {reading.slice(0, 2).map((b) => (
              <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <BookCover book={b} width={44} />
                <div className="row-main"><div className="row-title" style={{ fontSize: 13 }}>{b.title}</div><Progress value={pct(b.read, b.pages)} tone="lav" style={{ marginTop: 6, height: 5 }} /><div className="row-sub num">{pct(b.read, b.pages)}%</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Thói quen tuần này" icon="repeat" action={<More to="habits" />}>
          <div style={{ display: 'grid', gap: 9 }}>
            {habits.habits.slice(0, 5).map((h) => { const c = weekCount(h, ws); return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={h.icon} size={15} className="mint" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                <span style={{ display: 'flex', gap: 2 }}>{days.map((x) => <i key={+x} style={{ width: 7, height: 14, borderRadius: 3, background: h.log[iso(x)] ? 'var(--mint)' : iso(x) > todayIso ? 'transparent' : 'var(--track)', border: iso(x) > todayIso ? '1px dashed var(--line-strong)' : 0 }} />)}</span>
                <b className="num" style={{ fontSize: 12, width: 26, textAlign: 'right' }}>{c}/{h.target}</b>
              </div>); })}
          </div>
        </Card>
        <Card title="Sắp hết hạn" icon="file" action={<More to="documents" />}>
          <div className="list">
            {docsSoon.slice(0, 4).map((d) => { const s = docStatus(d); return (
              <div className="row" key={d.id} style={{ padding: '8px 0' }}>
                <div className="row-main"><div className="row-title" style={{ fontSize: 13 }}>{d.name}</div><div className="row-sub">{dmy(d.expires)}</div></div>
                <span className={`chip ${s.tone}`}>{s.label}</span>
              </div>); })}
          </div>
        </Card>
      </div>
    </div>
  );
}
