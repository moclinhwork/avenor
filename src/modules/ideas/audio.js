// Ghi âm (MediaRecorder + sóng âm), giữ bản ghi trong IndexedDB tới khi tải lên xong,
// tải lên máy chủ và hỏi trạng thái chép lời.
import { api, SERVER } from '../../core/platform.js';

/* ---------- Ghi âm ---------- */

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* bỏ qua */ }
  }
  return '';
}

export class MicError extends Error {}

export async function startRecorder() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new MicError('Thiết bị hoặc trình duyệt này chưa hỗ trợ ghi âm. Hãy mở Avenor bằng Chrome hoặc Safari mới.');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch (e) {
    throw new MicError(e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
      ? 'Avenor chưa được phép dùng micro. Hãy cho phép micro cho trang này (biểu tượng ổ khóa cạnh địa chỉ) rồi thử lại.'
      : e?.name === 'NotFoundError' ? 'Không tìm thấy micro trên thiết bị.' : 'Không mở được micro. Hãy thử lại.');
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(1000);

  let ctx = null; let analyser = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
  } catch { /* không có sóng âm cũng không sao */ }

  const release = () => { stream.getTracks().forEach((t) => t.stop()); ctx?.close().catch(() => {}); };
  return {
    analyser,
    pause: () => { if (rec.state === 'recording') rec.pause(); },
    resume: () => { if (rec.state === 'paused') rec.resume(); },
    stop: () => new Promise((resolve) => {
      rec.onstop = () => { release(); resolve(new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] })); };
      if (rec.state === 'inactive') rec.onstop(); else rec.stop();
    }),
    cancel: () => { try { rec.onstop = null; if (rec.state !== 'inactive') rec.stop(); } catch { /* bỏ qua */ } release(); },
  };
}

/* ---------- IndexedDB: giữ bản ghi trên máy ---------- */

function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('avenor-audio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('blobs', mode);
    const req = fn(t.objectStore('blobs'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
export const putBlob = (id, blob) => tx('readwrite', (s) => s.put(blob, id)).catch(() => {});
export const getBlob = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
export const delBlob = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});

/* ---------- Máy chủ ---------- */

export const audioUrl = (idea) => (SERVER && idea.audioId ? `/api/audio/${idea.audioId}` : null);
export const uploadAudio = (blob) => api('/api/audio', { method: 'POST', body: blob });
export const sttStatus = (ids) => api('/api/audio/status', { method: 'POST', body: { ids } });
export const retryStt = (audioId) => api(`/api/audio/${audioId}/transcribe`, { method: 'POST' });
export const deleteAudio = (audioId) => api(`/api/audio/${audioId}`, { method: 'DELETE' }).catch(() => {});

export const fmtDur = (s) => { const n = Math.max(0, Math.round(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
