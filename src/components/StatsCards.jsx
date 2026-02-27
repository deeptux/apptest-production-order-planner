import { Package, TrendingUp, Calendar, Clock, Flag } from 'lucide-react';
import { usePlan } from '../context/PlanContext';

function formatDate(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(str) {
  if (!str) return '—';
  return str;
}

const shouldTruncateLabel = (text) => String(text).length > 18;

export default function StatsCards() {
  const { rows, planDate } = usePlan();

  const totalBatches = rows.length;
  const totalOutput = rows.reduce((sum, r) => sum + (Number(r.soQty) || 0), 0);
  const firstStart = rows.length ? (rows[0].startSponge || '—') : '—';
  const lastEnd = rows.length ? (rows[rows.length - 1].endBatch || '—') : '—';

  const cards = [
    { label: 'Total Batches', value: totalBatches, icon: Package },
    { label: 'Total Output (pckg)', value: `${totalOutput.toLocaleString()} pckg`, icon: TrendingUp },
    { label: 'Plan Date', value: formatDate(planDate), icon: Calendar },
    { label: 'First Start', value: formatTime(firstStart), icon: Clock },
    { label: 'Last End', value: formatTime(lastEnd), icon: Flag },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
      {cards.map(({ label, value, icon: Icon }) => {
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
              <p className="text-kpi-value sm:text-sm-kpi-value md:text-md-kpi-value lg:text-md-kpi-value xl:text-lg-kpi-value 2xl:text-[2rem] text-gray-900 whitespace-nowrap truncate">
                {value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
