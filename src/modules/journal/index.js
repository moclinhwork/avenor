import Page from './JournalPage.jsx';
import { initial } from './data.js';

function agenda(slice, date, isToday) {
  if (!isToday) return [];
  const has = slice.entries.some((e) => e.date === date);
  return [{ id: `j-${date}`, module: 'journal', kind: 'Nhật ký', icon: 'journal', title: 'Ghi tâm trạng và năng lượng hôm nay', sub: 'Mất khoảng 1 phút', done: has, link: true }];
}

export default { id: 'journal', title: 'Nhật ký & Tổng kết tuần', short: 'Nhật ký', icon: 'journal', group: 'extra', Page, initial, agenda };
