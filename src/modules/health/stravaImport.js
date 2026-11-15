// Nhập buổi tập từ gói dữ liệu Strava tải về (Settings → My Account → Download or Delete Your Account).
// Nhận file .zip nguyên gói (chỉ đọc phần activities.csv, không nạp cả gói vào bộ nhớ) hoặc file activities.csv.

import { iso } from '../../core/format.js';

const TYPE_MAP = { walk: 'walk', hike: 'walk', run: 'run', trailrun: 'run', virtualrun: 'run' };
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export class ImportError extends Error {}

/* ---------- Đọc zip ---------- */

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

async function csvFromZip(file) {
  const tailSize = Math.min(file.size, 65557);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ImportError('File zip bị hỏng hoặc không phải file zip.');
  const cdSize = u32(tail, eocd + 12);
  const cdOffset = u32(tail, eocd + 16);
  if (cdOffset === 0xffffffff) throw new ImportError('Gói dữ liệu quá lớn để đọc trực tiếp. Hãy giải nén rồi chọn file activities.csv.');
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50;) {
    const method = u16(cd, p + 10);
    const compSize = u32(cd, p + 20);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    const localOff = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    if (/(^|\/)activities\.csv$/i.test(name)) {
      const lh = new DataView(await file.slice(localOff, localOff + 30).arrayBuffer());
      const start = localOff + 30 + u16(lh, 26) + u16(lh, 28);
      const blob = file.slice(start, start + compSize);
      if (method === 0) return blob.text();
      if (method !== 8 || typeof DecompressionStream === 'undefined') throw new ImportError('Trình duyệt này không giải nén được. Hãy giải nén rồi chọn file activities.csv.');
      return new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new ImportError('Không thấy activities.csv trong file zip. Hãy chọn đúng gói dữ liệu Strava gửi qua email.');
}

/* ---------- Đọc CSV ---------- */

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

// "May 28, 2026, 6:12:34 AM" (giờ UTC) → ngày theo giờ máy.
function parseDate(s) {
  const m = String(s).match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/);
  let d;
  if (m && MONTHS[m[1].toLowerCase()] != null) {
    let hh = Number(m[4]) % 12; if (m[7] === 'PM') hh += 12; if (!m[7]) hh = Number(m[4]);
    d = new Date(Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]), hh, Number(m[5]), Number(m[6])));
  } else d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : iso(d);
}

const toNum = (s) => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

export function workoutsFromCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new ImportError('File không có buổi tập nào.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const all = (name) => head.reduce((a, h, i) => (h === name ? [...a, i] : a), []);
  const iId = col('activity id'), iDate = col('activity date'), iName = col('activity name'), iType = col('activity type');
  const dists = all('distance'), iMoving = col('moving time'), iElapsed = col('elapsed time');
  if (iDate < 0 || iType < 0 || !dists.length) throw new ImportError('File không đúng định dạng activities.csv của Strava.');
  const out = []; let skipped = 0;
  for (const r of rows.slice(1)) {
    const type = TYPE_MAP[String(r[iType] || '').replace(/\s|_/g, '').toLowerCase()];
    const date = parseDate(r[iDate]);
    // Cột Distance thứ hai (nếu có) tính bằng mét, chính xác hơn cột đầu (km hoặc dặm tùy cài đặt).
    let km = dists.length > 1 ? toNum(r[dists[dists.length - 1]]) / 1000 : toNum(r[dists[0]]);
    if (!type || !date || !km || km <= 0) { skipped++; continue; }
    km = +km.toFixed(2);
    const secs = toNum(r[iMoving]) ?? toNum(r[iElapsed]) ?? 0;
    const id = iId >= 0 && r[iId] ? r[iId] : `${date}-${km}`;
    out.push({ id: `strava-${id}`, date, type, km, minutes: Math.round(secs / 60), name: r[iName] || (type === 'run' ? 'Chạy bộ' : 'Đi bộ'), source: 'strava' });
  }
  return { workouts: out, skipped };
}

export async function importStravaFile(file) {
  const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
  const text = isZip ? await csvFromZip(file) : await file.text();
  return workoutsFromCsv(text);
}
