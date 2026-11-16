// Dữ liệu module Ý tưởng. Mặc định mọi ý tưởng vào Inbox để ghi nhanh, phân loại sau.

export const COLORS = ['#8a817a', '#5f9d85', '#e0a96d', '#a58bd0', '#5b8fc7', '#d07a6a', '#c9a227', '#3d9aa8'];

export const initial = {
  categories: [
    { id: 'inbox', name: 'Inbox', color: '#8a817a', icon: 'inbox', fixed: true },
    { id: 'software', name: 'Software', color: '#5f9d85', icon: 'laptop' },
    { id: 'business', name: 'Business', color: '#e0a96d', icon: 'briefcase' },
  ],
  ideas: [],
};

export const STT_TEXT = {
  uploading: 'Đang tải bản ghi lên…',
  pending: 'Đang chờ chép lời…',
  working: 'Đang chép lời…',
  error: 'Chép lời chưa thành công',
  unavailable: 'Chép lời chỉ có trên bản avenor.moclinh.vn',
};

// Tiêu đề tự động từ bản chép (tối đa 8 từ).
export function autoTitle(text) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return '';
  const t = words.slice(0, 8).join(' ').replace(/[.,;:!?]+$/, '');
  return words.length > 8 ? `${t}…` : t;
}

export const ideaDate = (iso) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
