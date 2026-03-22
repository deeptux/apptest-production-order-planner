import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlan } from '../context/PlanContext';
import { formatTime12h } from '../utils/planDisplay';
import {
  DAY_MINUTES,
  parseTimeToMinutes,
  computeTotalMinutesForRow,
  computeStageDurationsForRow,
} from '../utils/stageDurations';

function absMinutesToHHMM(abs) {
  const t = ((abs % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(t / 60) % 24;
  const m = Math.round(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const STAGE_COLORS = {
  mixing: '#3b82f6',
  makeupDividing: '#22c55e',
  makeupPanning: '#eab308',
  baking: '#f97316',
  packaging: '#a855f7',
};

// Simple hook to know when we are on desktop (lg and up).
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

export default function GanttChart({ maxRows, filterProductionLineId }) {
  const { rows: fullRows, planDate } = usePlan();
  const lineFilteredRows = filterProductionLineId
    ? fullRows.filter((r) => r.productionLineId === filterProductionLineId)
    : fullRows;
  const rows = typeof maxRows === 'number' && maxRows > 0 ? lineFilteredRows.slice(0, maxRows) : lineFilteredRows;
  const isDesktop = useIsDesktop();

  const { chartData, domainMax, minBase, startLabel, endLabel } = useMemo(() => {
    if (!rows.length) {
      return {
        chartData: [],
        domainMax: 0,
        minBase: 0,
        startLabel: '',
        endLabel: '',
      };
    }

    const baseDate = planDate instanceof Date ? planDate : new Date();
    const firstStartHM = parseTimeToMinutes(rows[0].startSponge);
    const baseStartAbs = firstStartHM;

    let minAbs = Infinity;
    let maxAbs = -Infinity;

    const rawData = rows.map((row) => {
      const startHM = parseTimeToMinutes(row.startSponge);

      let startAbs = startHM < baseStartAbs ? startHM + DAY_MINUTES : startHM;
      const total = computeTotalMinutesForRow(row);
      let endAbs = startAbs + total;

      minAbs = Math.min(minAbs, startAbs);
      maxAbs = Math.max(maxAbs, endAbs);

      const stages = computeStageDurationsForRow(row);

      return {
        product: row.product,
        offsetAbs: startAbs,
        ...stages,
      };
    });

    if (!isFinite(minAbs) || !isFinite(maxAbs)) {
      return {
        chartData: [],
        domainMax: 0,
        minBase: 0,
        startLabel: '',
        endLabel: '',
      };
    }

    const chartData = rawData.map((d) => ({
      ...d,
      offset: d.offsetAbs - minAbs,
    }));

    const domainMax = maxAbs - minAbs;
    const minBase = minAbs;

    // subtitle range: weekday + 12h clock (match stats / scheduling)
    const formatLabel = (absMinutes) => {
      const date = new Date(baseDate);
      const baseDay = Math.floor(minAbs / DAY_MINUTES);
      const dayOffset = Math.floor(absMinutes / DAY_MINUTES) - baseDay;
      date.setDate(date.getDate() + dayOffset);
      const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
      const hhmm = absMinutesToHHMM(absMinutes);
      return `${dayName} ${formatTime12h(hhmm)}`;
    };

    const startLabel = formatLabel(minAbs);
    const endLabel = formatLabel(maxAbs);

    return { chartData, domainMax, minBase, startLabel, endLabel };
  }, [rows, planDate]);

  const height = Math.max(240, chartData.length * 48);

  // Pull the chart closer to the left edge while keeping Y-axis labels readable.
  // Desktop: a bit more room for labels, Mobile/Tablet: tighter.
  const leftMargin = isDesktop ? 24 : 12;
  const yAxisWidth = isDesktop ? 72 : 64;

  const formatTimeTick = (v) => {
    const abs = minBase + v;
    return formatTime12h(absMinutesToHHMM(abs));
  };

  return (
    <div className="bg-surface-card-warm rounded-card shadow-card p-4 border border-gray-100">
      <h3 className="text-chart-title sm:text-sm-chart-title md:text-md-chart-title 2xl:text-[1.25rem] text-gray-800">Production Gantt</h3>
      <p className="text-chart-subtitle sm:text-sm-chart-subtitle md:text-md-chart-subtitle 2xl:text-[1rem] mt-0.5">
        {startLabel && endLabel ? `Production timeline ${startLabel} – ${endLabel}` : 'Production timeline'}
      </p>
      <div className="mt-4 w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 24, left: leftMargin, bottom: 24 }}
          >
            <XAxis
              type="number"
              domain={[0, domainMax]}
              tickFormatter={formatTimeTick}
            />
            <YAxis type="category" dataKey="product" width={yAxisWidth} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [`${value} min`, '']}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="offset" stackId="gantt" fill="transparent" radius={0} barSize={28} isAnimationActive={false} />
            <Bar dataKey="mixing" stackId="gantt" fill={STAGE_COLORS.mixing} radius={0} barSize={28} isAnimationActive={false} />
            <Bar dataKey="makeupDividing" stackId="gantt" fill={STAGE_COLORS.makeupDividing} radius={0} barSize={28} isAnimationActive={false} />
            <Bar dataKey="makeupPanning" stackId="gantt" fill={STAGE_COLORS.makeupPanning} radius={0} barSize={28} isAnimationActive={false} />
            <Bar dataKey="baking" stackId="gantt" fill={STAGE_COLORS.baking} radius={0} barSize={28} isAnimationActive={false} />
            <Bar dataKey="packaging" stackId="gantt" fill={STAGE_COLORS.packaging} radius={0} barSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
        {Object.entries(STAGE_COLORS).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            {name.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        ))}
      </div>
    </div>
  );
}
