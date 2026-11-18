// Lớp tóm tắt dữ liệu chung cho Daily Briefing và Life Score.
// Chỉ đọc state của các module, không ghi. Mỗi lĩnh vực chỉ được chấm khi có dữ liệu thật.
import { addDays, daysFromToday, iso, num, parse, pct, TODAY, todayIso, vndShort, weekStart, ym } from './format.js';
import { collectAgenda } from './agenda.js';
import { byCategory, fundSaved, monthTx, totals } from '../modules/finance/data.js';
import { onTrack, progress } from '../modules/goals/data.js';
import { finishedIn } from '../modules/books/data.js';
import { status as docStatus } from '../modules/documents/data.js';
import { bpClass } from '../modules/health/data.js';
import { effectiveAll } from '../modules/habits/link.js';
import { playedIds, settle } from '../modules/health/pickleball.js';

export const DOMAINS = [
  { id: 'health', label: 'Sức khỏe', icon: 'heart', to: 'health' },
  { id: 'finance', label: 'Tài chính', icon: 'wallet', to: 'finance' },
  { id: 'habits', label: 'Thói quen', icon: 'repeat', to: 'habits' },
  { id: 'goals', label: 'Mục tiêu', icon: 'target', to: 'goals' },
  { id: 'growth', label: 'Học tập & Đọc sách', icon: 'book', to: 'books' },
  { id: 'travel', label: 'Du lịch', icon: 'plane', to: 'travel' },
];
export const DEFAULT_WEIGHT = 2; // 0 = không tính, 1 = ít, 2 = bình thường, 3 = quan trọng

const days = (n) => Array.from({ length: n }, (_, i) => iso(addDays(TODAY, -i))); // hôm nay và n-1 ngày trước
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const r = (x) => Math.round(Math.max(0, Math.min(100, x)));
const part = (label, score, detail) => ({ label, score: r(score), detail });

/* ---------- Các tín hiệu dùng chung ---------- */
export function activeDays(state, n = 7) {
  const set = new Set(days(n));
  const hit = new Set();
  (state.health?.workouts || []).forEach((w) => { if (w.source !== 'sample' && set.has(w.date)) hit.add(w.date); });
  const pb = state.health?.pickleball;
  pb?.sessions?.forEach((s) => { if (s.status !== 'cancelled' && set.has(s.date) && playedIds(s).includes(pb.me)) hit.add(s.date); });
  return hit;
}
const kmWeek = (state) => {
  const ws = iso(weekStart(TODAY));
  return (state.health?.workouts || []).filter((w) => w.source !== 'sample' && w.date >= ws && w.date <= todayIso && (w.type === 'run' || w.type === 'walk')).reduce((s, w) => s + (w.km || 0), 0);
};
const lastWorkout = (state) => (state.health?.workouts || []).filter((w) => w.source !== 'sample' && w.date <= todayIso).map((w) => w.date).sort().at(-1);

/* ---------- Chấm điểm từng lĩnh vực ---------- */
function scoreHealth(state) {
  const h = state.health;
  if (!h) return null;
  const parts = [];
  const act = activeDays(state, 7).size;
  const anyReal = (h.workouts || []).some((w) => w.source !== 'sample') || h.pickleball?.sessions?.some((s) => s.locked);
  if (anyReal) parts.push(part('Vận động 7 ngày', (act / 4) * 100, `${act}/4 ngày có tập`));
  const es = [...(h.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (es.length >= 2 && h.goalWeight) {
    const last = es.at(-1);
    const ref = es.filter((e) => e.date <= iso(addDays(parse(last.date), -21))).at(-1) || es[0];
    const gap = last.weight - h.goalWeight;
    const moved = ref.weight - last.weight; // dương = giảm cân
    const toward = gap > 0 ? moved : -moved;
    const s = Math.abs(gap) <= 0.5 ? 100 : toward > 0.3 ? 85 : toward > -0.3 ? 60 : 35;
    parts.push(part('Cân nặng', s, `${num(last.weight)} kg, mục tiêu ${num(h.goalWeight)} kg`));
  }
  const bp = [...(h.bp || [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).at(-1);
  if (bp && daysFromToday(bp.date) >= -30) {
    const c = bpClass(bp.sys, bp.dia);
    parts.push(part('Huyết áp', c.tone === 'good' ? 100 : c.tone === 'amber' ? 65 : 30, `${bp.sys}/${bp.dia} · ${c.label}`));
  }
  return parts;
}

function scoreFinance(state) {
  const f = state.finance;
  if (!f?.transactions?.length) return null;
  const tx = monthTx(f);
  const parts = [];
  const t = totals(tx);
  if (t.income > 0) {
    const rate = t.net / t.income;
    parts.push(part('Tỷ lệ tiết kiệm tháng', (rate / 0.25) * 100, `${Math.round(rate * 100)}% thu nhập (mục tiêu 25%)`));
  }
  const day = TODAY.getDate();
  const dim = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  const cats = byCategory(tx).filter((c) => c.budget);
  if (tx.some((x) => x.type === 'out')) {
    const over = cats.filter((c) => c.spent > c.budget);
    const pace = cats.filter((c) => c.spent <= c.budget && c.spent > c.budget * (day / dim) * 1.25);
    parts.push(part('Ngân sách', 100 - over.length * 25 - pace.length * 8, over.length ? `Vượt: ${over.map((c) => c.label).join(', ')}` : pace.length ? `Chi nhanh: ${pace.map((c) => c.label).join(', ')}` : 'Trong ngân sách'));
  }
  const bills = (f.bills || []).filter((b) => !b.paid);
  const late = bills.filter((b) => b.due < todayIso);
  if ((f.bills || []).length) parts.push(part('Hóa đơn', 100 - late.length * 30, late.length ? `${late.length} hóa đơn quá hạn` : 'Không có hóa đơn quá hạn'));
  if (f.fund?.target) parts.push(part('Quỹ dự phòng', pct(fundSaved(f.fund), f.fund.target), `${pct(fundSaved(f.fund), f.fund.target)}% mục tiêu`));
  return parts;
}

function scoreHabits(state) {
  const list = effectiveAll(state.habits, state.health);
  if (!list.length) return null;
  const last7 = days(7);
  const rates = list.map((h) => Math.min(1, last7.filter((d) => h.log?.[d]).length / (h.target || 7)));
  const done = list.filter((h) => h.log?.[todayIso]).length;
  return [part('7 ngày gần nhất', avg(rates) * 100, `${Math.round(avg(rates) * 100)}% chỉ tiêu tuần`), part('Hôm nay', (done / list.length) * 100, `${done}/${list.length} thói quen`)];
}

function scoreGoals(state) {
  const goals = (state.goals?.goals || []).filter((g) => progress(g) < 100 && g.deadline >= todayIso);
  if (!goals.length) return null;
  const ok = goals.filter(onTrack).length;
  const late = goals.flatMap((g) => g.milestones.filter((m) => !m.done && m.due < todayIso));
  return [part('Đúng tiến độ', (ok / goals.length) * 100, `${ok}/${goals.length} mục tiêu`), part('Cột mốc trễ', 100 - late.length * 20, late.length ? `${late.length} cột mốc trễ hạn` : 'Không trễ cột mốc')];
}

function scoreGrowth(state) {
  const parts = [];
  const b = state.books;
  if (b?.books?.length && b.yearGoal) {
    const read = finishedIn(b.books, TODAY.getFullYear()).length;
    const doy = (TODAY - new Date(TODAY.getFullYear(), 0, 1)) / 864e5 + 1;
    const expected = b.yearGoal * (doy / 365);
    parts.push(part('Đọc sách', (read / Math.max(1, expected)) * 100, `${read}/${b.yearGoal} cuốn, kỳ vọng ${num(expected, 0)} lúc này`));
  }
  const l = state.learning;
  if (l?.weekly?.length && l.weeklyTarget) {
    const recent = l.weekly.slice(-2);
    const hrs = avg(recent.map((w) => w.hours));
    parts.push(part('Giờ học', (hrs / l.weeklyTarget) * 100, `${num(hrs)}/${l.weeklyTarget} giờ mỗi tuần`));
  }
  return parts.length ? parts : null;
}

export function nextTrip(state) {
  return (state.travel?.trips || []).filter((t) => t.end >= todayIso).sort((a, b) => a.start.localeCompare(b.start))[0];
}
function scoreTravel(state) {
  const t = nextTrip(state);
  if (!t || daysFromToday(t.start) > 30) return null; // chỉ chấm khi sắp có chuyến đi
  const pk = t.packing || [];
  const parts = [];
  if (pk.length) parts.push(part('Hành lý', pct(pk.filter((p) => p.done).length, pk.length), `${pk.filter((p) => p.done).length}/${pk.length} món đã chuẩn bị`));
  parts.push(part('Lịch trình', t.itinerary?.length ? 100 : 30, t.itinerary?.length ? `${t.itinerary.length} ngày đã lên lịch` : 'Chưa có lịch trình'));
  const cost = (t.costs || []).reduce((s, c) => s + (c.plan || 0), 0);
  if (cost) parts.push(part('Ngân sách chuyến đi', 100, `Dự trù ${vndShort(cost)}`));
  return parts;
}

const SCORERS = { health: scoreHealth, finance: scoreFinance, habits: scoreHabits, goals: scoreGoals, growth: scoreGrowth, travel: scoreTravel };
const TIPS = {
  health: 'Dành 30 phút vận động hôm nay, chạy bộ hoặc đi bộ đều được.',
  finance: 'Xem lại các khoản chi lớn tuần này và hóa đơn sắp đến hạn.',
  habits: 'Tích ít nhất một thói quen trước buổi trưa để giữ chuỗi.',
  goals: 'Chọn một cột mốc đang trễ và làm bước nhỏ nhất ngay hôm nay.',
  growth: 'Đọc 20 phút hoặc học một bài ngắn trước khi ngủ.',
  travel: 'Chuẩn bị nốt các món hành lý còn thiếu cho chuyến đi.',
};

export function lifeScore(state, weights = {}) {
  const domains = DOMAINS.map((d) => {
    const parts = SCORERS[d.id](state);
    if (!parts?.length) return { ...d, score: null, parts: [], weight: 0 };
    const score = r(avg(parts.map((p) => p.score)));
    const weight = weights[d.id] ?? DEFAULT_WEIGHT;
    return { ...d, score, parts, weight, tip: TIPS[d.id] };
  });
  const counted = domains.filter((d) => d.score != null && d.weight > 0);
  const wsum = counted.reduce((s, d) => s + d.weight, 0);
  const total = wsum ? r(counted.reduce((s, d) => s + d.score * d.weight, 0) / wsum) : null;
  const weakest = [...counted].sort((a, b) => a.score - b.score)[0] || null;
  const strongest = [...counted].sort((a, b) => b.score - a.score)[0] || null;
  return { total, domains, weakest, strongest };
}
export const scoreTone = (s) => (s == null ? '' : s >= 80 ? 'good' : s >= 60 ? 'mint' : s >= 40 ? 'amber' : 'rose');
export const scoreWord = (s) => (s == null ? 'Chưa đủ dữ liệu' : s >= 85 ? 'Rất tốt' : s >= 70 ? 'Tốt' : s >= 55 ? 'Ổn' : s >= 40 ? 'Cần chú ý' : 'Cần cải thiện');

// Ảnh chụp điểm mỗi ngày: { 'yyyy-mm-dd': { t: tổng, d: { health: 80, ... } } }, giữ tối đa 400 ngày.
export function snapshotOf(ls) {
  return { t: ls.total, d: Object.fromEntries(ls.domains.filter((d) => d.score != null).map((d) => [d.id, d.score])) };
}
export function withSnapshot(snaps = {}, ls) {
  if (ls.total == null) return snaps;
  const s = snapshotOf(ls);
  const cur = snaps[todayIso];
  if (cur && cur.t === s.t && JSON.stringify(cur.d) === JSON.stringify(s.d)) return snaps;
  const keys = Object.keys(snaps).sort();
  const keep = keys.slice(-399);
  return { ...Object.fromEntries(keep.map((k) => [k, snaps[k]])), [todayIso]: s };
}
export function trend(snaps = {}, n = 30) {
  return Array.from({ length: n }, (_, i) => { const k = iso(addDays(TODAY, -(n - 1 - i))); return { date: k, value: snaps[k]?.t ?? null }; });
}
export function deltaSince(snaps = {}, total, back = 7) {
  const keys = Object.keys(snaps).filter((k) => k <= iso(addDays(TODAY, -back))).sort();
  const ref = keys.length ? snaps[keys.at(-1)].t : null;
  return ref == null || total == null ? null : total - ref;
}

/* ---------- Dữ kiện cho Daily Briefing ---------- */
// Mỗi dữ kiện: { icon, text, tone, to, w } (w = độ ưu tiên, lớn hơn = quan trọng hơn).
export function briefingFacts(state, ls) {
  const out = [];
  const add = (w, icon, text, to, tone = '') => out.push({ w, icon, text, to, tone });

  // Lịch & việc
  const appts = (state.today?.appointments || []).filter((a) => a.date === todayIso).sort((a, b) => a.time.localeCompare(b.time));
  if (appts.length) add(90, 'cal', `Hôm nay có ${appts.length} lịch hẹn, đầu tiên lúc ${appts[0].time}: ${appts[0].title}${appts[0].place ? ` (${appts[0].place})` : ''}.`, 'today');
  const tasks = state.today?.tasks || [];
  const overdue = tasks.filter((t) => !t.done && t.date < todayIso);
  const high = tasks.filter((t) => !t.done && t.date === todayIso && t.priority === 'high');
  if (high.length) add(85, 'flag', `Việc ưu tiên: ${high.map((t) => t.title).slice(0, 2).join('; ')}.`, 'today', 'amber');
  if (overdue.length) add(80, 'clock', `${overdue.length} việc quá hạn, cũ nhất: ${overdue.sort((a, b) => a.date.localeCompare(b.date))[0].title}.`, 'today', 'rose');

  // Hóa đơn
  const bills = (state.finance?.bills || []).filter((b) => !b.paid && daysFromToday(b.due) <= 3);
  bills.sort((a, b) => a.due.localeCompare(b.due));
  if (bills.length) {
    const b = bills[0]; const n = daysFromToday(b.due);
    add(n < 0 ? 88 : 75, 'wallet', `${b.name} ${vndShort(b.amount)} ${n < 0 ? `đã quá hạn ${-n} ngày` : n === 0 ? 'đến hạn hôm nay' : `đến hạn sau ${n} ngày`}${bills.length > 1 ? `, cùng ${bills.length - 1} hóa đơn khác` : ''}.`, 'finance', n < 0 ? 'rose' : 'amber');
  }
  // Ngân sách
  const tx = state.finance ? monthTx(state.finance) : [];
  const over = byCategory(tx).filter((c) => c.budget && c.spent > c.budget);
  if (over.length) add(55, 'wallet', `Đã vượt ngân sách ${over.map((c) => `${c.label} (${vndShort(c.spent)}/${vndShort(c.budget)})`).join(', ')} trong ${`tháng ${Number(ym().slice(5))}`}.`, 'finance', 'amber');

  // Pickleball
  const pb = state.health?.pickleball;
  if (pb) {
    const next = (pb.sessions || []).filter((s) => s.status !== 'cancelled' && s.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next && daysFromToday(next.date) <= 1) add(70, 'paddle', `Pickleball ${daysFromToday(next.date) === 0 ? 'hôm nay' : 'ngày mai'} ${next.start}–${next.end}${next.court ? ` ở ${next.court}` : ''}, ${next.confirmed?.length || 0} người đã xác nhận.`, 'health?tab=pickleball');
    const owe = (pb.sessions || []).filter((s) => s.locked && s.status !== 'cancelled').map((s) => settle(pb, s)).filter((st) => st.collector === pb.me && st.outstanding > 0);
    const sum = owe.reduce((t, st) => t + st.outstanding, 0);
    if (sum) add(50, 'coins', `Còn ${vndShort(sum)} tiền Pickleball chưa thu từ ${owe.length} buổi.`, 'health?tab=pickleball');
  }

  // Vận động
  const last = lastWorkout(state);
  const km = kmWeek(state);
  if (last) {
    const gap = -daysFromToday(last);
    if (gap >= 3) add(60, 'dumbbell', `Đã ${gap} ngày chưa có buổi tập nào.`, 'health?tab=training', 'amber');
    else if (km > 0) add(35, 'dumbbell', `Tuần này đã chạy và đi bộ ${num(km)} km.`, 'health?tab=training', 'good');
  }

  // Thói quen
  const habits = effectiveAll(state.habits, state.health);
  if (habits.length) {
    const left = habits.filter((h) => !h.log?.[todayIso]);
    const streakOf = (h) => { let n = 0; let d = addDays(TODAY, -1); while (h.log?.[iso(d)]) { n++; d = addDays(d, -1); } return n; };
    const atRisk = left.map((h) => ({ h, n: streakOf(h) })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n)[0];
    if (atRisk) add(58, 'repeat', `Giữ chuỗi ${atRisk.n} ngày "${atRisk.h.name}": hôm nay chưa tích.`, 'habits');
    else if (left.length) add(40, 'repeat', `Còn ${left.length}/${habits.length} thói quen chưa tích hôm nay.`, 'habits');
  }

  // Mục tiêu
  const ms = (state.goals?.goals || []).flatMap((g) => g.milestones.filter((m) => !m.done).map((m) => ({ g, m })));
  const soon = ms.filter((x) => daysFromToday(x.m.due) >= 0 && daysFromToday(x.m.due) <= 7).sort((a, b) => a.m.due.localeCompare(b.m.due))[0];
  const late = ms.filter((x) => x.m.due < todayIso);
  if (soon) add(62, 'target', `Cột mốc "${soon.m.title}" của mục tiêu ${soon.g.title} ${daysFromToday(soon.m.due) === 0 ? 'đến hạn hôm nay' : `còn ${daysFromToday(soon.m.due)} ngày`}.`, 'goals');
  if (late.length) add(52, 'target', `${late.length} cột mốc mục tiêu đang trễ hạn.`, 'goals', 'amber');

  // Du lịch
  const t = nextTrip(state);
  if (t) {
    const n = daysFromToday(t.start);
    const pk = t.packing || [];
    const miss = pk.filter((p) => !p.done).length;
    if (n <= 0) add(82, 'plane', `Đang trong chuyến ${t.name}, chúc bạn đi vui.`, 'travel');
    else if (n <= 14) add(n <= 3 ? 78 : 48, 'plane', `Còn ${n} ngày nữa đi ${t.name}${miss ? `, ${miss} món hành lý chưa chuẩn bị` : ''}.`, 'travel');
  }

  // Giấy tờ
  const docs = (state.documents?.docs || []).filter((d) => !d.handled).map((d) => ({ d, s: docStatus(d) })).filter((x) => x.s.n <= 7);
  if (docs.length) { const x = docs.sort((a, b) => a.s.n - b.s.n)[0]; add(x.s.n < 0 ? 72 : 57, 'file', `${x.d.name} ${x.s.n < 0 ? `đã hết hạn ${-x.s.n} ngày` : x.s.n === 0 ? 'hết hạn hôm nay' : `còn ${x.s.n} ngày hết hạn`}.`, 'documents', x.s.n < 0 ? 'rose' : 'amber'); }

  // Ý tưởng
  const inbox = (state.ideas?.ideas || []).filter((x) => x.categoryId === 'inbox' && !x.done).length;
  if (inbox >= 3) add(30, 'bulb', `${inbox} ý tưởng đang chờ phân loại.`, 'ideas');

  // Việc từ các module khác (thuốc, nhắc nhở…) chưa xong hôm nay
  const agenda = collectAgenda(state, todayIso).filter((a) => !a.done && !['today', 'habits', 'goals', 'finance', 'documents'].includes(a.module));
  if (agenda.length) add(45, 'check', `${agenda.length} việc khác cần làm hôm nay: ${agenda.slice(0, 2).map((a) => a.title).join('; ')}.`, 'today');

  return out.sort((a, b) => b.w - a.w);
}

// Bản tin dựng bằng luật (không cần AI): câu chào + 3 đến 5 dữ kiện quan trọng nhất + một gợi ý.
export function ruleBriefing(state, ls) {
  const facts = briefingFacts(state, ls);
  const h = new Date().getHours();
  const greet = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const focus = ls.weakest ? { text: ls.weakest.tip, to: ls.weakest.to, label: ls.weakest.label } : null;
  return { greet, items: facts.slice(0, 5), more: Math.max(0, facts.length - 5), focus, facts };
}

// Văn bản tóm tắt gửi lên AI: chỉ các câu dữ kiện, không gửi dữ liệu gốc.
export function aiPayload(state, ls, b) {
  const scoreLine = ls.total == null ? '' : `${ls.total}/100 (${ls.domains.filter((d) => d.score != null).map((d) => `${d.label} ${d.score}`).join(', ')})`;
  const facts = b.facts.slice(0, 10).map((f) => f.text);
  if (b.focus) facts.push(`Lĩnh vực thấp điểm nhất: ${b.focus.label}. Gợi ý: ${b.focus.text}`);
  const d = TODAY;
  const hh = new Date().getHours();
  const part = hh < 11 ? 'buổi sáng' : hh < 14 ? 'buổi trưa' : hh < 18 ? 'buổi chiều' : 'buổi tối';
  return { date: `${part}, ${['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, score: scoreLine, facts };
}
