import Page from './LearningPage.jsx';
import { initial } from './data.js';

const events = (slice) => slice.milestones.map((m) => ({ date: m.date, title: m.title, kind: 'learning', done: m.done }));
export default { id: 'learning', title: 'Học tập & Kỹ năng', short: 'Học tập', icon: 'cap', group: 'extra', Page, initial, events };
