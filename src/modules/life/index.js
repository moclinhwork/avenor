import Page from './LifePage.jsx';

// Life Score: điểm cân bằng cuộc sống tính từ dữ liệu các module, kèm bản tin hằng ngày.
// weights: trọng số từng lĩnh vực (0–3); snaps: điểm mỗi ngày; brief: bản tin AI đã lưu trong ngày.
export const initial = { weights: {}, snaps: {}, brief: null };
export default { id: 'life', title: 'Life Score', short: 'Life Score', icon: 'sparkle', group: 'main', Page, initial };
