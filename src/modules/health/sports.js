// Các môn tập và cách nhận diện loại hoạt động Strava (tiếng Anh, tiếng Việt và vài ngôn ngữ khác).

export const SPORTS = {
  run: { label: 'Chạy bộ', color: 'var(--mint)', icon: 'bolt', km: true },
  walk: { label: 'Đi bộ', color: 'var(--lav)', icon: 'pin', km: true },
  ride: { label: 'Đạp xe', color: 'var(--sky)', icon: 'repeat', km: true },
  ebike: { label: 'Đạp xe điện', color: '#7b8fc7', icon: 'repeat', km: true },
  swim: { label: 'Bơi lội', color: '#3d9aa8', icon: 'drop', km: true },
  workout: { label: 'Tập luyện', color: 'var(--amber)', icon: 'dumbbell', km: false },
};
export const SPORT_ORDER = ['run', 'walk', 'ride', 'ebike', 'swim', 'workout'];
export const sportOf = (type) => SPORTS[type] || SPORTS.workout;

const KEYS = {
  run: 'run', trailrun: 'run', virtualrun: 'run',
  walk: 'walk', hike: 'walk',
  ride: 'ride', virtualride: 'ride', mountainbikeride: 'ride', gravelride: 'ride', handcycle: 'ride', velomobile: 'ride',
  ebikeride: 'ebike', emountainbikeride: 'ebike',
  swim: 'swim',
};
const WORDS = [
  [/(đạp xe điện|xe đạp điện|e-?bike|vélo électrique|e-bike)/i, 'ebike'],
  [/(chạy|^run|running|course|laufen|lauf|carrera|corsa|corrida|hardlopen)/i, 'run'],
  [/(đi bộ|leo núi|^walk|walking|^hike|hiking|marche|randonnée|gehen|wandern|caminata|caminar|senderismo|camminata|escursionismo|caminhada|wandelen)/i, 'walk'],
  [/(đạp xe|xe đạp|^ride|cycling|bike|vélo|radfahrt|rad|ciclismo|bicicleta|fietsen)/i, 'ride'],
  [/(bơi|^swim|swimming|natation|schwimmen|natación|nuoto|natação|zwemmen)/i, 'swim'],
];

// Loại hoạt động lạ (tập tạ, yoga, tập luyện…) vẫn được nhận, gom vào "Tập luyện".
export function classify(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'workout';
  const k = KEYS[s.replace(/[\s_-]/g, '').toLowerCase()];
  if (k) return k;
  const hit = WORDS.find(([re]) => re.test(s));
  return hit ? hit[1] : 'workout';
}
