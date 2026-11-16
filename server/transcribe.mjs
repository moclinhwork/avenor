// Chép lời bản ghi âm bằng whisper.cpp chạy ngay trên máy chủ (miễn phí, không gửi âm thanh ra ngoài).
// Cần: ffmpeg và whisper-cli (Dockerfile đã cài). Mô hình tải một lần vào DATA_DIR/models.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MODEL = process.env.WHISPER_MODEL || 'small';
const LANG = process.env.WHISPER_LANG || 'vi';
const BIN = process.env.WHISPER_BIN || 'whisper-cli';
const MODEL_URL = (name) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.stdout.on('data', () => {});
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} quá thời gian`)); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(t); reject(e.code === 'ENOENT' ? new Error(`thiếu chương trình ${cmd}`) : e); });
    p.on('close', (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`${cmd} lỗi (${code}): ${err.trim().split('\n').slice(-2).join(' ')}`)); });
  });
}

let modelReady = null;
async function ensureModel(dataDir) {
  const dir = path.join(dataDir, 'models');
  const file = path.join(dir, `ggml-${MODEL}.bin`);
  if (fs.existsSync(file) && fs.statSync(file).size > 10e6) return file;
  if (!modelReady) {
    modelReady = (async () => {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Đang tải mô hình Whisper ${MODEL}…`);
      const r = await fetch(MODEL_URL(MODEL)).catch(() => { throw new Error('máy chủ không tải được mô hình chép lời (mạng)'); });
      if (!r.ok) throw new Error(`không tải được mô hình (${r.status})`);
      const tmp = `${file}.part`;
      await fs.promises.writeFile(tmp, Buffer.from(await r.arrayBuffer()));
      fs.renameSync(tmp, file);
      console.log('Đã tải xong mô hình Whisper.');
      return file;
    })().finally(() => { modelReady = null; });
  }
  return modelReady;
}

export async function transcribeFile(dataDir, audioFile) {
  const model = await ensureModel(dataDir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avenor-stt-'));
  try {
    const wav = path.join(tmp, 'a.wav');
    await run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', audioFile, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], 120e3);
    const threads = String(Math.max(1, Math.min(4, os.cpus().length)));
    await run(BIN, ['-m', model, '-f', wav, '-l', LANG, '-t', threads, '-nt', '-np', '-otxt', '-of', path.join(tmp, 'out')], 15 * 60e3);
    const text = fs.readFileSync(path.join(tmp, 'out.txt'), 'utf8').replace(/\s+/g, ' ').trim();
    return text;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Hàng đợi một luồng: chép lần lượt để VPS không quá tải.
export function makeQueue(work) {
  const q = []; let busy = false;
  const next = async () => {
    if (busy || !q.length) return;
    busy = true;
    const id = q.shift();
    try { await work(id); } catch (e) { console.error('transcribe', e); }
    busy = false; next();
  };
  return (id) => { if (!q.includes(id)) q.push(id); next(); };
}
