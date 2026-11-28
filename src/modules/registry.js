// Danh sách module của Avenor. Thêm module mới: tạo thư mục trong src/modules,
// export một manifest từ index.js rồi khai báo ở đây.
import overview from './overview/index.js';
import today from './today/index.js';
import health from './health/index.js';
import goals from './goals/index.js';
import finance from './finance/index.js';
import travel from './travel/index.js';
import books from './books/index.js';
import habits from './habits/index.js';
import documents from './documents/index.js';
import accounts from './accounts/index.js';
import business from './business/index.js';
import journal from './journal/index.js';
import learning from './learning/index.js';
import ideas from './ideas/index.js';
import life from './life/index.js';
import settings from './settings/index.js';

export const MODULES = [overview, today, life, business, health, ideas, goals, finance, travel, books, habits, documents, accounts, journal, learning, settings];
export const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const GROUPS = [
  { id: 'main', label: 'Tổng hợp' },
  { id: 'core', label: 'Module chính' },
  { id: 'extra', label: 'Module bổ sung' },
  { id: 'system', label: 'Hệ thống' },
];
