// Quản trị tài khoản trên máy chủ (chạy trong container):
//   node server/admin.mjs list
//   node server/admin.mjs set-password <tên>   (mật khẩu đọc từ stdin; tạo tài khoản nếu chưa có)
import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(path.join(process.env.DATA_DIR || 'data', 'avenor.db'));
const [cmd, name] = process.argv.slice(2);
function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
if (cmd === 'list') {
  for (const u of db.prepare('SELECT id, username, created FROM users ORDER BY created').all()) {
    const docs = db.prepare('SELECT COUNT(*) AS n FROM docs WHERE user_id = ?').get(u.id).n;
    console.log(`${u.username}\ttạo lúc ${new Date(u.created).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}\t${docs} module dữ liệu`);
  }
} else if (cmd === 'set-password' && name) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const pw = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  if (pw.length < 8) { console.error('Mật khẩu cần ít nhất 8 ký tự.'); process.exit(1); }
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (row) {
    db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPass(pw), row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    console.log(`Đã đặt lại mật khẩu cho ${name}.`);
  } else {
    db.prepare('INSERT INTO users (id, username, pass, created) VALUES (?, ?, ?, ?)').run(crypto.randomBytes(12).toString('base64url'), name, hashPass(pw), Date.now());
    console.log(`Đã tạo tài khoản ${name}.`);
  }
} else {
  console.log('Cách dùng: node server/admin.mjs list | set-password <tên>');
}
