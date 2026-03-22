import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { useLinesList } from '../hooks/useConfigStores';
import { getOrderBatchAndLineBatch } from '../store/planStore';
import { getCapacityForProduct, getDoughWeightKgForProduct } from '../store/capacityProfileStore';
import { getProcMinutesForPlanSection, parseTimeToMinutes } from '../utils/stageDurations';
import {
  compareRowsScheduleOrder,
  buildSkuBatchOrderMap,
  formatDateRelativeScheduling,
  displaySoCoExcessForTable,
  formatProcMinutesAsHours,
} from '../utils/planDisplay';
import { formatSkuIdFromMs, getRowCreatedAtMs } from '../utils/skuId';
import { getProductionStatus } from '../utils/productionStatus';
import { buildProcessLiveStepperSteps } from '../utils/processLiveStepper';
import { getRowProcessWindowMs, getLiveStepperState } from '../utils/processLiveWindow';
import { pickSpotlightBatchRow } from '../utils/processLiveSpotlight';
import ProcessProfileStepper from './ProcessProfileStepper';
import ProcessLiveCurrentBatchCard from './ProcessLiveCurrentBatchCard';
import ProcessLiveSupervisorDialog from './ProcessLiveSupervisorDialog';

const TICK_MS = 10_000;

function LiveRowTooltipBody({ row, lineId }) {
  const doughDisplay =
    getDoughWeightKgForProduct(row.product, lineId) != null
      ? `${getDoughWeightKgForProduct(row.product, lineId)} kg`
      : '—';
  return (
    <div className="text-left text-sm sm:text-base space-y-1.5 p-1 max-w-[280px]">
      <div>
        <span className="font-medium text-gray-500">Dough (kg):</span> {doughDisplay}
      </div>
      <div>
        <span className="font-medium text-gray-500">SO-CO Excess:</span> {displaySoCoExcessForTable(row)}
      </div>
      <div>
        <span className="font-medium text-gray-500">Exch. Loss:</span> {row.exchangeForLoss ?? '—'}
      </div>
      <div>
        <span className="font-medium text-gray-500">Excess:</span> {row.excess ?? '—'}
      </div>
      <div>
        <span className="font-medium text-gray-500">Samples:</span> {row.samples ?? '—'}
      </div>
      <div>
        <span className="font-medium text-gray-500">Carry Over:</span> {row.carryOverExcess ?? '—'}
      </div>
      <div>
        <span className="font-medium text-gray-500">Theor. Excess:</span> {row.theorExcess ?? '—'}
      </div>
    </div>
  );
}

export default function ProcessLiveView() {
  const { lineId: lineIdParam, processId: processIdParam } = useParams();
  const navigate = useNavigate();
  const lineId = lineIdParam ? decodeURIComponent(lineIdParam) : '';
  const processId = processIdParam ? decodeURIComponent(processIdParam) : '';

  const { rows: fullRows, hydrated } = usePlan();
  const lines = useLinesList();
  const line = lines.find((l) => l.id === lineId) ?? null;
  const sortedProcesses = useMemo(() => {
    const procs = line?.processes ?? [];
    return [...procs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [line]);
  const processMeta = sortedProcesses.find((p) => p.id === processId) ?? null;

  const steps = useMemo(
    () => (lineId && processId ? buildProcessLiveStepperSteps(lineId, processId) : []),
    [lineId, processId, lines],
  );

  const lineFiltered = useMemo(
    () => fullRows.filter((r) => r.productionLineId === lineId),
    [fullRows, lineId],
  );
  const orderedRows = useMemo(
    () => [...lineFiltered].sort(compareRowsScheduleOrder),
    [lineFiltered],
  );
  const lineBatchesOnly = useMemo(() => lineFiltered.filter((r) => !r.isBreak), [lineFiltered]);

  const { orderBatch: orderBatchMap } = useMemo(() => getOrderBatchAndLineBatch(fullRows), [fullRows]);
  const skuBatchOrderMap = useMemo(() => buildSkuBatchOrderMap(fullRows), [fullRows]);

  const [statusTick, setStatusTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setStatusTick(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const liveDerived = useMemo(() => {
    const now = statusTick;
    const inProg = orderedRows.find((r) => !r.isBreak && getProductionStatus(r, now) === 'In Progress');
    if (!inProg || !steps.length) {
      return {
        activeIndex: -1,
        stepProgress: 0,
        inProgressPayload: null,
      };
    }
    const win = getRowProcessWindowMs(inProg, processId, sortedProcesses);
    if (!win || now < win.startMs || now > win.endMs) {
      return {
        activeIndex: -1,
        stepProgress: 0,
        inProgressPayload: null,
      };
    }
    const elapsedMin = (now - win.startMs) / 60000;
    const st = getLiveStepperState(elapsedMin, steps);
    return {
      activeIndex: st.activeIndex,
      stepProgress: st.stepProgress,
      inProgressPayload: {
        row: inProg,
        win,
        skuBatch: skuBatchOrderMap[inProg.id],
        remainingMs: win.endMs - now,
      },
    };
  }, [orderedRows, processId, sortedProcesses, steps, statusTick, skuBatchOrderMap]);

  const spotlightRow = useMemo(
    () => pickSpotlightBatchRow(lineBatchesOnly, statusTick),
    [lineBatchesOnly, statusTick],
  );
  const spotlightStatus = spotlightRow ? getProductionStatus(spotlightRow, statusTick) : null;

  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [clickedRowId, setClickedRowId] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const clickTimeoutRef = useRef(null);

  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [supervisorRow, setSupervisorRow] = useState(null);

  const openSupervisor = useCallback((row) => {
    setSupervisorRow(row ?? null);
    setSupervisorOpen(true);
  }, []);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearHoverTimer();
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    },
    [clearHoverTimer],
  );

  const title = line && processMeta ? `${line.name || line.id} — ${processMeta.name || processId}` : 'Process live';
  const processLabel = processMeta?.name || processId;

  const linkClass = 'text-primary font-semibold hover:underline';

  if (!lineId || !processId) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6">
        <p className="text-sm sm:text-base text-muted mb-4">Missing line or process.</p>
        <Link to="/dashboard" className={linkClass}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6">
        <p className="text-sm sm:text-base text-muted">Loading production lines…</p>
      </div>
    );
  }

  if (!line || !processMeta) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-lg">
        <p className="text-base sm:text-lg font-semibold text-gray-800">This production line or process was not found.</p>
        <p className="text-sm sm:text-base text-muted mt-2 mb-4">
          It may have been renamed or removed in Production setup.
        </p>
        <Link to="/dashboard" className={linkClass}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col text-gray-800">
      <header className="shrink-0 bg-primary text-white shadow-card px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
        <div className="mx-auto flex w-full max-w-[2500px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm sm:text-base font-medium text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              Dashboard
            </button>
            <span className="hidden text-white/50 sm:inline" aria-hidden>
              |
            </span>
            <h1 className="min-w-0 text-base font-semibold leading-tight sm:text-lg md:text-xl lg:text-2xl truncate">
              Supervisor live · {title}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-white/85 max-w-xl sm:text-right">
            This page is fixed to one line and one process. Admins open the right link from Dashboard (Production Line
            Profile + Live View).
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[2500px] flex-1 overflow-auto px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6 2xl:px-10 2xl:py-8">
        {!hydrated && <p className="mb-4 text-sm sm:text-base text-muted">Loading plan…</p>}

        {sortedProcesses.length === 0 ? (
          <div className="rounded-card border border-gray-200 bg-surface-card p-6 text-muted">
            No processes on this line. Define them in <strong className="text-gray-800">Production</strong>.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-t-card border border-b-0 border-gray-200 bg-surface-card-warm px-3 py-2 sm:px-4">
              <p className="text-xs sm:text-sm text-gray-700">
                <strong className="font-semibold text-gray-900">Supervisor</strong> — this screen is only for{' '}
                <strong className="font-semibold text-gray-900">{processLabel}</strong> on{' '}
                <strong className="font-semibold text-gray-900">{line?.name || lineId}</strong>. Use{' '}
                <strong className="font-semibold">Request</strong> to ask admins (Dashboard / Scheduling) to reorder,
                edit, delete, or adjust time blockers.
              </p>
              <button
                type="button"
                onClick={() => openSupervisor(null)}
                className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <ClipboardList className="h-4 w-4" />
                Request (no row)
              </button>
            </div>

            <ProcessLiveCurrentBatchCard
              processLabel={processLabel}
              inProgress={liveDerived.inProgressPayload}
              spotlightRow={liveDerived.inProgressPayload ? null : spotlightRow}
              spotlightStatus={liveDerived.inProgressPayload ? null : spotlightStatus}
              skuBatchOrderMap={skuBatchOrderMap}
              orderBatchMap={orderBatchMap}
            />

            <ProcessProfileStepper
              steps={steps}
              activeIndex={liveDerived.activeIndex}
              stepProgress={liveDerived.stepProgress}
            />

            <div className="rounded-b-card border border-gray-200 bg-surface-card shadow-card overflow-hidden">
              <p className="border-b border-gray-200 bg-surface-card-warm px-3 py-2 text-xs font-semibold text-gray-700 sm:px-4 sm:text-sm md:text-base">
                All batches &amp; time blockers on this line (schedule order)
              </p>
              <div className="overflow-x-auto -mx-0">
                <Tooltip.Provider delayDuration={300}>
                  <table className="w-full min-w-[800px] md:min-w-full border-collapse text-sm sm:text-base md:text-lg 2xl:text-xl">
                    <thead>
                      <tr className="border-b border-gray-200 bg-surface-card-warm">
                        {[
                          'Actions',
                          'Status',
                          'Product',
                          'SKU ID#',
                          'Total Qty',
                          'Batch Qty',
                          'Proc.Time',
                          'Order Batch',
                          'SKU Batch Order',
                          'Sales Order',
                          'Capacity',
                        ].map((label) => (
                          <th
                            key={label}
                            className="whitespace-nowrap px-2 py-2.5 text-left text-xs font-semibold text-gray-700 sm:px-3 sm:py-3 sm:text-sm md:text-base 2xl:text-lg"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-10 text-center text-sm sm:text-base text-muted">
                            No batches on this line. Admins add them in{' '}
                            <strong className="text-gray-700">Scheduling</strong>.
                          </td>
                        </tr>
                      ) : (
                        orderedRows.map((row) => {
                          const isBreak = !!row.isBreak;
                          const rowStatus = getProductionStatus(row, statusTick);
                          let procDisplay = '—';
                          if (isBreak) {
                            const bm = Number(row.breakMinutes);
                            if (Number.isFinite(bm) && bm > 0) procDisplay = formatProcMinutesAsHours(bm);
                            else {
                              const pt = Number(row.procTime);
                              if (Number.isFinite(pt) && pt > 0) procDisplay = formatProcMinutesAsHours(pt);
                              else {
                                const sm = parseTimeToMinutes(row.startSponge);
                                const em = parseTimeToMinutes(row.endBatch);
                                const d = em > sm ? em - sm : '';
                                procDisplay = d !== '' ? formatProcMinutesAsHours(d) : '—';
                              }
                            }
                          } else {
                            const procMins = getProcMinutesForPlanSection(row, processId, sortedProcesses);
                            procDisplay =
                              procMins != null && !Number.isNaN(Number(procMins))
                                ? formatProcMinutesAsHours(procMins)
                                : '—';
                          }
                          const capacityDisplay =
                            getCapacityForProduct(row.product, row.productionLineId) ?? row.capacity ?? '—';
                          const ymd = (row.date || '').split('T')[0];

                          const statusClass =
                            rowStatus === 'In Progress'
                              ? 'border-amber-200 bg-amber-100 text-amber-800'
                              : rowStatus === 'Finished'
                                ? 'border-green-200 bg-green-100 text-green-800'
                                : 'border-gray-200 bg-gray-100 text-gray-700';

                          return (
                            <Tooltip.Root
                              key={row.id}
                              delayDuration={300}
                              open={hoveredRowId === row.id || clickedRowId === row.id}
                            >
                              <Tooltip.Trigger asChild>
                                <tr
                                  className={`cursor-default border-b border-gray-100 bg-surface-card hover:bg-gray-50/80 ${
                                    clickedRowId === row.id ? 'bg-primary/10 ring-2 ring-inset ring-primary/25' : ''
                                  }`}
                                  onPointerEnter={() => {
                                    if (clickedRowId && clickedRowId !== row.id) {
                                      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                      setClickedRowId(null);
                                    }
                                    clearHoverTimer();
                                    hoverTimeoutRef.current = setTimeout(() => setHoveredRowId(row.id), 300);
                                  }}
                                  onPointerLeave={() => {
                                    clearHoverTimer();
                                    setHoveredRowId(null);
                                  }}
                                  onClick={(e) => {
                                    if (e.target.closest('[data-supervisor-action="true"]')) return;
                                    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                    setClickedRowId(row.id);
                                    clickTimeoutRef.current = setTimeout(() => {
                                      setClickedRowId(null);
                                      if (document.activeElement && typeof document.activeElement.blur === 'function') {
                                        document.activeElement.blur();
                                      }
                                    }, 4000);
                                  }}
                                >
                                  <td
                                    className="px-2 py-2.5 sm:px-3 sm:py-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      data-supervisor-action="true"
                                      onClick={() => openSupervisor(row)}
                                      className="rounded-lg border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 sm:text-sm"
                                    >
                                      Request
                                    </button>
                                  </td>
                                  <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                                    <span
                                      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium sm:text-sm ${statusClass}`}
                                    >
                                      {rowStatus}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 text-gray-900 sm:px-3 sm:py-3">
                                    {isBreak ? (
                                      <span className="font-medium text-gray-700">Time Blocker</span>
                                    ) : (
                                      row.product ?? '—'
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 font-mono tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : formatSkuIdFromMs(getRowCreatedAtMs(row))}
                                  </td>
                                  <td className="px-2 py-2.5 tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : (row.soQty ?? '—')}
                                  </td>
                                  <td className="px-2 py-2.5 tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : (row.theorOutput ?? '—')}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-gray-700 sm:px-3 sm:py-3">
                                    {procDisplay}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 sm:px-3 sm:py-3">
                                    <div className="leading-tight">
                                      <div className="font-semibold text-gray-900">
                                        {orderBatchMap[row.id] ?? '—'}
                                      </div>
                                      <div className="text-xs text-muted sm:text-sm">
                                        {ymd ? formatDateRelativeScheduling(ymd) : '—'}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2.5 font-mono tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : (skuBatchOrderMap[row.id] ?? '—')}
                                  </td>
                                  <td className="px-2 py-2.5 tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : (row.salesOrder ?? '—')}
                                  </td>
                                  <td className="px-2 py-2.5 tabular-nums text-gray-800 sm:px-3 sm:py-3">
                                    {isBreak ? '—' : capacityDisplay}
                                  </td>
                                </tr>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  side="top"
                                  sideOffset={8}
                                  className="z-[100] max-w-[90vw] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
                                >
                                  {isBreak ? (
                                    <p className="text-sm text-gray-700">Time blocker — use Request to ask admin to adjust.</p>
                                  ) : (
                                    <LiveRowTooltipBody row={row} lineId={lineId} />
                                  )}
                                  <Tooltip.Arrow className="fill-white" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </Tooltip.Provider>
              </div>
              <p className="border-t border-gray-200 bg-surface-card-warm px-3 py-2 text-xs text-muted sm:px-4 sm:py-2.5 sm:text-sm md:text-base">
                Plan updates when your database pushes changes (same as Dashboard / Scheduling). Row tooltips: hover or
                click row (not the Request button). Stepper recalculates every {TICK_MS / 1000}s while a batch is in this
                process window.
              </p>
            </div>
          </>
        )}

        <ProcessLiveSupervisorDialog
          open={supervisorOpen}
          onOpenChange={setSupervisorOpen}
          lineId={lineId}
          lineName={line?.name}
          processId={processId}
          processName={processMeta?.name}
          row={supervisorRow}
        />
      </main>
    </div>
  );
}
