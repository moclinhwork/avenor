import { useEffect, useRef, useState } from 'react';
import { api } from '../../core/platform.js';
import { useStore } from '../../core/store.jsx';
import { go } from '../../core/router.js';
import Icon from '../../ui/Icon.jsx';
import { deleteAudio, MicError, startRecorder, sttStatus, uploadAudio } from '../ideas/audio.js';
import { commandContext, describe, toUpdate } from './commands.js';

const EXAMPLES = [
  'Chi 85k ăn trưa',
  'Sáng nay chạy 5 km trong 32 phút',
  'Cân nặng 68,2 kg',
  'Đã đọc xong Đắc Nhân Tâm, tích thói quen đọc sách',
  'Nhắc mình gọi điện cho mẹ tối mai',
];
const ERR = {
  ai_quota: 'Đã dùng hết lượt AI hôm nay.',
  ai_rate_limited: 'AI đang bận, thử lại sau ít phút.',
  ai_bad_key: 'Khóa Claude API trên máy chủ không hợp lệ.',
  ai_disabled: 'Máy chủ chưa bật AI.',
};
const MOD_LABEL = { finance: 'Tài chính', health: 'Sức khỏe', goals: 'Mục tiêu', habits: 'Thói quen', books: 'Đọc sách', travel: 'Du lịch', ideas: 'Ý tưởng', today: 'Hôm nay' };
export const openCommand = () => window.dispatchEvent(new Event('avenor:command'));

// Life Command: gõ hoặc nói một câu, AI đề xuất thao tác, bạn xác nhận rồi mới lưu; lưu xong vẫn hoàn tác được.
export default function CommandSheet({ onClose }) {
  const { state, update, notify } = useStore();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('input'); // input | listening | transcribing | thinking | review | done
  const [err, setErr] = useState('');
  const [reply, setReply] = useState('');
  const [items, setItems] = useState([]); // { a, d, on }
  const [undo, setUndo] = useState(null); // { prev: { moduleId: slice }, n }
  const rec = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); return () => rec.current?.cancel(); }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const send = async (t = text) => {
    const q = t.trim();
    if (!q) return;
    setPhase('thinking'); setErr(''); setReply('');
    try {
      const r = await api('/api/ai/command', { method: 'POST', body: { text: q, ctx: commandContext(state) } });
      const list = (r.actions || []).map((a) => { const d = describe(state, a); return { a, d, on: !d.error }; });
      setItems(list); setReply(r.reply || (list.length ? '' : 'Mình chưa hiểu lệnh này. Bạn thử nói rõ hơn nhé.'));
      setPhase(list.length ? 'review' : 'input');
    } catch (e) { setErr(ERR[e.code] || 'Chưa xử lý được lệnh, hãy thử lại.'); setPhase('input'); }
  };

  const listen = async () => {
    setErr('');
    try { rec.current = await startRecorder(); setPhase('listening'); } catch (e) { setErr(e instanceof MicError ? e.message : 'Không mở được micro.'); }
  };
  const stopListen = async () => {
    const r = rec.current; rec.current = null;
    if (!r) return;
    const blob = await r.stop();
    setPhase('transcribing');
    let audioId = null;
    try {
      audioId = (await uploadAudio(blob)).id;
      for (let i = 0; i < 80; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const s = (await sttStatus([audioId])).items?.[audioId];
        if (s?.status === 'done') {
          const t = (s.text || '').trim();
          if (!t) { setErr('Không nghe rõ, bạn thử nói lại nhé.'); setPhase('input'); return; }
          setText(t); send(t); return;
        }
        if (s?.status === 'error' || s?.status === 'missing') throw new Error('stt');
      }
      throw new Error('timeout');
    } catch { setErr('Chép lời chưa thành công, bạn gõ lệnh giúp mình nhé.'); setPhase('input'); }
    finally { if (audioId) deleteAudio(audioId); }
  };

  const save = () => {
    const chosen = items.filter((x) => x.on && !x.d.error);
    if (!chosen.length) return;
    const prev = {};
    chosen.forEach(({ a }) => {
      const u = toUpdate(state, a);
      if (!u) return;
      if (!(u.id in prev)) prev[u.id] = state[u.id];
      update(u.id, u.fn);
    });
    setUndo({ prev, n: chosen.length, mods: [...new Set(chosen.map((x) => x.d.module))] });
    setPhase('done');
  };
  const doUndo = () => {
    Object.entries(undo.prev).forEach(([id, slice]) => update(id, slice));
    notify(`Đã hoàn tác ${undo.n} mục`);
    setUndo(null); setItems([]); setText(''); setPhase('input');
  };
  const toggle = (i) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
  const chosenN = items.filter((x) => x.on && !x.d.error).length;
  const busy = phase === 'thinking' || phase === 'transcribing';

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet cmd" role="dialog" aria-modal="true" aria-label="Ra lệnh cho Avenor">
        <div className="sheet-grip" />
        <div className="cmd-head">
          <span className="icon-tile"><Icon name="sparkle" size={18} /></span>
          <div style={{ flex: 1 }}><b>Ra lệnh cho Avenor</b><div className="faint" style={{ fontSize: 12.5 }}>Gõ hoặc nói, mình ghi vào đúng chỗ.</div></div>
          <button className="bare-btn" onClick={onClose} aria-label="Đóng"><Icon name="close" size={20} /></button>
        </div>

        {phase === 'done' ? (
          <div className="cmd-done">
            <span className="icon-tile good" style={{ width: 52, height: 52 }}><Icon name="check" size={26} /></span>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Đã lưu {undo?.n} mục</div>
            <div className="faint" style={{ fontSize: 13 }}>{undo?.mods.map((m) => MOD_LABEL[m]).join(', ')}</div>
            <div className="cmd-actions">
              <button className="btn ghost" onClick={doUndo}><Icon name="back" size={16} />Hoàn tác</button>
              <button className="btn ghost" onClick={() => { setItems([]); setText(''); setUndo(null); setPhase('input'); }}>Lệnh khác</button>
              <button className="btn" onClick={() => { onClose(); if (undo?.mods.length === 1) go(undo.mods[0]); }}>Xong</button>
            </div>
          </div>
        ) : phase === 'listening' ? (
          <div className="cmd-listen">
            <button className="cmd-mic on" onClick={stopListen} aria-label="Dừng và gửi"><span className="cap-stop" /></button>
            <div>Đang nghe… nói xong bấm nút để gửi</div>
          </div>
        ) : (
          <>
            <form className="cmd-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea ref={inputRef} className="input" rows={2} value={text} disabled={busy} placeholder="Ví dụ: chi 85k ăn trưa, chạy 5 km sáng nay…"
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Câu lệnh" />
              <div className="cmd-btns">
                <button type="button" className="cmd-mic" onClick={listen} disabled={busy} aria-label="Nói lệnh"><Icon name="mic" size={20} /></button>
                <button type="submit" className="btn" disabled={busy || !text.trim()}>{phase === 'thinking' ? 'Đang hiểu…' : phase === 'transcribing' ? 'Đang chép lời…' : 'Gửi'}</button>
              </div>
            </form>
            {err && <div className="chip rose" style={{ whiteSpace: 'normal', marginTop: 10 }}>{err}</div>}
            {reply && <p className="muted" style={{ margin: '10px 2px 0', fontSize: 14 }}>{reply}</p>}

            {phase === 'review' ? (
              <div className="cmd-review">
                <div className="faint" style={{ fontSize: 12.5, margin: '14px 2px 6px' }}>Kiểm tra trước khi lưu</div>
                {items.map((x, i) => (
                  <label key={i} className={`cmd-item ${x.d.error ? 'bad' : ''}`}>
                    <input type="checkbox" checked={x.on && !x.d.error} disabled={!!x.d.error} onChange={() => toggle(i)} />
                    <span className="icon-tile"><Icon name={x.d.icon} size={16} /></span>
                    <span className="cmd-item-main">
                      <span className="cmd-item-title">{x.d.title}</span>
                      <span className="cmd-item-sub">{x.d.error || x.d.detail}</span>
                    </span>
                  </label>
                ))}
                <div className="cmd-actions">
                  <button className="btn ghost" onClick={() => { setItems([]); setPhase('input'); }}>Sửa lệnh</button>
                  <button className="btn" onClick={save} disabled={!chosenN}>Lưu {chosenN > 1 ? `${chosenN} mục` : ''}</button>
                </div>
              </div>
            ) : !busy && !text && (
              <div className="cmd-examples">
                {EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => { setText(e); inputRef.current?.focus(); }}>{e}</button>)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
