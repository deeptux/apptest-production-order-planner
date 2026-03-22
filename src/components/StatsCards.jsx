import { Package, TrendingUp, Calendar, Clock, Flag } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { parseTimeToMinutes } from '../utils/stageDurations';
import { formatDateRelativeScheduling, formatTime12h } from '../utils/planDisplay';

function formatDate(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function nextDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

const shouldTruncateLabel = (text) => String(text).length > 18;

export default function StatsCards({ filterProductionLineId }) {
  const { rows, planDate } = usePlan();

  const filteredRows = filterProductionLineId
    ? rows.filter((r) => r.productionLineId === filterProductionLineId)
    : rows;

  const totalBatches = filteredRows.length;
  const totalOutput = filteredRows.reduce(
    (sum, r) => sum + (Number(r.theorOutput) ?? Number(r.soQty) ?? 0),
    0
  );
  const sortedByStart = [...filteredRows].sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if (d !== 0) return d;
    return parseTimeToMinutes(a.startSponge) - parseTimeToMinutes(b.startSponge);
  });
  const firstStartRow = sortedByStart.length ? sortedByStart[0] : null;
  const withEnd = filteredRows.map((r) => {
    const startM = parseTimeToMinutes(r.startSponge);
    const endM = parseTimeToMinutes(r.endBatch);
    const endDate = endM <= startM && r.endBatch !== r.startSponge ? nextDay(r.date || '') : (r.date || '');
    return { row: r, endDate, endBatch: r.endBatch || '00:00' };
  });
  const sortedByEnd = withEnd.sort((a, b) => {
    const d = (a.endDate || '').localeCompare(b.endDate || '');
    if (d !== 0) return d;
    return parseTimeToMinutes(a.endBatch) - parseTimeToMinutes(b.endBatch);
  });
  const lastEndEntry = sortedByEnd.length ? sortedByEnd[sortedByEnd.length - 1] : null;

  // same stack idea as schedule time cells: big 12h line, muted Today/Tomorrow/Mar 24 line under
  const dateTimeStack = (timeHm, dateYmd) => {
    const ymd = (dateYmd || '').split('T')[0];
    const timeLine = timeHm ? formatTime12h(String(timeHm).trim()) : '—';
    const sub = ymd ? formatDateRelativeScheduling(ymd) : '—';
    return (
      <div className="leading-tight min-w-0">
        <div className="font-bold text-gray-900 tabular-nums text-xl sm:text-2xl md:text-[1.65rem] xl:text-[1.85rem] 2xl:text-[2rem] tracking-tight">
          {timeLine}
        </div>
        <div className="text-[0.65rem] sm:text-xs text-gray-500 mt-1">{sub}</div>
      </div>
    );
  };

  const cards = [
    { label: 'Total Batches', value: totalBatches, icon: Package },
    { label: 'Total Output (PKG)', value: totalOutput.toLocaleString(), icon: TrendingUp },
    { label: 'Plan Date', value: formatDate(planDate), icon: Calendar },
    {
      label: 'First Start',
      icon: Clock,
      valueNode: firstStartRow
        ? dateTimeStack(firstStartRow.startSponge, firstStartRow.date)
        : dateTimeStack(null, null),
    },
    {
      label: 'Last End',
      icon: Flag,
      valueNode: lastEndEntry
        ? dateTimeStack(lastEndEntry.endBatch, lastEndEntry.endDate)
        : dateTimeStack(null, null),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
      {cards.map(({ label, value, valueNode, icon: Icon }) => {
        const truncateLabel = shouldTruncateLabel(label);
        return (
          <div
            key={label}
            className="bg-surface-card-warm rounded-card shadow-card p-4 flex items-center gap-4 min-w-0 border border-gray-100"
          >
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 md:w-12 md:h-12 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-7 md:h-7 lg:w-7 lg:h-7 xl:w-8 xl:h-8" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-kpi-label sm:text-sm-kpi-label 2xl:text-base uppercase tracking-wide text-muted break-words ${
                  truncateLabel ? 'truncate' : 'whitespace-normal'
                }`}
              >
                {label}
              </p>
              {valueNode != null ? (
                <div className="mt-0.5">{valueNode}</div>
              ) : (
                <p className="text-kpi-value sm:text-sm-kpi-value md:text-md-kpi-value lg:text-md-kpi-value xl:text-lg-kpi-value 2xl:text-[2rem] text-gray-900 leading-tight break-words whitespace-normal sm:whitespace-nowrap">
                  {value}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
