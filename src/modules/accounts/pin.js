import { useEffect, useState } from 'react';

// Mã PIN 6 số khóa module Accounts. PIN không mã hóa dữ liệu; chỉ chặn người đang cầm máy.
// Lưu dạng băm PBKDF2-SHA256 có salt trong slice (đồng bộ giữa điện thoại và web).
const ITER = 120000;
const LOCK_AFTER_MS = 5 * 60 * 1000;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function derive(pin, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: iter }, key, 256));
}
export async function makePin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, iter: ITER, hash: await derive(pin, salt, ITER) };
}
export async function checkPin(rec, pin) {
  if (!rec) return false;
  return (await derive(pin, rec.salt, rec.iter)) === rec.hash;
}

/* ---------- Trạng thái khóa (trong bộ nhớ, mất khi tải lại trang) ---------- */
let unlocked = false;
let hiddenAt = 0;
let fails = 0;
let waitUntil = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); emit(); }
    else if (hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) { unlocked = false; emit(); }
    else emit();
  });
}
export const unlock = () => { unlocked = true; fails = 0; emit(); };
export const lockNow = () => { unlocked = false; emit(); };
export function useLocked() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  return !unlocked;
}
/** Báo một lần nhập sai; trả về số giây phải chờ (0 nếu chưa phải chờ). */
export function registerFail() {
  fails += 1;
  if (fails >= 5) { const mins = 5 * 2 ** Math.max(0, fails - 5); waitUntil = Date.now() + mins * 60000; }
  return fails;
}
export const triesLeft = () => Math.max(0, 5 - fails);
export const waitSeconds = () => Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
export const resetFails = () => { fails = 0; waitUntil = 0; };
/** Ẩn mọi giá trị đang hiện khi app chuyển nền. */
export function useHiddenSignal() {
  const [n, setN] = useState(0);
  useEffect(() => { const f = () => { if (document.hidden) setN((x) => x + 1); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  return n;
}
