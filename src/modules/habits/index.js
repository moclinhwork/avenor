import Page from './HabitsPage.jsx';
import { initial } from './data.js';

function agenda(slice, date) {
  return slice.habits.map((h) => ({
    id: `${h.id}-${date}`, module: 'habits', kind: 'Thói quen', icon: h.icon, title: h.name, sub: `Mục tiêu ${h.target} ngày/tuần`,
    done: !!h.log[date],
    toggle: (s) => ({ ...s, habits: s.habits.map((x) => (x.id === h.id ? { ...x, log: { ...x.log, [date]: !x.log[date] } } : x)) }),
  }));
}

export default { id: 'habits', title: 'Thói quen', icon: 'repeat', group: 'extra', Page, initial, agenda };
