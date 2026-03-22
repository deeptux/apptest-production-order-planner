import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlan } from '../context/PlanContext';
import { buildSkuBatchOrderMap, compareRowsScheduleOrder } from '../utils/planDisplay';

const BAR_COLOR = '#8b4513';

// Match Gantt: pull chart left so bar area aligns under subtitle ("Planned Output by Product").
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// Bar length = Batch Qty (theorOutput) per plan row — not Total Qty (soQty), which is duplicated on every split batch.
export function OutputByProductChart({ maxRows, filterProductionLineId }) {
  const { rows: fullRows } = usePlan();
  const lineFilteredRows = filterProductionLineId
    ? fullRows.filter((r) => r.productionLineId === filterProductionLineId)
    : fullRows;

  const skuBatchOrderMap = useMemo(
    () => buildSkuBatchOrderMap(lineFilteredRows),
    [lineFilteredRows]
  );

  const rows = useMemo(() => {
    const nonBreak = lineFilteredRows.filter((r) => !r.isBreak);
    const ordered = [...nonBreak].sort(compareRowsScheduleOrder);
    return typeof maxRows === 'number' && maxRows > 0 ? ordered.slice(0, maxRows) : ordered;
  }, [lineFilteredRows, maxRows]);

  const isDesktop = useIsDesktop();

  const data = rows.map((row) => {
    const tag = skuBatchOrderMap[row.id];
    const base = row.product ?? '—';
    const productLabel = tag ? `${base} — ${tag}` : base;
    const stored = row.theorOutput;
    const batchQty =
      stored !== undefined && stored !== '' && !Number.isNaN(Number(stored)) ? Number(stored) : null;
    const output = batchQty != null && batchQty >= 0 ? batchQty : Number(row.soQty) || 0;
    return {
      product: productLabel,
      output,
      value: output,
    };
  });

  // Same approach as Production Gantt: responsive left margin and Y-axis width for all screen sizes.
  const leftMargin = isDesktop ? 24 : 12;
  const yAxisWidth = isDesktop ? 80 : 64;

  return (
    <div className="bg-surface-card-warm rounded-card shadow-card p-4 border border-gray-100">
      <h3 className="text-chart-title sm:text-sm-chart-title md:text-md-chart-title 2xl:text-[1.25rem] text-gray-800">Output by Product</h3>
      <p className="text-chart-subtitle sm:text-sm-chart-subtitle md:text-md-chart-subtitle 2xl:text-[1rem] mt-0.5">Planned Output by Product</p>
      <div className="mt-4 w-full min-h-[240px] 2xl:min-h-[280px]">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 48, left: leftMargin, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="product" width={yAxisWidth} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [value, 'Batch Qty']} />
            <Bar dataKey="output" fill={BAR_COLOR} name="Output" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v) => v }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
