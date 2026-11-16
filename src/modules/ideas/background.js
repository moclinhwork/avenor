// Chạy nền khi app mở: tải bản ghi còn nằm trên máy lên máy chủ, rồi hỏi kết quả chép lời.
// Nhờ vậy bấm Finish xong có thể rời màn hình ngay; bản chép tự điền vào khi xong.
import { useEffect, useRef } from 'react';
import { SERVER } from '../../core/platform.js';
import { useModule } from '../../core/store.jsx';
import { delBlob, getBlob, sttStatus, uploadAudio } from './audio.js';
import { autoTitle } from './data.js';

const uploading = new Set();

export function patchIdea(set, id, patch) {
  set((s) => ({ ...s, ideas: (s.ideas || []).map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }));
}

// Áp kết quả chép lời: không ghi đè phần người dùng đã sửa tay.
export const applyTranscript = (x, text) => ({
  stt: 'done', sttError: '',
  transcript: x.transcriptEdited ? x.transcript : text,
  title: x.titleEdited || !text ? x.title : (autoTitle(text) || x.title),
});

export async function uploadIdea(set, idea) {
  if (!SERVER || uploading.has(idea.id)) return;
  const blob = await getBlob(idea.id);
  if (!blob) return; // bản ghi nằm trên thiết bị khác
  uploading.add(idea.id);
  try {
    const r = await uploadAudio(blob);
    patchIdea(set, idea.id, { audioId: r.id, stt: 'pending', sttError: '' });
    delBlob(idea.id);
  } catch (e) {
    patchIdea(set, idea.id, { stt: 'uploading', sttError: e?.status ? 'Máy chủ chưa nhận bản ghi, sẽ thử lại.' : 'Chưa có mạng, sẽ tự tải lên khi có mạng.' });
  } finally {
    uploading.delete(idea.id);
  }
}

export function useIdeasBackground() {
  const [data, set] = useModule('ideas');
  const ideas = data?.ideas || [];
  const ref = useRef(ideas);
  ref.current = ideas;
  const busy = ideas.some((x) => ['uploading', 'pending', 'working'].includes(x.stt));

  useEffect(() => {
    if (!SERVER || !busy) return undefined;
    let alive = true;
    const tick = async () => {
      const list = ref.current;
      list.filter((x) => x.stt === 'uploading').forEach((x) => uploadIdea(set, x));
      const ids = list.filter((x) => x.audioId && (x.stt === 'pending' || x.stt === 'working')).map((x) => x.audioId);
      if (!ids.length) return;
      try {
        const { items } = await sttStatus(ids);
        if (!alive) return;
        list.forEach((x) => {
          const r = x.audioId && items[x.audioId];
          if (!r || r.status === x.stt) return;
          if (r.status === 'done') patchIdea(set, x.id, (cur) => applyTranscript(cur, r.text));
          else if (r.status === 'error') patchIdea(set, x.id, { stt: 'error', sttError: r.error || 'Lỗi không rõ' });
          else if (r.status === 'missing') patchIdea(set, x.id, { stt: 'error', sttError: 'Máy chủ không còn bản ghi này.' });
          else patchIdea(set, x.id, { stt: r.status });
        });
      } catch { /* mất mạng: lần sau hỏi lại */ }
    };
    tick();
    const t = setInterval(tick, 5000);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', tick);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', tick); };
  }, [busy, set]);
}

// Mở màn ghi âm từ bất kỳ đâu (nút mic giữa thanh điều hướng, thẻ trên Hôm nay…).
export const openCapture = () => window.dispatchEvent(new Event('avenor:capture'));
