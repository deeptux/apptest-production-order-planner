import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { usePlan } from '../context/PlanContext';
import { compareRowsScheduleOrder } from '../utils/planDisplay';

const BAR_COLOR = '#8b4513';

// same margin tweak as gantt so the plot lines up under the card subtitle
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

// bar value = theorOutput (batch size). soQty is the same on every split row so never use it here.
export function OutputByProductChart({ maxRows, filterProductionLineId }) {
  const { rows: fullRows } = usePlan();
  const lineFilteredRows = filterProductionLineId
    ? fullRows.filter((r) => r.productionLineId === filterProductionLineId)
    : fullRows;

  const rows = useMemo(() => {
    const nonBreak = lineFilteredRows.filter((r) => !r.isBreak);
    const ordered = [...nonBreak].sort(compareRowsScheduleOrder);
    return typeof maxRows === 'number' && maxRows > 0 ? ordered.slice(0, maxRows) : ordered;
  }, [lineFilteredRows, maxRows]);

  const isDesktop = useIsDesktop();

  // y-axis is just product name (duplicate labels ok — bars differ by length / right-side label)
  const data = rows.map((row) => {
    const stored = row.theorOutput;
    const batchQty =
      stored !== undefined && stored !== '' && !Number.isNaN(Number(stored)) ? Number(stored) : null;
    const output = batchQty != null && batchQty >= 0 ? batchQty : Number(row.soQty) || 0;
    return {
      product: row.product ?? '—',
      output,
      value: output,
    };
  });

  const leftMargin = isDesktop ? 24 : 12;
  const yAxisWidth = isDesktop ? 80 : 64;

  return (
    <div className="bg-surface-card-warm rounded-card shadow-card p-4 border border-gray-100">
      <h3 className="text-chart-title sm:text-sm-chart-title md:text-md-chart-title 2xl:text-[1.25rem] text-gray-800">Output by Product</h3>
      <p className="text-chart-subtitle sm:text-sm-chart-subtitle md:text-md-chart-subtitle 2xl:text-[1rem] mt-0.5">Planned Output by Product</p>
      {typeof maxRows === 'number' && maxRows > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] sm:text-xs text-gray-700">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
            Top {maxRows} upcoming batches
          </span>
          <span className="text-gray-600">
            — earliest start first; each bar is <strong className="font-medium text-gray-800">Batch Qty</strong> (pieces) for that row.
          </span>
        </p>
      )}
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
            <Bar dataKey="output" fill={BAR_COLOR} name="Output" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v) => v }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
