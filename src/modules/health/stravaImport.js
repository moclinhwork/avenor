// Nhập buổi tập từ gói dữ liệu Strava tải về (Settings → My Account → Download or Delete Your Account).
// Nhận file .zip nguyên gói (chỉ đọc phần activities.csv, không nạp cả gói vào bộ nhớ) hoặc file activities.csv.

import { iso } from '../../core/format.js';
import { classify, sportOf } from './sports.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export class ImportError extends Error {}

/* ---------- Đọc zip ---------- */

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

const u64 = (v, o) => v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;

async function csvFromZip(file) {
  const tailSize = Math.min(file.size, 65557);
  const tailStart = file.size - tailSize;
  const tail = new DataView(await file.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ImportError('File zip bị hỏng hoặc tải chưa xong. Hãy tải lại file từ email Strava.');
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  // Gói lớn (ZIP64): đọc vị trí thư mục trung tâm từ bản ghi ZIP64.
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || u16(tail, eocd + 10) === 0xffff) {
    const loc = eocd - 20;
    if (loc < 0 || u32(tail, loc) !== 0x07064b50) throw new ImportError('Không đọc được gói zip này. Hãy giải nén rồi chọn file activities.csv.');
    const recOff = u64(tail, loc + 8);
    const rec = new DataView(await file.slice(recOff, recOff + 56).arrayBuffer());
    cdSize = u64(rec, 40); cdOffset = u64(rec, 48);
  }
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50;) {
    const method = u16(cd, p + 10);
    let compSize = u32(cd, p + 20);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let localOff = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    if (/(^|\/)activities\.csv$/i.test(name)) {
      // Trường ZIP64 trong extra (id 0x0001): kích thước gốc, kích thước nén, vị trí.
      for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen;) {
        const id = u16(cd, e), len = u16(cd, e + 2);
        if (id === 1) {
          let q = e + 4;
          if (u32(cd, p + 24) === 0xffffffff) q += 8;
          if (compSize === 0xffffffff) { compSize = u64(cd, q); q += 8; }
          if (localOff === 0xffffffff) localOff = u64(cd, q);
        }
        e += 4 + len;
      }
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

export function parseCsv(text, delim = ',') {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

// "May 28, 2026, 6:12:34 AM" (giờ UTC) → ngày theo giờ máy. Cũng nhận 2026-05-28 và 28/05/2026 (Excel).
function parseDate(s) {
  const t = String(s).trim();
  const m = t.match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/);
  let d = null;
  if (m && MONTHS[m[1].toLowerCase()] != null) {
    let hh = Number(m[4]);
    if (m[7]) hh = (hh % 12) + (m[7] === 'PM' ? 12 : 0);
    d = new Date(Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]), hh, Number(m[5]), Number(m[6])));
  } else {
    const isoM = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    const dmyM = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoM) d = new Date(Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3], +(isoM[4] || 0), +(isoM[5] || 0)));
    else if (dmyM) {
      let [dd, mm] = [+dmyM[1], +dmyM[2]];
      if (mm > 12 && dd <= 12) [dd, mm] = [mm, dd];
      d = new Date(Date.UTC(+dmyM[3], mm - 1, dd, +(dmyM[4] || 0), +(dmyM[5] || 0)));
    } else d = genericDate(t);
  }
  return !d || Number.isNaN(d.getTime()) ? null : iso(d);
}

// Ngày viết theo ngôn ngữ khác, ví dụ "15 thg 11, 2026, 10:05:10 CH" hay "15 tháng 11 2026 22:05".
function genericDate(t) {
  const nums = (t.match(/\d+/g) || []).map(Number);
  const yi = nums.findIndex((n) => n >= 1900 && n <= 2100);
  if (yi < 0) { const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d; }
  let y = nums[yi], dd, mm, rest;
  if (yi >= 2) { [dd, mm] = [nums[yi - 2], nums[yi - 1]]; rest = nums.slice(yi + 1); }
  else if (yi === 0 && nums.length >= 3) { [mm, dd] = [nums[1], nums[2]]; rest = nums.slice(3); }
  else return null;
  if (mm > 12 && dd <= 12) [dd, mm] = [mm, dd];
  if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  let [hh = 0, mi = 0, ss = 0] = rest;
  if (/\b(PM|CH|chiều|tối)\b/i.test(t) && hh < 12) hh += 12;
  if (/\b(AM|SA|sáng)\b/i.test(t) && hh === 12) hh = 0;
  return new Date(Date.UTC(y, mm - 1, dd, hh, mi, ss));
}

// "5123.4", "5,123.4", "5123,4", "5.123,4" → số.
const toNum = (v) => {
  let x = String(v ?? '').trim().replace(/\s/g, '');
  if (!x) return null;
  if (x.includes(',') && x.includes('.')) x = x.lastIndexOf(',') > x.lastIndexOf('.') ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
  else if (x.includes(',')) x = /,\d{3}$/.test(x) && !/^0,/.test(x) ? x.replace(/,/g, '') : x.replace(',', '.');
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
};

// Tên cột theo nhiều ngôn ngữ; không khớp thì dùng vị trí cột cố định của Strava.
const HEAD = {
  id: /^(activity id|id)/i,
  date: /(activity date|date|ngày|datum|fecha|data)/i,
  name: /(activity name|name|tên|nom|nombre|nome)/i,
  type: /(activity type|type|loại|typ|tipo|sport)/i,
  elapsed: /(elapsed time|elapsed|thời gian thực tế|thời gian trôi qua|thời gian trôi qua|temps écoulé|verstrichene|tiempo transcurrido)/i,
  moving: /(moving time|thời gian di chuyển|thời gian vận động|thời gian di chuyển|temps de déplacement|bewegungszeit|tiempo en movimiento)/i,
  distance: /(distance|quãng đường|khoảng cách|distanz|distancia|distanza)/i,
};

export function workoutsFromCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const first = clean.slice(0, clean.indexOf('\n') > 0 ? clean.indexOf('\n') : 2000);
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = parseCsv(clean, delim);
  if (rows.length < 2) throw new ImportError('File không có buổi tập nào.');
  const head = rows[0].map((h) => h.trim());
  const find = (re) => head.findIndex((h) => re.test(h));
  const findAll = (re) => head.reduce((a, h, i) => (re.test(h) ? [...a, i] : a), []);
  let iId = find(HEAD.id), iDate = find(HEAD.date), iName = find(HEAD.name), iType = find(HEAD.type);
  let dists = findAll(HEAD.distance); const iMoving = find(HEAD.moving); let iElapsed = find(HEAD.elapsed);
  // Vị trí cố định trong activities.csv: 0 ID, 1 ngày, 2 tên, 3 loại, 5 thời gian, 6 quãng đường.
  if ((iDate < 0 || iType < 0 || !dists.length) && head.length >= 7 && rows.slice(1, 6).every((r) => parseDate(r[1]))) {
    iId = 0; iDate = 1; iName = 2; iType = 3; iElapsed = 5; dists = [6];
  }
  if (iDate < 0 || iType < 0 || !dists.length) {
    throw new ImportError(`File không đúng định dạng activities.csv của Strava. Các cột đầu: "${head.slice(0, 8).join(' | ')}". Hãy gửi dòng này cho Claude để chỉnh.`);
  }
  const out = []; let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate]);
    if (!date) { skipped++; continue; }
    const type = classify(r[iType]);
    // Cột Distance thứ hai (nếu có) tính bằng mét, chính xác hơn cột đầu (km hoặc dặm tùy cài đặt).
    const meters = dists.length > 1 ? toNum(r[dists[dists.length - 1]]) : null;
    const km = Math.max(0, +((meters != null ? meters / 1000 : toNum(r[dists[0]])) || 0).toFixed(2));
    const secs = toNum(r[iMoving]) ?? toNum(r[iElapsed]) ?? 0;
    const id = iId >= 0 && r[iId] ? r[iId] : `${date}-${type}-${km}-${secs}`;
    out.push({ id: `strava-${id}`, date, type, km, minutes: Math.round(secs / 60), name: r[iName] || sportOf(type).label, source: 'strava', sport: String(r[iType] || '').trim() });
  }
  if (!out.length) throw new ImportError(`Không đọc được hoạt động nào trong ${rows.length - 1} dòng. Các cột đầu: "${head.slice(0, 8).join(' | ')}". Ngày ở dòng đầu: "${rows[1]?.[iDate] ?? ''}". Hãy gửi dòng này cho Claude để chỉnh.`);
  return { workouts: out, skipped };
}

export async function importStravaFile(file) {
  // Nhận diện zip theo 2 byte đầu "PK" (trên Android tên file có thể không có đuôi .zip).
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isZip = (magic[0] === 0x50 && magic[1] === 0x4b) || /\.zip$/i.test(file.name);
  const text = isZip ? await csvFromZip(file) : await file.text();
  return workoutsFromCsv(text);
}
