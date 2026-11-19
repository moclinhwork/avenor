import { useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { api, SERVER } from '../../core/platform.js';
import { useAccount } from '../../core/AuthGate.jsx';
import { checkPin, makePin, registerFail, resetFails, triesLeft, unlock, waitSeconds } from './pin.js';
import { Dots, Keypad, Sheet } from './ui.jsx';

function usePinInput(onFull) {
  const [v, setV] = useState('');
  const digit = (c) => setV((x) => {
    if (x.length >= 6) return x;
    const n = x + c;
    if (n.length === 6) setTimeout(() => onFull(n, () => setV('')), 60);
    return n;
  });
  useEffect(() => {
    const k = (e) => { if (e.target.closest?.('input, textarea, select')) return; if (/^\d$/.test(e.key)) digit(e.key); else if (e.key === 'Backspace') setV((x) => x.slice(0, -1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  return [v, digit, () => setV((x) => x.slice(0, -1))];
}

function Wait({ onDone }) {
  const [s, setS] = useState(waitSeconds());
  useEffect(() => { const t = setInterval(() => { const n = waitSeconds(); setS(n); if (!n) { clearInterval(t); onDone(); } }, 1000); return () => clearInterval(t); }, []);
  return <span>Too many tries. Wait {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}.</span>;
}

/** Màn hình đặt PIN lần đầu hoặc mở khóa module. */
export default function PinGate({ d, set }) {
  const [stage, setStage] = useState(d.pin ? 'unlock' : 'new');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [waiting, setWaiting] = useState(waitSeconds() > 0);

  const onFull = async (pin, clear) => {
    if (stage === 'new') { setFirst(pin); setStage('confirm'); setMsg(''); clear(); return; }
    if (stage === 'confirm') {
      if (pin !== first) { setStage('new'); setMsg('PINs did not match. Start again.'); clear(); return; }
      setBusy(true); const rec = await makePin(pin); set((s) => ({ ...s, pin: rec })); setBusy(false); resetFails(); unlock(); return;
    }
    if (waitSeconds() > 0) { clear(); return; }
    setBusy(true); const ok = await checkPin(d.pin, pin); setBusy(false);
    if (ok) { unlock(); return; }
    registerFail(); clear();
    if (waitSeconds() > 0) setWaiting(true);
    setMsg(`Wrong PIN. ${triesLeft()} ${triesLeft() === 1 ? 'try' : 'tries'} left before a wait.`);
  };
  const [v, digit, del] = usePinInput(onFull);
  const title = stage === 'unlock' ? 'Accounts is locked' : stage === 'new' ? 'Set a 6-digit PIN' : 'Enter the PIN again';
  const sub = stage === 'unlock' ? 'Enter your PIN' : stage === 'new' ? 'You will need it to open Accounts and to see password hints.' : 'To make sure it is right';

  return (
    <div className="ac-pin fade-in">
      <span className="ac-pin-ic"><Icon name="lock" size={32} /></span>
      <h2>{title}</h2>
      <p className="muted">{sub}</p>
      <Dots n={v.length} />
      <div className="ac-pin-msg" role="status">{busy ? 'Checking…' : waiting ? <Wait onDone={() => { setWaiting(false); setMsg(''); }} /> : msg}</div>
      <Keypad onDigit={waiting || busy ? () => {} : digit} onDelete={del}
        left={stage === 'unlock' ? <button type="button" className="ghost sm" onClick={() => setForgot(true)}>Forgot?</button> : null} />
      <p className="muted ac-pin-foot">{stage === 'unlock' ? 'Locks again after 5 minutes in the background.' : 'The PIN locks this module on every device. It does not encrypt your data.'}</p>
      {forgot && <ForgotPin onClose={() => setForgot(false)} onReset={() => { set((s) => ({ ...s, pin: null })); resetFails(); setForgot(false); setWaiting(false); setMsg(''); setStage('new'); }} />}
    </div>
  );
}

function ForgotPin({ onClose, onReset }) {
  const me = useAccount();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!SERVER) { onReset(); return; }
    setBusy(true); setErr('');
    try { await api('/api/login', { method: 'POST', body: { username: me?.user?.username, password: pw } }); onReset(); }
    catch (x) { setErr(x.code === 'too_many' ? 'Too many tries. Wait a few minutes.' : 'That password is not right.'); }
    setBusy(false);
  };
  return (
    <Sheet title="Reset PIN" sub={SERVER ? `Sign in again as ${me?.user?.username || 'you'} to set a new PIN. Your accounts stay as they are.` : 'Demo: reset the PIN without a password.'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {SERVER && <div className="field"><label htmlFor="ac-pw">Avenor password</label><input id="ac-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>}
        {err && <span className="rose" style={{ fontSize: 13 }}>{err}</span>}
        <button className="btn block" disabled={busy || (SERVER && !pw)}>{busy ? 'Checking…' : 'Reset PIN'}</button>
      </form>
    </Sheet>
  );
}

/** Hỏi PIN mỗi lần xem gợi nhớ mật khẩu. */
export function PinCheckSheet({ d, title, sub = 'Enter your PIN to see the hint', onOk, onClose }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [v, digit, del] = usePinInput(async (pin, clear) => {
    if (waitSeconds() > 0) { clear(); setMsg('Too many tries. Wait a few minutes.'); return; }
    setBusy(true); const ok = await checkPin(d.pin, pin); setBusy(false);
    if (ok) { resetFails(); onOk(); return; }
    registerFail(); clear(); setMsg(`Wrong PIN. ${triesLeft()} left.`);
  });
  return (
    <Sheet title={title} sub={sub} onClose={onClose}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
        <Dots n={v.length} />
        <div className="ac-pin-msg" role="status">{busy ? 'Checking…' : msg}</div>
        <Keypad onDigit={digit} onDelete={del} />
      </div>
    </Sheet>
  );
}
