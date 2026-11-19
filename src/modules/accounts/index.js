import Page from './AccountsPage.jsx';
import { initial, reviewList } from './data.js';
import { todayIso } from '../../core/format.js';

// Tối đa 3 tài khoản cần kiểm tra được đưa lên màn hình Hôm nay (chỉ khi xem hôm nay).
function agenda(slice, date, isToday) {
  if (!isToday || !slice?.accounts) return [];
  return reviewList(slice).slice(0, 3).map(({ a, list }) => {
    const overdueOnly = list.every((x) => x.level === 'overdue');
    return {
      id: `acc-${a.id}`, module: 'accounts', kind: 'Review', icon: 'shield',
      title: `Review ${a.label}`, sub: list[0].text, done: a.lastReviewedOn === todayIso,
      ...(overdueOnly ? { toggle: (s) => ({ ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, lastReviewedOn: todayIso } : x)) }) } : {}),
    };
  });
}

export default { id: 'accounts', title: 'Accounts', short: 'Accounts', icon: 'key', group: 'extra', Page, initial, agenda };
