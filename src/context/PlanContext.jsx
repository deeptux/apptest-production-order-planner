import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Realistic mock rows aligned with Process Duration.xlsx (NPB reference).
 * endDough = end of Mixing; endBatch = end of Packaging. Times consistent with SKU stage durations.
 */
const MOCKUP_ROWS = [
  { id: '1', product: 'Everyday Bread 8s', soQty: 2572, theorOutput: 728, capacity: 1575, procTime: 502, startSponge: '22:00', endDough: '02:42', endBatch: '06:22', batch: '1st' },
  { id: '2', product: 'Everyday Bread 12s', soQty: 2173, theorOutput: 1092, capacity: 2340, procTime: 507, startSponge: '02:50', endDough: '07:32', endBatch: '11:17', batch: '1st' },
  { id: '3', product: 'Whole Wheat 8s', soQty: 1090, theorOutput: 536, capacity: 1575, procTime: 517, startSponge: '07:40', endDough: '12:27', endBatch: '16:17', batch: '1st' },
  { id: '4', product: 'Raisin 8s', soQty: 500, theorOutput: 687, capacity: 1575, procTime: 555, startSponge: '12:30', endDough: '17:32', endBatch: '22:05', batch: '1st' },
];

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [planDate, setPlanDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem('loaf-plan-rows');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return MOCKUP_ROWS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('loaf-plan-rows', JSON.stringify(rows));
    } catch (_) {}
  }, [rows]);

  const updatePlanDate = useCallback((date) => {
    setPlanDate(typeof date === 'function' ? date() : date);
  }, []);

  const addBatch = useCallback(() => {
    setRows((prev) => [...prev, { id: String(Date.now()), product: 'New batch', soQty: 0, theorOutput: 0, capacity: 1575, procTime: 502, startSponge: '00:00', endDough: '00:00', endBatch: '00:00', batch: '1st' }]);
  }, []);

  const reorderRows = useCallback((fromIndex, toIndex) => {
    setRows((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, removed);
      return copy;
    });
  }, []);

  const value = {
    planDate,
    setPlanDate: updatePlanDate,
    rows,
    setRows,
    addBatch,
    reorderRows,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
