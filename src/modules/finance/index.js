import Page from './FinancePage.jsx';
import { initial } from './data.js';
import { daysFromToday, dm, vnd } from '../../core/format.js';

function agenda(slice, date, isToday) {
  return slice.bills
    .filter((b) => b.due === date || (isToday && !b.paid && b.due < date) || (isToday && !b.paid && daysFromToday(b.due) > 0 && daysFromToday(b.due) <= 3))
    .map((b) => ({
      id: b.id, module: 'finance', kind: 'Thanh toán', icon: 'card', title: `${b.name} · ${vnd(b.amount)}`,
      sub: b.due === date ? 'Đến hạn hôm nay' : b.due < date ? `Quá hạn từ ${dm(b.due)}` : `Đến hạn ${dm(b.due)}`,
      done: b.paid, overdue: !b.paid && b.due < date,
      toggle: (s) => ({ ...s, bills: s.bills.map((x) => (x.id === b.id ? { ...x, paid: !x.paid } : x)) }),
    }));
}
const events = (slice) => slice.bills.map((b) => ({ date: b.due, title: `Thanh toán ${b.name}`, kind: 'bill', done: b.paid }));

export default { id: 'finance', title: 'Tài chính', icon: 'wallet', group: 'core', Page, initial, agenda, events };
