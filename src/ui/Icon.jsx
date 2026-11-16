import { useId } from 'react';

// Bộ biểu tượng nét mảnh (stroke 1.8), vẽ tay theo lưới 24px.
const P = {
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" /></>,
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  pause: <path d="M8.5 5v14M15.5 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20.5 20.5-4.8-4.8" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10" rx="1.5" /><path d="M2.5 18.5h19" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  inbox: <><path d="M3.5 13.5 6 5h12l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" /><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  tag: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0Z" /><circle cx="8" cy="8" r="1.3" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></>,
  today: <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="m8.5 15 2.3 2.2 4.7-4.7" /></>,
  heart: <path d="M12 20.5s-8-4.6-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.4-8 11-8 11Z" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /><path d="m15 9 5.5-5.5M17 3.5h3.5V7" /></>,
  wallet: <><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></>,
  plane: <path d="M10.2 13.8 4 12l-1 1 5 3 3 5 1-1-1.8-6.2 4.6-4.6 3.7 7.3 1.3-1.3-1.5-9 2.4-2.4a1.6 1.6 0 0 0-2.3-2.3L16 4.9 7 3.4 5.7 4.7 13 8.4Z" />,
  book: <><path d="M3 5.5C5.5 4 8.8 4 12 6c3.2-2 6.5-2 9-.5V19c-2.5-1.5-5.8-1.5-9 .5-3.2-2-6.5-2-9-.5Z" /><path d="M12 6v13.5" /></>,
  repeat: <><path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 11V9a3 3 0 0 1 3-3h14" /><path d="M7 21.5 3.5 18 7 14.5" /><path d="M20.5 13v2a3 3 0 0 1-3 3h-14" /></>,
  file: <><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8Z" /><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5" /></>,
  journal: <><path d="M5 3.5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5Z" /><path d="M8.5 3.5v17M12 8h4M12 11.5h4" /></>,
  cap: <><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5Z" /><path d="M6.5 11v5c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5M21.5 9v5" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevR: <path d="m9.5 6 6 6-6 6" />,
  chevL: <path d="m14.5 6-6 6 6 6" />,
  chevD: <path d="m6 9.5 6 6 6-6" />,
  cal: <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  scale: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 9a5.5 5.5 0 0 1 8 0l-2.5 2.5h-3Z" /></>,
  ruler: <><path d="M8 3.5h8v17H8Z" /><path d="M8 7.5h3M8 11h4M8 14.5h3M8 18h4" /></>,
  waist: <><ellipse cx="12" cy="12" rx="8.5" ry="4" /><path d="M7 10.5v3M12 10v4M17 10.5v3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4.5h11l-2 4 2 4H5" /></>,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z" />,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 9.5h19M6.5 15h4" /></>,
  bag: <><rect x="4" y="7.5" width="16" height="13" rx="3" /><path d="M9 7.5V5.5a3 3 0 0 1 6 0v2" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  drop: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />,
  bolt: <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12Z" />,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  pen: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" />,
  trend: <path d="m3.5 17 6-6 4 4 7-7.5M15 7.5h5.5V13" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  pie: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z" /><path d="M15 2.8A8.5 8.5 0 0 1 21.2 9H15Z" /></>,
  passport: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><circle cx="12" cy="10.5" r="3.2" /><path d="M9 17h6" /></>,
  car: <><path d="M4.5 16.5V12l2-5h11l2 5v4.5" /><path d="M3.5 12h17v4.5h-17ZM7 19.5v-3M17 19.5v-3" /></>,
  sub: <><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="m10 9.5 4.5 2.5-4.5 2.5Z" /></>,
  home2: <><path d="M4 10.5 12 4l8 6.5V20H4Z" /><path d="M10 20v-5h4v5" /></>,
  lab: <><path d="M9.5 3.5h5M10 3.5v6L4.8 18.3A1.5 1.5 0 0 0 6.1 20.5h11.8a1.5 1.5 0 0 0 1.3-2.2L14 9.5v-6" /><path d="M7.5 14.5h9" /></>,
  code: <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5" /><path d="M20 3.5v5h-5" /></>,
  sparkle: <path d="M12 3c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7Z" />,
  coffee: <><path d="M4.5 8.5h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z" /><path d="M16.5 10h1.5a2.5 2.5 0 0 1 0 5h-1.7M8 2.5v3M12 2.5v3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.3 6.6A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  back: <path d="M20 12H4.5M10.5 5.5 4 12l6.5 6.5" />,
  more: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
  arrowUR: <path d="M7 17 17 7M9 7h8v8" />,
  arrowDR: <path d="M7 7l10 10M17 9v8H9" />,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.3 4.6-4.8" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.8, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {P[name] || P.sparkle}
    </svg>
  );
}

export function Logo({ size = 26 }) {
  const gid = `lg-${useId().replace(/:/g, '')}`;
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9785a" /><stop offset="1" stopColor="#7a2c1f" />
        </linearGradient>
      </defs>
      <path d="M16 3 29 28h-7.4L16 16.4 10.4 28H3Z" fill={`url(#${gid})`} />
      <path d="M16 16.4 21.6 28h-4.2L16 25l-1.4 3h-4.2Z" fill="#4e1a10" opacity="0.9" />
    </svg>
  );
}
