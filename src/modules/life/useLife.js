import { useEffect, useMemo } from 'react';
import { useStore } from '../../core/store.jsx';
import { lifeScore, withSnapshot } from '../../core/life.js';

// Tính Life Score từ state và lưu ảnh chụp điểm của hôm nay (mỗi ngày một bản, cập nhật khi điểm đổi).
export function useLife() {
  const { state, update } = useStore();
  const life = state.life || { weights: {}, snaps: {}, brief: null };
  const ls = useMemo(() => lifeScore(state, life.weights || {}), [state]);
  useEffect(() => {
    const next = withSnapshot(life.snaps || {}, ls);
    if (next !== (life.snaps || {})) update('life', (s) => ({ ...(s || {}), snaps: next }));
  }, [ls.total, JSON.stringify(ls.domains.map((d) => d.score))]);
  return { state, update, life, ls };
}
