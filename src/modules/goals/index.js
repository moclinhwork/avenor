import Page from './GoalsPage.jsx';
import { initial, progress } from './data.js';
import { daysFromToday, dm } from '../../core/format.js';

// Cột mốc đến hạn trong ngày (hoặc đã quá hạn, khi xem hôm nay) được đưa vào màn hình Hôm nay.
function agenda(slice, date, isToday) {
  const out = [];
  slice.goals.forEach((g) => g.milestones.forEach((ms) => {
    const due = ms.due === date || (isToday && !ms.done && ms.due < date && daysFromToday(ms.due) > -30);
    if (!due) return;
    out.push({
      id: ms.id, module: 'goals', kind: 'Cột mốc', icon: 'flag', title: ms.title,
      sub: `${g.title}${ms.due < date ? ` · hạn ${dm(ms.due)}` : ''}`, done: ms.done, overdue: ms.due < date && !ms.done,
      toggle: (s) => ({ ...s, goals: s.goals.map((x) => (x.id !== g.id ? x : { ...x, milestones: x.milestones.map((y) => (y.id === ms.id ? { ...y, done: !y.done } : y)) })) }),
    });
  }));
  return out;
}
const events = (slice) => slice.goals.filter((g) => progress(g) < 100).map((g) => ({ date: g.deadline, title: `Hạn: ${g.title}`, kind: 'goal' }));

export default { id: 'goals', title: 'Mục tiêu', icon: 'target', group: 'core', Page, initial, agenda, events };
