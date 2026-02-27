import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlan } from '../context/PlanContext';

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

export function OutputByProductChart() {
  const { rows } = usePlan();
  const isDesktop = useIsDesktop();

  const data = rows.map((row) => ({
    product: row.product,
    output: row.soQty,
    value: row.soQty,
  }));

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
            <Tooltip formatter={(value) => [value, 'SO Qty']} />
            <Bar dataKey="output" fill={BAR_COLOR} name="Output" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v) => v }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
