import { useEffect, useRef, useState } from 'react';
import { SERVER } from '../../core/platform.js';
import { useModule } from '../../core/store.jsx';
import { go } from '../../core/router.js';
import { uid } from '../../core/format.js';
import Icon from '../../ui/Icon.jsx';
import { MicError, putBlob, startRecorder } from './audio.js';
import { uploadIdea } from './background.js';
import { initial } from './data.js';

const MAX_SEC = 10 * 60;

// Màn ghi ý tưởng: đếm giờ, sóng âm, Tạm dừng / Tiếp tục / Xong.
export default function CaptureIdea({ onClose }) {
  const [, set] = useModule('ideas');
  const [phase, setPhase] = useState('starting'); // starting | recording | paused | saving | error
  const [err, setErr] = useState('');
  const [sec, setSec] = useState(0);
  const recRef = useRef(null);
  const canvasRef = useRef(null);
  const startedAt = useRef(null);
  const elapsed = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    let cancelled = false;
    startRecorder().then((r) => {
      if (cancelled) { r.cancel(); return; }
      recRef.current = r; startedAt.current = new Date(); setPhase('recording');
    }).catch((e) => { setErr(e instanceof MicError ? e.message : 'Không mở được micro.'); setPhase('error'); });
    return () => { cancelled = true; recRef.current?.cancel(); };
  }, []);

  // Đồng hồ (không tính lúc tạm dừng).
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now(); elapsed.current += (now - last) / 1000; last = now;
      setSec(Math.floor(elapsed.current));
      if (elapsed.current >= MAX_SEC) finish();
    }, 250);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sóng âm: cột đối xứng theo âm lượng thật của micro.
  useEffect(() => {
    let raf;
    const N = 44; const hist = Array(N).fill(0.04);
    const draw = () => {
      const c = canvasRef.current;
      if (c) {
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth; const h = c.clientHeight;
        if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
        const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const a = recRef.current?.analyser;
        let lvl = 0.04;
        if (a && phaseRef.current === 'recording') {
          const buf = new Uint8Array(a.fftSize); a.getByteTimeDomainData(buf);
          let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2;
          lvl = Math.min(1, Math.sqrt(sum / buf.length) * 4.5 + 0.04);
        }
        hist.shift(); hist.push(phaseRef.current === 'recording' ? lvl : hist[hist.length - 1] * 0.92 + 0.003);
        const gap = w / N;
        g.fillStyle = getComputedStyle(c).color;
        hist.forEach((v, i) => {
          const center = 1 - Math.abs(i - N / 2) / (N / 2) * 0.35;
          const bh = Math.max(4, v * h * 0.95 * center);
          const x = i * gap + gap * 0.3; const bw = Math.max(2, gap * 0.4);
          g.globalAlpha = 0.35 + 0.65 * (i / N);
          g.beginPath(); g.roundRect ? g.roundRect(x, (h - bh) / 2, bw, bh, bw / 2) : g.rect(x, (h - bh) / 2, bw, bh); g.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pause = () => { recRef.current?.pause(); setPhase('paused'); };
  const resume = () => { recRef.current?.resume(); setPhase('recording'); };

  async function finish() {
    const r = recRef.current;
    if (!r || phaseRef.current === 'saving') return;
    setPhase('saving');
    const blob = await r.stop();
    recRef.current = null;
    const id = uid();
    const at = startedAt.current || new Date();
    const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    await putBlob(id, blob);
    const idea = {
      id, createdAt: at.toISOString(), duration: Math.round(elapsed.current), mime: blob.type,
      title: `Ý tưởng ${at.getDate()}/${at.getMonth() + 1} ${hhmm}`, transcript: '', categoryId: 'inbox',
      stt: SERVER ? 'uploading' : 'unavailable', sttError: '', done: false,
    };
    set((s) => ({ ...(s || initial), ideas: [idea, ...((s || initial).ideas || [])] }));
    if (SERVER) uploadIdea(set, idea);
    onClose();
    go(`ideas?review=${id}`);
  }

  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <div className="capture" role="dialog" aria-modal="true" aria-label="Ghi ý tưởng">
      <div className="capture-top">
        <button className="bare-btn" onClick={onClose} aria-label="Hủy ghi âm"><Icon name="close" size={24} /></button>
      </div>
      <h1 className="capture-title">Ghi ý tưởng</h1>
      {phase === 'error' ? (
        <div className="capture-body">
          <span className="icon-tile" style={{ width: 64, height: 64 }}><Icon name="mic" size={30} /></span>
          <p style={{ textAlign: 'center', maxWidth: 320 }}>{err}</p>
          <button className="btn" onClick={onClose}>Đóng</button>
        </div>
      ) : (
        <>
          <div className="capture-body">
            <span className={`rec-chip ${phase === 'paused' ? 'paused' : ''}`}><i />{phase === 'starting' ? 'Đang mở micro…' : phase === 'paused' ? 'Tạm dừng' : phase === 'saving' ? 'Đang lưu…' : 'Đang ghi âm'}</span>
            <div className="rec-time" aria-live="off">{mm}:{ss}</div>
            <canvas ref={canvasRef} className="rec-wave" aria-hidden="true" />
          </div>
          <div className="capture-actions">
            <div className="cap-side">
              <button className="cap-pause" onClick={phase === 'paused' ? resume : pause} disabled={phase !== 'recording' && phase !== 'paused'} aria-label={phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}>
                <Icon name={phase === 'paused' ? 'mic' : 'pause'} size={26} stroke={2.4} />
              </button>
              <span>{phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </div>
            <button className="cap-finish" onClick={finish} disabled={phase !== 'recording' && phase !== 'paused'}>
              <span className="cap-stop" />Xong
            </button>
            <div className="cap-side" aria-hidden="true" />
          </div>
        </>
      )}
    </div>
  );
}
