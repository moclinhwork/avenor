import Page from './HabitsPage.jsx';
import { initial } from './data.js';
import { effective } from './link.js';

function agenda(slice, date, isToday, state) {
  return slice.habits.map((raw) => {
    const h = effective(raw, state?.health);
    const done = !!h.log[date];
    return {
      id: `${h.id}-${date}`, module: 'habits', kind: 'Thói quen', icon: h.icon, title: h.name,
      sub: h.auto[date] && raw.log?.[date] === undefined ? `Tự tích từ Sức khỏe · ${h.auto[date]}` : `Mục tiêu ${h.target} ngày/tuần`,
      done,
      toggle: (s) => ({ ...s, habits: s.habits.map((x) => (x.id === h.id ? { ...x, log: { ...x.log, [date]: !done } } : x)) }),
    };
  });
}

export default { id: 'habits', title: 'Thói quen', icon: 'repeat', group: 'extra', Page, initial, agenda };
