import Page from './DocumentsPage.jsx';
import { initial, status } from './data.js';
import { dm } from '../../core/format.js';

export { status };

// Giấy tờ đã vào cửa sổ nhắc được đưa lên màn hình Hôm nay (chỉ khi xem hôm nay).
function agenda(slice, date, isToday) {
  if (!isToday) return slice.docs.filter((d) => d.expires === date).map((d) => ({ id: d.id, module: 'documents', kind: 'Gia hạn', icon: 'file', title: `Hết hạn: ${d.name}`, sub: '', done: !!d.handled }));
  return slice.docs.filter((d) => { const s = status(d); return s.tone !== 'mint'; }).map((d) => ({
    id: d.id, module: 'documents', kind: 'Gia hạn', icon: 'file', title: `Gia hạn ${d.name}`, sub: `${status(d).label} · hạn ${dm(d.expires)}`,
    done: !!d.handled, overdue: status(d).n < 0,
    toggle: (s) => ({ ...s, docs: s.docs.map((x) => (x.id === d.id ? { ...x, handled: !x.handled } : x)) }),
  }));
}
const events = (slice) => slice.docs.map((d) => ({ date: d.expires, title: `Hết hạn ${d.name}`, kind: 'doc' }));

export default { id: 'documents', title: 'Giấy tờ & Gia hạn', short: 'Giấy tờ', icon: 'file', group: 'extra', Page, initial, agenda, events };
