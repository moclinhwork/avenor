import Page from './TravelPage.jsx';
import { initial } from './data.js';

const events = (slice) => slice.trips.flatMap((t) => [{ date: t.start, title: `Khởi hành ${t.name}`, kind: 'trip' }, { date: t.end, title: `Về từ ${t.name}`, kind: 'trip' }]);

export default { id: 'travel', title: 'Du lịch', icon: 'plane', group: 'core', Page, initial, events };
