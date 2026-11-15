// Ảnh người dùng tải lên: thu nhỏ trên máy, rồi lưu vào kho ảnh của app (capability `assets`).
// Khi không có kho ảnh (chạy ngoài Claude), ảnh được thu nhỏ hơn và giữ dạng data URL.

import { api, SERVER } from './platform.js';

async function useAssets() {
  try {
    if (!window.claude?.use) return null;
    return await Promise.race([window.claude.use('assets'), new Promise((r) => setTimeout(() => r(null), 8000))]);
  } catch { return null; }
}

function resize(file, max, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
const toDataUrl = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });

/** Trả về { id?, url } để lưu trong dữ liệu module. */
export async function uploadPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('not_image');
  if (SERVER) {
    const blob = await resize(file, 1600, 0.85);
    return api('/api/photos', { method: 'POST', body: blob });
  }
  const assets = await useAssets();
  if (assets) {
    const blob = await resize(file, 1600, 0.85);
    const res = await assets.upload(blob);
    return { id: res.id, url: res.url };
  }
  const blob = await resize(file, 640, 0.72);
  return { url: await toDataUrl(blob) };
}

/** Xóa ảnh khỏi kho khi người dùng bỏ ảnh hoặc xóa mục chứa nó. */
export async function deletePhoto(photo) {
  if (!photo?.id) return;
  if (SERVER) { try { await api(`/api/photos/${photo.id}`, { method: 'DELETE' }); } catch { /* bỏ qua */ } return; }
  try { const assets = await useAssets(); await assets?.delete(photo.id); } catch { /* ảnh vẫn còn trong kho cũng không sao */ }
}
