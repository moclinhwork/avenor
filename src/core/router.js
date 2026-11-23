import { useEffect, useState } from 'react';

// Điều hướng bằng hash (#health, #finance…) để mỗi module có đường dẫn riêng.
export function useRoute(fallback) {
  const read = () => (window.location.hash || '').replace('#', '').split('?')[0] || fallback;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (id) => { window.location.hash = id; };

// Tham số sau dấu "?" của hash (#health?tab=guidelines&v=detail…), cập nhật khi hash đổi.
export const hashQuery = () => new URLSearchParams((window.location.hash || '').split('?')[1] || '');
export function useHashQuery() {
  const [q, setQ] = useState(hashQuery);
  useEffect(() => {
    const on = () => setQ(hashQuery());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return q;
}
