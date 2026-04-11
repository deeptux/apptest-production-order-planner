import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlan } from '../context/PlanContext';
import { useLinesList } from '../hooks/useConfigStores';
import { formatTime12h } from '../utils/planDisplay';
import {
  DAY_MINUTES,
  parseTimeToMinutes,
  computeTotalMinutesForRow,
  getProcMinutesForPlanSection,
  resolveLegacySectionIdForRowContext,
} from '../utils/stageDurations';

function absMinutesToHHMM(abs) {
  const t = ((abs % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(t / 60) % 24;
  const m = Math.round(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// When a tab maps to a canonical loaf stage id, keep the old colors so familiar lines don’t jump.
const CANONICAL_STAGE_COLORS = {
  mixing: '#3b82f6',
  'makeup-dividing': '#22c55e',
  'makeup-panning': '#eab308',
  baking: '#f97316',
  packaging: '#a855f7',
};

// Extra processes on the line (or odd names) — cycle these; still distinct from each other.
const EXTENDED_PALETTE = [
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#f43f5e',
  '#14b8a6',
  '#a78bfa',
  '#fb923c',
  '#0ea5e9',
  '#d946ef',
];

function colorForLineProcess(proc, index, sortedProcesses) {
  const canon = resolveLegacySectionIdForRowContext(proc.id, sortedProcesses);
  if (canon && CANONICAL_STAGE_COLORS[canon]) return CANONICAL_STAGE_COLORS[canon];
  return EXTENDED_PALETTE[index % EXTENDED_PALETTE.length];
}

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

/**
 * Segments always mirror the selected line’s Process Chain from Production (same ordered steps as under Production Line Profile).
 * No hard-coded loaf stages — if the chain is empty, we show an empty state instead of inventing segments.
 *
 * @param {object} props
 * @param {number} [props.maxRows]
 * @param {string} [props.filterProductionLineId] — filter plan rows; also used to resolve processes from the lines store if sortedProcesses is empty.
 * @param {{ id: string, name?: string, order?: number }[]} [props.sortedProcesses] — optional; otherwise resolved from the lines store using filterProductionLineId.
 */
export default function GanttChart({ maxRows, filterProductionLineId, sortedProcesses: sortedProcessesProp }) {
  const { rows: fullRows, planDate } = usePlan();
  const lines = useLinesList();

  const sortedProcesses = useMemo(() => {
    if (Array.isArray(sortedProcessesProp) && sortedProcessesProp.length > 0) return sortedProcessesProp;
    if (!filterProductionLineId) return [];
    const line = lines.find((l) => l.id === filterProductionLineId);
    const procs = [...(line?.processes ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return procs;
  }, [sortedProcessesProp, filterProductionLineId, lines]);

  const lineFilteredRows = filterProductionLineId
    ? fullRows.filter((r) => r.productionLineId === filterProductionLineId)
    : fullRows;
  const rows = typeof maxRows === 'number' && maxRows > 0 ? lineFilteredRows.slice(0, maxRows) : lineFilteredRows;
  const isDesktop = useIsDesktop();

  const lineLabel = useMemo(() => {
    if (!filterProductionLineId) return '';
    const line = lines.find((l) => l.id === filterProductionLineId);
    return String(line?.name || line?.id || '').trim();
  }, [filterProductionLineId, lines]);

  const { chartData, domainMax, minBase, startLabel, endLabel, segmentMeta, ganttMode } = useMemo(() => {
    const empty = {
      chartData: [],
      domainMax: 0,
      minBase: 0,
      startLabel: '',
      endLabel: '',
      segmentMeta: [],
      ganttMode: 'no-process-chain',
    };

    // Bars are only meaningful when we know the line’s Process Chain (Production page). No synthetic "classic" stages.
    if (sortedProcesses.length === 0) {
      return { ...empty, ganttMode: 'no-process-chain' };
    }

    if (!rows.length) {
      return { ...empty, ganttMode: 'no-rows' };
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
      const endAbs = startAbs + total;

      minAbs = Math.min(minAbs, startAbs);
      maxAbs = Math.max(maxAbs, endAbs);

      const datum = {
        product: row.product,
        offsetAbs: startAbs,
      };

      sortedProcesses.forEach((p, i) => {
        const m = getProcMinutesForPlanSection(row, p.id, sortedProcesses);
        datum[`s${i}`] = m != null && !Number.isNaN(Number(m)) ? Math.max(0, Number(m)) : 0;
      });
      return datum;
    });

    if (!isFinite(minAbs) || !isFinite(maxAbs)) {
      return { ...empty, ganttMode: 'no-rows' };
    }

    const chartData = rawData.map((d) => ({
      ...d,
      offset: d.offsetAbs - minAbs,
    }));

    const domainMax = maxAbs - minAbs;
    const minBase = minAbs;

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

    const segmentMeta = sortedProcesses.map((p, i) => ({
      key: `s${i}`,
      label: String(p.name || p.id || `Step ${i + 1}`).trim(),
      color: colorForLineProcess(p, i, sortedProcesses),
    }));

    return { chartData, domainMax, minBase, startLabel, endLabel, segmentMeta, ganttMode: 'chart' };
  }, [rows, planDate, sortedProcesses]);

  const height = Math.max(240, chartData.length * 48);

  const leftMargin = isDesktop ? 24 : 12;
  const yAxisWidth = isDesktop ? 72 : 64;

  const formatTimeTick = (v) => {
    const abs = minBase + v;
    return formatTime12h(absMinutesToHHMM(abs));
  };

  // Same notion of "line processes" as the rest of the dashboard: the ordered Process Chain on Production for the line
  // you pick under Production Line Profile (Loaf Line, Bun Line, etc.). No chart until that chain exists.
  if (sortedProcesses.length === 0) {
    const lineHint = lineLabel ? (
      <>
        For <strong className="text-gray-800">{lineLabel}</strong>, add steps to the{' '}
        <strong className="text-gray-800">Process Chain</strong> on the{' '}
        <strong className="text-gray-800">Production</strong> page (same profile you edit per line).
      </>
    ) : (
      <>
        Choose a production line under <strong className="text-gray-800">Production Line Profile</strong>, then define its{' '}
        <strong className="text-gray-800">Process Chain</strong> on the <strong className="text-gray-800">Production</strong> page.
      </>
    );
    return (
      <div className="bg-surface-card-warm rounded-card shadow-card p-4 border border-gray-100">
        <h3 className="text-chart-title sm:text-sm-chart-title md:text-md-chart-title 2xl:text-[1.25rem] text-gray-800">
          Production Gantt
        </h3>
        <p className="text-chart-subtitle sm:text-sm-chart-subtitle md:text-md-chart-subtitle 2xl:text-[1rem] mt-0.5 text-gray-600">
          Timeline stacks one segment per process in the line&apos;s chain — same order as on Production.
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white/60 p-5 text-sm text-gray-600">
          <p className="m-0">{lineHint}</p>
          <p className="mt-3 mb-0 text-xs text-gray-500">
            Until that chain exists, there&apos;s nothing to label or color on this chart (we don&apos;t guess classic loaf
            stages).
          </p>
        </div>
      </div>
    );
  }

  if (ganttMode !== 'chart') {
    return (
      <div className="bg-surface-card-warm rounded-card shadow-card p-4 border border-gray-100">
        <h3 className="text-chart-title sm:text-sm-chart-title md:text-md-chart-title 2xl:text-[1.25rem] text-gray-800">
          Production Gantt
        </h3>
        <p className="text-chart-subtitle sm:text-sm-chart-subtitle md:text-md-chart-subtitle 2xl:text-[1rem] mt-0.5">
          Production timeline
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white/60 p-5 text-sm text-gray-600">
          <p className="m-0">
            No batches on {lineLabel ? <strong className="text-gray-800">{lineLabel}</strong> : 'this line'} in the
            current plan. Add or assign schedules so rows show up here.
          </p>
        </div>
      </div>
    );
  }

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
            <XAxis type="number" domain={[0, domainMax]} tickFormatter={formatTimeTick} />
            <YAxis type="category" dataKey="product" width={yAxisWidth} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value, name) => [`${value} min`, name]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="offset" stackId="gantt" fill="transparent" radius={0} barSize={28} isAnimationActive={false} />
            {segmentMeta.map((seg) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                stackId="gantt"
                fill={seg.color}
                name={seg.label}
                radius={0}
                barSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
        {segmentMeta.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
