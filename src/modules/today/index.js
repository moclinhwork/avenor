import Page from './TodayPage.jsx';
import { initial } from './data.js';

function agenda(slice, date, isToday) {
  return slice.tasks.filter((t) => t.date === date || (isToday && !t.done && t.date < date)).map((t) => ({
    id: t.id, module: 'today', kind: 'Việc', icon: 'check', title: t.title, sub: t.priority === 'high' ? 'Ưu tiên cao' : '', done: t.done, overdue: t.date < date && !t.done, high: t.priority === 'high',
    toggle: (s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }),
  }));
}
const events = (slice) => slice.appointments.map((a) => ({ date: a.date, time: a.time, end: a.end, title: a.title, place: a.place, kind: a.kind, own: true }));

export default { id: 'today', title: 'Lịch & Việc cần làm', short: 'Hôm nay', icon: 'today', group: 'main', Page, initial, agenda, events };
