import Page from './BusinessPage.jsx';

// Business: doanh số (Sales), quảng cáo (Google Ads, Meta Ads), website (GA4) và kênh nội dung (YouTube, TikTok).
// Số liệu lấy qua máy chủ Avenor (server/business). Lát dữ liệu của module chỉ giữ cài đặt người dùng:
// mục tiêu doanh số theo tháng, ngưỡng cảnh báo và chế độ demo.
export const initial = { targets: {}, thresholds: [], demo: false };

export default { id: 'business', title: 'Business', short: 'Business', icon: 'briefcase', group: 'core', Page, initial };
