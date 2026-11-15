import { useEffect, useState } from 'react';

// Điều hướng bằng hash (#health, #finance…) để mỗi module có đường dẫn riêng.
export function useRoute(fallback) {
  const read = () => (window.location.hash || '').replace('#', '') || fallback;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (id) => { window.location.hash = id; };
