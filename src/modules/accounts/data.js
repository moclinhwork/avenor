import { addDays, daysFromToday, iso, TODAY, todayIso } from '../../core/format.js';
import { SERVER } from '../../core/platform.js';

// Module Accounts: mỗi tài khoản, kênh, tài khoản ngân hàng là một hồ sơ (Account).
// Quan hệ "has-access", "signs-in-with", "related" lưu trong `links`;
// quan hệ email khôi phục lấy trực tiếp từ account.recovery.emails (một nguồn dữ liệu duy nhất).
// Không bao giờ lưu mật khẩu thật: chỉ có passwordHint (gợi nhớ) và passwordRef (tùy chọn).

export const KINDS = {
  email: { label: 'Email', icon: 'mail', login: 'Email address' },
  social: { label: 'Social & Messaging', icon: 'users', login: 'Login (email, phone or username)' },
  channel: { label: 'Channels & Pages', icon: 'video', login: 'Handle or login' },
  bank: { label: 'Banking', icon: 'bank', login: 'App login / username' },
  other: { label: 'Other', icon: 'grid', login: 'Login (email, phone or username)' },
};

export const STATUSES = [
  { id: 'active', label: 'Active', tone: 'good' },
  { id: 'inactive', label: 'Inactive', tone: '' },
  { id: 'locked', label: 'Locked', tone: 'rose' },
  { id: 'closed', label: 'Closed', tone: '' },
];
export const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

export const TWO_FA_METHODS = [
  { id: 'app', label: 'Authenticator app' },
  { id: 'sms', label: 'SMS' },
  { id: 'passkey', label: 'Passkey' },
  { id: 'key', label: 'Security key' },
  { id: 'email', label: 'Email code' },
  { id: 'backup', label: 'Backup codes' },
];
export const ROLES = ['Owner', 'Manager', 'Editor', 'Viewer'];
export const MANAGERS = ['Bitwarden', '1Password', 'Google Password Manager', 'iCloud Keychain', 'Other'];
export const BANK_TYPES = ['Payment account', 'Savings', 'Credit card', 'E-wallet'];
export const LOGIN_METHODS = ['Password', 'Sign in with Google', 'Sign in with Apple', 'Phone OTP'];
export const TAG_COLORS = ['rust', 'sage', 'sky', 'amber', 'stone'];
export const PARTY_TYPES = [{ id: 'person', label: 'Person' }, { id: 'organization', label: 'Organization' }, { id: 'group', label: 'Group' }];

export const LINK_TYPES = {
  'has-access': { label: 'Has access', from: 'Manages', to: 'Access', role: true },
  'signs-in-with': { label: 'Signs in with', from: 'Used to sign in to', to: 'Signs in with' },
  related: { label: 'Related', from: 'Related', to: 'Related' },
};

const CATS = [
  { id: 'email', name: 'Email', kind: 'email', builtIn: true },
  { id: 'social', name: 'Social & Messaging', kind: 'social', builtIn: true },
  { id: 'channel', name: 'Channels & Pages', kind: 'channel', builtIn: true },
  { id: 'bank', name: 'Banking', kind: 'bank', builtIn: true, reviewDays: 90 },
  { id: 'other', name: 'Other', kind: 'other', builtIn: true },
];
const PLATFORMS = [
  ['google', 'email', 'Google'], ['outlook', 'email', 'Outlook'], ['mail-other', 'email', 'Other email'],
  ['facebook', 'social', 'Facebook'], ['zalo', 'social', 'Zalo'], ['tiktok', 'social', 'TikTok'], ['instagram', 'social', 'Instagram'],
  ['youtube', 'channel', 'YouTube'], ['fbpage', 'channel', 'Facebook Page'], ['zalooa', 'channel', 'Zalo OA'],
  ['bank-generic', 'bank', 'Bank'], ['ewallet', 'bank', 'E-wallet'],
  ['other-generic', 'other', 'Other service'],
].map(([id, categoryId, name]) => ({ id, categoryId, name }));
const PURPOSES = [{ id: 'personal', name: 'Personal' }, { id: 'work', name: 'Work' }, { id: 'family', name: 'Family spending' }, { id: 'archive', name: 'Archive' }];

const empty = {
  categories: CATS, platforms: PLATFORMS,
  parties: [{ id: 'me', name: 'Me', type: 'person', isMe: true }],
  purposes: PURPOSES, tags: [], accounts: [], links: [],
  reviewDays: 180, pin: null,
};

/* ---------- Dữ liệu mẫu (chỉ bản demo; bản tự host bắt đầu trống) ---------- */
const ago = (n) => iso(addDays(TODAY, -n));
const acc = (o) => ({
  loginId: '', profileUrl: '', externalId: '', ownerId: 'me', managerIds: ['me'], purposeId: 'personal', tagIds: [], status: 'active',
  recovery: { emails: [], phones: [] }, twoFactor: { state: 'on', methods: ['app'] }, passwordHint: '', passwordRef: null,
  createdOn: '', createdOnApprox: false, lastReviewedOn: ago(20), notes: '', fields: {}, ...o,
});
const sample = {
  ...empty,
  parties: [{ id: 'me', name: 'Mộc Linh', type: 'person', isMe: true }, { id: 'studio', name: 'Avenor Studio', type: 'organization' }, { id: 'fam', name: 'Family', type: 'group' }],
  tags: [{ id: 'ml', name: 'Mộc Linh', color: 'rust' }, { id: 'av', name: 'Avenor', color: 'sage' }, { id: 'tr', name: 'Travel', color: 'sky' }, { id: 'fm', name: 'Family', color: 'amber' }, { id: 'lg', name: 'Legacy', color: 'stone' }],
  platforms: [...PLATFORMS, { id: 'lotus', categoryId: 'bank', name: 'Lotus Bank' }, { id: 'river', categoryId: 'bank', name: 'River Bank' }, { id: 'notion', categoryId: 'other', name: 'Notion' }, { id: 'canva', categoryId: 'other', name: 'Canva' }],
  accounts: [
    acc({ id: 'gm1', label: 'Personal Gmail', categoryId: 'email', platformId: 'google', loginId: 'linh.moc.dev@gmail.com', profileUrl: 'myaccount.google.com', tagIds: ['ml'], recovery: { emails: [{ accountId: 'ol1' }], phones: ['+84 903 118 725'] }, twoFactor: { state: 'on', methods: ['passkey', 'app', 'backup'] }, passwordHint: 'mèo nhà ngoại + năm vào đại học + !', passwordRef: { manager: 'Bitwarden', item: 'Google · Personal' }, createdOn: '2014-03-01', createdOnApprox: true, lastReviewedOn: ago(17), notes: 'Main inbox since university. Move the bank OTP before changing this phone number.' }),
    acc({ id: 'gm2', label: 'Work Google', categoryId: 'email', platformId: 'google', loginId: 'studio@avenor.studio', ownerId: 'studio', purposeId: 'work', tagIds: ['av', 'ml'], recovery: { emails: [], phones: ['+84 903 118 725'] }, lastReviewedOn: ago(40) }),
    acc({ id: 'gm3', label: 'Family Gmail', categoryId: 'email', platformId: 'google', loginId: 'nha.moc.family@gmail.com', ownerId: 'fam', purposeId: 'family', tagIds: ['fm'], recovery: { emails: [{ accountId: 'gm1' }], phones: ['+84 908 552 140'] }, twoFactor: { state: 'on', methods: ['sms'] }, lastReviewedOn: ago(60) }),
    acc({ id: 'ol1', label: 'Outlook archive', categoryId: 'email', platformId: 'outlook', loginId: 'moclinh.old@outlook.com', purposeId: 'archive', tagIds: ['lg'], status: 'inactive', recovery: { emails: [], phones: ['+84 903 118 725'] }, twoFactor: { state: 'unknown', methods: [] }, lastReviewedOn: ago(300) }),
    acc({ id: 'fb1', label: 'Facebook · Personal', categoryId: 'social', platformId: 'facebook', loginId: 'linh.moc.dev@gmail.com', profileUrl: 'facebook.com/moclinh', tagIds: ['ml'], recovery: { emails: [{ accountId: 'gm1' }], phones: ['+84 903 118 725'] }, fields: { username: 'moclinh', linkedPhone: '+84 903 118 725' } }),
    acc({ id: 'ig1', label: 'Instagram · moclinh', categoryId: 'social', platformId: 'instagram', loginId: 'moclinh', profileUrl: 'instagram.com/moclinh', tagIds: ['ml', 'tr'], recovery: { emails: [{ accountId: 'gm1' }], phones: ['+84 903 118 725'] }, fields: { username: 'moclinh' } }),
    acc({ id: 'zl1', label: 'Zalo · Personal', categoryId: 'social', platformId: 'zalo', loginId: '+84 903 118 725', tagIds: ['ml'], recovery: { emails: [{ accountId: 'gm1' }], phones: ['+84 903 118 725'] }, twoFactor: { state: 'on', methods: ['sms'] }, fields: { linkedPhone: '+84 903 118 725' } }),
    acc({ id: 'tt1', label: 'TikTok · Avenor', categoryId: 'social', platformId: 'tiktok', loginId: 'avenor.studio', ownerId: 'studio', purposeId: 'work', tagIds: ['av'], recovery: { emails: [{ accountId: 'gm1' }], phones: ['+84 903 118 725'] }, twoFactor: { state: 'off', methods: [] }, fields: { username: '@avenor.studio' } }),
    acc({ id: 'yt1', label: 'YouTube · Travel Journal', categoryId: 'channel', platformId: 'youtube', profileUrl: 'youtube.com/@traveljournal.vn', externalId: 'UCx7Lq2bT9vKs8Wm3fQ', ownerId: 'studio', purposeId: 'work', tagIds: ['av', 'tr'], fields: { topic: 'Travel vlogs · Vietnam & Japan', externalManagers: [{ text: 'editor.hoa@example.com', role: 'Editor' }] } }),
    acc({ id: 'yt2', label: 'YouTube · Avenor Shorts', categoryId: 'channel', platformId: 'youtube', profileUrl: 'youtube.com/@avenorshorts', externalId: 'UCa1Shorts99xQ', ownerId: 'studio', purposeId: 'work', tagIds: ['av'], fields: { topic: 'Short clips' } }),
    acc({ id: 'fp1', label: 'Facebook Page · Avenor', categoryId: 'channel', platformId: 'fbpage', profileUrl: 'facebook.com/avenor.studio', ownerId: 'studio', purposeId: 'work', tagIds: ['av'], fields: { topic: 'Studio news' } }),
    acc({ id: 'oa1', label: 'Zalo OA · Avenor', categoryId: 'channel', platformId: 'zalooa', externalId: '4318 2290 0715', ownerId: 'studio', purposeId: 'work', tagIds: ['av'], fields: { topic: 'Customer support' } }),
    acc({ id: 'bk1', label: 'Lotus Bank · Family spending', categoryId: 'bank', platformId: 'lotus', loginId: 'moclinh.lotus', ownerId: 'fam', purposeId: 'family', tagIds: ['fm'], twoFactor: { state: 'on', methods: ['sms'] }, passwordHint: 'tên sông quê + 4 số cuối thẻ cũ', lastReviewedOn: ago(214), fields: { holderName: 'NGUYEN MOC LINH', accountNumber: '0071 0005 4821', accountType: 'Payment account', currency: 'VND', branch: 'District 3, Ho Chi Minh City', otpPhone: '+84 903 118 725' } }),
    acc({ id: 'bk2', label: 'River Bank · Savings', categoryId: 'bank', platformId: 'river', loginId: 'linhmoc', tagIds: ['ml'], twoFactor: { state: 'on', methods: ['app'] }, lastReviewedOn: ago(30), fields: { holderName: 'NGUYEN MOC LINH', accountNumber: '1903 6688 1290', accountType: 'Savings', currency: 'VND' } }),
    acc({ id: 'ew1', label: 'E-wallet · Daily', categoryId: 'bank', platformId: 'ewallet', loginId: '+84 903 118 725', tagIds: ['ml'], twoFactor: { state: 'on', methods: ['sms'] }, lastReviewedOn: ago(12), fields: { holderName: 'NGUYEN MOC LINH', accountNumber: '0903118725', accountType: 'E-wallet', currency: 'VND' } }),
    acc({ id: 'no1', label: 'Notion workspace', categoryId: 'other', platformId: 'notion', loginId: 'linh.moc.dev@gmail.com', tagIds: ['ml'], twoFactor: { state: 'unknown', methods: [] }, recovery: { emails: [{ accountId: 'gm1' }], phones: [] }, fields: { website: 'notion.so', loginMethod: 'Sign in with Google' } }),
    acc({ id: 'cv1', label: 'Canva', categoryId: 'other', platformId: 'canva', loginId: 'studio@avenor.studio', ownerId: 'studio', purposeId: 'work', tagIds: ['av'], twoFactor: { state: 'unknown', methods: [] }, recovery: { emails: [{ accountId: 'gm2' }], phones: [] }, fields: { website: 'canva.com', loginMethod: 'Sign in with Google' } }),
    acc({ id: 'fb2', label: 'Facebook · Old profile', categoryId: 'social', platformId: 'facebook', loginId: 'moclinh.old@outlook.com', tagIds: ['lg'], status: 'closed', twoFactor: { state: 'off', methods: [] }, lastReviewedOn: ago(500) }),
  ],
  links: [
    { id: 'l1', fromId: 'gm1', toId: 'yt1', type: 'has-access', role: 'Owner' },
    { id: 'l2', fromId: 'gm2', toId: 'yt1', type: 'has-access', role: 'Manager' },
    { id: 'l3', fromId: 'gm1', toId: 'yt2', type: 'has-access', role: 'Manager' },
    { id: 'l4', fromId: 'gm2', toId: 'yt2', type: 'has-access', role: 'Owner' },
    { id: 'l4b', fromId: 'gm1', toId: 'fp1', type: 'has-access', role: 'Owner' },
    { id: 'l4c', fromId: 'fb1', toId: 'oa1', type: 'has-access', role: 'Manager' },
    { id: 'l6', fromId: 'fb1', toId: 'fp1', type: 'has-access', role: 'Owner' },
    { id: 'l7', fromId: 'zl1', toId: 'oa1', type: 'has-access', role: 'Owner' },
    { id: 'l8', fromId: 'gm1', toId: 'no1', type: 'signs-in-with' },
    { id: 'l9', fromId: 'gm2', toId: 'cv1', type: 'signs-in-with' },
  ],
};

export const initial = SERVER ? empty : sample;

/* ---------- Tra cứu ---------- */
export const catOf = (d, a) => d.categories.find((c) => c.id === a.categoryId) || d.categories[d.categories.length - 1];
export const kindOf = (d, a) => catOf(d, a)?.kind || 'other';
export const platformOf = (d, a) => d.platforms.find((p) => p.id === a.platformId);
export const partyName = (d, id) => d.parties.find((p) => p.id === id)?.name || '';
export const accById = (d, id) => d.accounts.find((a) => a.id === id);
export const monogram = (d, a) => (platformOf(d, a)?.name || a.label || '?').trim()[0]?.toUpperCase() || '?';

/* ---------- Che dữ liệu nhạy cảm ---------- */
export const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
export const maskNum = (s) => { const d = String(s || '').replace(/\s/g, ''); return d ? `•••• ${d.slice(-4)}` : ''; };
export const maskPhone = (s) => { const d = digits(s); return d ? `••• ••• ${d.slice(-3)}` : ''; };
export const maskEmail = (s) => { const [u, dom] = String(s || '').split('@'); return dom ? `${u[0] || ''}•••••@${dom}` : '•••••'; };

/* ---------- Tìm kiếm ---------- */
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function matches(d, a, q) {
  const t = fold(q).trim();
  if (!t) return true;
  const f = a.fields || {};
  const text = [a.label, a.loginId, a.profileUrl, a.externalId, a.notes, f.username, f.holderName, f.topic, f.website,
    platformOf(d, a)?.name, partyName(d, a.ownerId),
    ...a.tagIds.map((id) => d.tags.find((x) => x.id === id)?.name),
    ...a.recovery.emails.map((e) => (e.accountId ? accById(d, e.accountId)?.loginId : e.text))].map(fold).join(' ');
  if (t.split(/\s+/).every((w) => text.includes(w))) return true;
  const n = digits(q);
  if (n.length >= 3) {
    const nums = [a.loginId, f.accountNumber, f.linkedPhone, f.otpPhone, a.externalId, ...a.recovery.phones].map(digits);
    return nums.some((x) => x && x.includes(n));
  }
  return false;
}

/* ---------- Quan hệ ---------- */
export function relations(d, a) {
  const L = d.links;
  const pick = (ids) => ids.map((x) => ({ ...x, acc: accById(d, x.otherId) })).filter((x) => x.acc);
  return {
    manages: pick(L.filter((l) => l.type === 'has-access' && l.fromId === a.id).map((l) => ({ link: l, otherId: l.toId, role: l.role }))),
    access: pick(L.filter((l) => l.type === 'has-access' && l.toId === a.id).map((l) => ({ link: l, otherId: l.fromId, role: l.role }))),
    recoveryFor: d.accounts.filter((x) => x.id !== a.id && x.recovery.emails.some((e) => e.accountId === a.id)).map((x) => ({ acc: x, otherId: x.id })),
    recoveredBy: pick(a.recovery.emails.filter((e) => e.accountId).map((e) => ({ otherId: e.accountId }))),
    signsInTo: pick(L.filter((l) => l.type === 'signs-in-with' && l.fromId === a.id).map((l) => ({ link: l, otherId: l.toId }))),
    signsInWith: pick(L.filter((l) => l.type === 'signs-in-with' && l.toId === a.id).map((l) => ({ link: l, otherId: l.fromId }))),
    related: pick(L.filter((l) => l.type === 'related' && (l.fromId === a.id || l.toId === a.id)).map((l) => ({ link: l, otherId: l.fromId === a.id ? l.toId : l.fromId }))),
  };
}
export const linkCount = (d, a) => { const r = relations(d, a); return Object.values(r).reduce((s, x) => s + x.length, 0) + ((a.fields?.externalManagers || []).length); };

/* ---------- Danh sách cần kiểm tra ---------- */
const LEVEL = { security: 3, access: 2, check: 1, overdue: 0 };
export const reviewDaysFor = (d, a) => catOf(d, a)?.reviewDays || d.reviewDays || 180;

export function issues(d, a) {
  if (a.status === 'closed' || a.status === 'inactive') return [];
  const k = kindOf(d, a); const out = [];
  const add = (level, text) => out.push({ level, text });
  if (a.status === 'locked') add('security', 'Account is locked');
  if (['email', 'social', 'other'].includes(k) && !a.recovery.emails.length) add('security', 'Recovery email missing');
  if (['email', 'social'].includes(k) && !a.recovery.phones.length) add('security', 'Recovery phone missing');
  if (['email', 'social', 'channel', 'bank'].includes(k) && a.twoFactor.state === 'off') add('security', 'Two-factor authentication is off');
  if (['email', 'social', 'bank'].includes(k) && a.twoFactor.state === 'unknown') add('check', '2FA status unknown');
  a.recovery.emails.forEach((e) => { const r = e.accountId && accById(d, e.accountId); if (r && (r.status === 'closed' || r.status === 'locked')) add('security', `Recovery email is ${r.status}`); });
  if (k === 'channel') {
    const owners = d.links.filter((l) => l.type === 'has-access' && l.toId === a.id && l.role === 'Owner').length;
    if (owners === 0) add('access', 'No Owner account linked');
    else if (owners === 1) add('access', 'Only one Owner account, no backup Owner');
  }
  const days = reviewDaysFor(d, a);
  if (!a.lastReviewedOn) add('overdue', 'Never reviewed');
  else { const n = -daysFromToday(a.lastReviewedOn); if (n > days) add('overdue', `Not reviewed in ${n} days · rule ${days} days`); }
  return out.sort((x, y) => LEVEL[y.level] - LEVEL[x.level]);
}
export const LEVEL_LABEL = { security: ['Security', 'rose'], access: ['Access', 'amber'], check: ['Check', 'amber'], overdue: ['Overdue', 'amber'] };
export const reviewList = (d) => d.accounts.map((a) => ({ a, list: issues(d, a) })).filter((x) => x.list.length)
  .sort((x, y) => LEVEL[y.list[0].level] - LEVEL[x.list[0].level] || x.a.label.localeCompare(y.a.label));

export const blankAccount = (d, categoryId, platformId) => ({
  id: '', label: '', categoryId, platformId, loginId: '', profileUrl: '', externalId: '',
  ownerId: d.parties.find((p) => p.isMe)?.id || d.parties[0]?.id || '', managerIds: [], purposeId: '', tagIds: [], status: 'active',
  recovery: { emails: [], phones: [] }, twoFactor: { state: 'unknown', methods: [] }, passwordHint: '', passwordRef: null,
  createdOn: '', createdOnApprox: false, lastReviewedOn: todayIso, notes: '', fields: {},
});

/** Tìm hồ sơ trùng theo login hoặc ID (không phân biệt hoa thường, bỏ khoảng trắng). */
export function duplicateOf(d, a) {
  const n = (s) => String(s || '').replace(/\s/g, '').toLowerCase();
  return d.accounts.find((x) => x.id !== a.id && x.categoryId === a.categoryId && x.platformId === a.platformId && (
    (n(a.loginId) && n(x.loginId) === n(a.loginId)) || (n(a.externalId) && n(x.externalId) === n(a.externalId))));
}
