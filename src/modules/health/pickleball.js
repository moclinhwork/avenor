// Pickleball: nhóm chơi hằng tuần, điểm danh, chi phí và chia tiền.
// Tiền tính bằng VND (số nguyên). Một buổi = một "session".
import { addDays, iso, parse, TODAY, todayIso, uid, vnd } from '../../core/format.js';

export const KINDS = {
  deposit: { label: 'Deposit', court: true },
  court: { label: 'Court balance', court: true },
  water: { label: 'Water', court: false },
  other: { label: 'Other', court: false },
};
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (s) => { const d = parse(s); return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MON[d.getMonth()]} ${d.getDate()}`; };
export const monthName = (m) => MON[m];
export const money = vnd;
export const toMoney = (v) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;

/* ---------- Dữ liệu ban đầu ---------- */
function lastWeekday(wd) {
  let d = addDays(TODAY, -1);
  while (d.getDay() !== wd) d = addDays(d, -1);
  return iso(d);
}

export function pbSeed() {
  const members = [
    { id: 'm-phuong', name: 'Phương', organizer: true },
    { id: 'm-bao', name: 'Bảo' },
    { id: 'm-toi', name: 'Tới' },
    { id: 'm-trung', name: 'Anh Trung' },
    { id: 'm-quang', name: 'Anh Quang' },
  ];
  const played = ['m-phuong', 'm-bao', 'm-toi', 'm-trung'];
  // Ví dụ kiểm tra: sân 600.000 (cọc 200.000 + trả tại sân 400.000), nước 100.000, Phương ứng hết.
  const example = {
    id: uid(), date: lastWeekday(6), start: '18:00', end: '20:00', court: '', status: 'scheduled', custom: true, example: true,
    confirmed: played, played, guests: [], locked: true, courtPrice: 600000,
    expenses: [
      { id: uid(), kind: 'deposit', amount: 200000, paidBy: 'm-phuong' },
      { id: uid(), kind: 'court', amount: 400000, paidBy: 'm-phuong' },
      { id: uid(), kind: 'water', amount: 100000, paidBy: 'm-phuong' },
    ],
    received: {},
  };
  return { me: 'm-phuong', members, schedule: { active: true, weekday: 6, start: '18:00', end: '20:00', court: '', price: 600000 }, sessions: [example] };
}

/* ---------- Lịch lặp hằng tuần ---------- */
export function nextDate(weekday, from = TODAY) {
  let d = new Date(from);
  while (d.getDay() !== weekday) d = addDays(d, 1);
  return iso(d);
}

export function newSession(pb, date, extra = {}) {
  const sc = pb.schedule;
  return {
    id: uid(), date, start: sc.start, end: sc.end, court: sc.court, status: 'scheduled', custom: false,
    confirmed: [], played: null, guests: [], locked: false, courtPrice: sc.price || 0, expenses: [], received: {}, ...extra,
  };
}

// Bảo đảm luôn có buổi sắp tới theo lịch lặp; buổi chưa sửa riêng thì theo lịch mới nhất.
export function ensureUpcoming(pb) {
  const sc = pb.schedule;
  let sessions = pb.sessions.filter((s) => !(s.date >= todayIso && !s.custom && !s.locked && !s.confirmed.length && !s.expenses.length && s.status === 'scheduled' && (!sc.active || parse(s.date).getDay() !== sc.weekday)));
  if (sc.active) {
    // Tìm tuần gần nhất còn buổi chơi được: bỏ qua buổi đã hủy hoặc đã xóa.
    const skipped = pb.skipped || [];
    let d = parse(nextDate(sc.weekday));
    for (let i = 0; i < 8; i++, d = addDays(d, 7)) {
      const date = iso(d);
      const found = sessions.find((s) => s.date === date);
      if (found ? found.status !== 'cancelled' : !skipped.includes(date)) {
        if (!found) sessions = [...sessions, newSession(pb, date)];
        break;
      }
    }
    sessions = sessions.map((s) => (s.date >= todayIso && !s.custom && !s.locked && s.status === 'scheduled' && (s.start !== sc.start || s.end !== sc.end || s.court !== sc.court)
      ? { ...s, start: sc.start, end: sc.end, court: sc.court } : s));
  }
  return sessions.length === pb.sessions.length && sessions.every((s, i) => s === pb.sessions[i]) ? pb : { ...pb, sessions };
}

/* ---------- Người tham gia ---------- */
export const memberName = (pb, id) => pb.members.find((m) => m.id === id)?.name || 'Former member';
export const organizer = (pb) => pb.members.find((m) => m.organizer && !m.archived) || pb.members[0];
export const playedIds = (s) => s.played ?? s.confirmed;

export function participants(pb, s) {
  const ids = playedIds(s);
  const people = pb.members.filter((m) => ids.includes(m.id)).map((m) => ({ id: m.id, name: m.name }));
  // Thành viên đã rời nhóm nhưng có trong buổi cũ vẫn được giữ.
  ids.filter((id) => !people.some((p) => p.id === id) && !s.guests.some((g) => g.id === id)).forEach((id) => people.push({ id, name: memberName(pb, id) }));
  s.guests.filter((g) => ids.includes(g.id)).forEach((g) => people.push({ id: g.id, name: g.name, guest: true }));
  return people;
}
const personName = (pb, s, id) => s.guests.find((g) => g.id === id)?.name || memberName(pb, id);

/* ---------- Chi phí ---------- */
export function costs(s) {
  const sum = (f) => s.expenses.filter(f).reduce((t, e) => t + e.amount, 0);
  const deposit = sum((e) => e.kind === 'deposit');
  const courtPaid = sum((e) => KINDS[e.kind]?.court);
  const extras = sum((e) => !KINDS[e.kind]?.court);
  const courtPrice = s.courtPrice || 0;
  return { deposit, courtPaid, courtPrice, remaining: Math.max(0, courtPrice - courtPaid), extras, total: courtPaid + extras };
}

/* ---------- Chia tiền ----------
   Mỗi người chịu share = total / số người chơi. "net" = share − số đã ứng.
   Người thu (collector) = người ứng nhiều nhất (ưu tiên người tổ chức).
   received[id] = tiền collector đã nhận từ người đó (âm = collector đã trả lại cho họ).
   Sửa chi phí sau khi đã nhận tiền: giữ received, phần "due = net − received" là chênh lệch. */
export function settle(pb, s) {
  const people = participants(pb, s);
  const c = costs(s);
  const n = people.length;
  const share = n ? Math.round(c.total / n) : 0;
  const paid = {};
  s.expenses.forEach((e) => { paid[e.paidBy] = (paid[e.paidBy] || 0) + e.amount; });
  const org = organizer(pb)?.id;
  const payers = Object.keys(paid).sort((a, b) => paid[b] - paid[a] || (b === org) - (a === org));
  const collector = payers[0] || org;
  const ids = [...people.map((p) => p.id), ...Object.keys(paid).filter((id) => !people.some((p) => p.id === id))];
  const rows = ids.filter((id) => id !== collector).map((id) => {
    const played = people.some((p) => p.id === id);
    const net = (played ? share : 0) - (paid[id] || 0);
    const received = s.received?.[id] || 0;
    const due = net - received;
    let status;
    if (net === 0 && received === 0) status = 'none';
    else if (due === 0) status = net > 0 ? 'paid' : 'reimbursed';
    else if (net > 0) status = received > net ? 'overpaid' : received > 0 ? 'partial' : 'unpaid';
    else status = received < net ? 'overpaid' : 'owed'; // collector cần trả lại cho người này
    return { id, name: personName(pb, s, id), guest: s.guests.some((g) => g.id === id), played, share: played ? share : 0, paid: paid[id] || 0, net, received, due, status };
  });
  const collectorPlayed = people.some((p) => p.id === collector);
  const toCollect = rows.reduce((t, r) => t + Math.max(0, r.net), 0);
  const outstanding = rows.reduce((t, r) => t + (r.net > 0 ? Math.max(0, r.due) : 0), 0);
  const refunds = rows.reduce((t, r) => t + (r.due < 0 ? -r.due : 0), 0);
  return {
    people, n, share, total: c.total, costs: c, collector, collectorName: personName(pb, s, collector),
    collectorPaid: paid[collector] || 0, collectorShare: collectorPlayed ? share : 0, rows, toCollect, outstanding, refunds,
  };
}

/* ---------- Trạng thái một buổi ---------- */
export function sessionState(pb, s) {
  if (s.status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', tone: '' };
  if (s.date > todayIso) return { key: 'upcoming', label: 'Upcoming', tone: 'lav' };
  if (s.date === todayIso && !s.locked) return { key: 'today', label: 'Today', tone: 'mint' };
  if (!s.locked) return { key: 'attendance', label: 'Confirm attendance', tone: 'amber' };
  if (!s.expenses.length) return { key: 'expenses', label: 'Add expenses', tone: 'amber' };
  const st = settle(pb, s);
  if (st.outstanding > 0) return { key: 'collecting', label: `To collect ${money(st.outstanding)}`, tone: 'rose' };
  if (st.refunds > 0) return { key: 'refund', label: `Refund ${money(st.refunds)}`, tone: 'amber' };
  return { key: 'settled', label: 'Settled', tone: 'good' };
}

/* ---------- Tóm tắt để dán vào Zalo ---------- */
export function summaryText(pb, s) {
  const st = settle(pb, s);
  const c = st.costs;
  const lines = [`🏓 Pickleball ${fmtDate(s.date)} · ${s.start}–${s.end}${s.court ? ` · ${s.court}` : ''}`];
  const parts = [`court ${money(c.courtPaid)}`];
  s.expenses.filter((e) => !KINDS[e.kind]?.court).forEach((e) => parts.push(`${(e.label || KINDS[e.kind].label).toLowerCase()} ${money(e.amount)}`));
  lines.push(`Total: ${money(st.total)} (${parts.join(' + ')})`);
  lines.push(`${st.n} players: ${st.people.map((p) => p.name).join(', ')}`);
  lines.push(`Each: ${money(st.share)}`);
  const debt = st.rows.filter((r) => r.net > 0);
  if (debt.length) {
    lines.push('', `Please transfer to ${st.collectorName}:`);
    debt.forEach((r) => {
      const tag = r.due <= 0 ? '✅ paid' : r.received > 0 ? `⏳ ${money(r.due)} left` : '⏳';
      lines.push(`- ${r.name}: ${money(r.net)} ${tag}`);
    });
  }
  st.rows.filter((r) => r.due < 0).forEach((r) => lines.push(`↩ ${st.collectorName} returns ${money(-r.due)} to ${r.name}`));
  return lines.join('\n');
}

/* ---------- Thống kê ---------- */
export function stats(pb, from, to) {
  const list = pb.sessions.filter((s) => s.status !== 'cancelled' && s.locked && s.date >= from && s.date <= to);
  const per = {};
  let total = 0; let advanced = 0; let myShare = 0; let outstanding = 0; let myPlayed = 0;
  list.forEach((s) => {
    const st = settle(pb, s);
    st.people.forEach((p) => { per[p.id] = (per[p.id] || 0) + 1; });
    total += st.total;
    advanced += s.expenses.filter((e) => e.paidBy === pb.me).reduce((t, e) => t + e.amount, 0);
    if (st.people.some((p) => p.id === pb.me)) { myShare += st.share; myPlayed++; }
    if (st.collector === pb.me) outstanding += st.outstanding;
  });
  return { sessions: list.length, per, total, avg: list.length ? Math.round(total / list.length) : 0, advanced, myShare, outstanding, myPlayed };
}
