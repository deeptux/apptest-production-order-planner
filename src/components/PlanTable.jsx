import { Plus, ArrowUpDown, Download, FileText, Eye, Trash2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { usePlan } from '../context/PlanContext';
import { getOrderBatchAndLineBatch } from '../store/planStore';
import {
  getAlignedLegacyProcessProcMinutes,
  getProcMinutesForPlanSection,
  getProcessWindowEndOffsetMinutes,
  getProcessWindowStartOffsetMinutes,
  isLegacyProcessSectionId,
} from '../utils/stageDurations';
import { getProductionStatus } from '../utils/productionStatus';
import { getCapacityForProduct, getDoughWeightKgForProduct } from '../store/capacityProfileStore';
import { formatSkuIdFromMs, getRowCreatedAtMs } from '../utils/skuId';
import {
  batchScheduleAnchorMs,
  buildSkuBatchOrderMap,
  compareRowsScheduleOrder,
  displaySoCoExcessForTable,
  formatDateRelativeScheduling,
  formatProcMinutesAsHours,
  schedulingTimeStackFromMs,
  schedulingTimeStackFromRowHm,
} from '../utils/planDisplay';
import { SECTIONS } from './SectionTabs';

// shared table: live station + dashboard. dashboard turns on scheduleAlignedDisplay so the time cells
// and SKU batch labels line up with what scheduling shows (12h + day line, sku map, etc.)
const PRODUCT_COL = { key: 'product', label: 'Product' };

const COLS_AFTER_TIME_BLOCK = [
  { key: 'salesOrder', label: 'Sales Order' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'doughWeightKg', label: 'Dough (kg)' },
  { key: 'soCoExcess', label: 'SO-CO Excess' },
  { key: 'exchangeForLoss', label: 'Exch. Loss' },
  { key: 'excess', label: 'Excess' },
  { key: 'samples', label: 'Samples' },
  { key: 'carryOverExcess', label: 'Carry Over' },
  { key: 'theorExcess', label: 'Theor. Excess' },
];

const ORDER_AND_SKU_BATCH = [
  { key: 'orderBatch', label: 'Order Batch' },
  { key: 'batch', label: 'SKU Batch Order' },
];

const TAIL_META = [{ key: 'productionStatus', label: 'Production Status' }];

const LEGACY_TIME_LABELS = {
  mixing: { start: 'Start Sponge', endDough: 'End Dough', endBatch: 'End Batch' },
  'makeup-dividing': { start: 'Start Dividing', endDough: 'End Dividing', endBatch: 'End Batch' },
  'makeup-panning': { start: 'Start Panning', endDough: 'End Panning', endBatch: 'End Batch' },
  baking: { start: 'Start Baking', endDough: 'End Baking', endBatch: 'End Batch' },
  packaging: { start: 'Start Packaging', endDough: 'End Packaging', endBatch: 'End Batch' },
};

function timeColumnsForProcess(process) {
  const id = process?.id;
  const name = (process?.name || id || 'Process').trim();
  const legacy = id && LEGACY_TIME_LABELS[id];
  if (legacy) {
    return [
      { key: 'startSponge', label: legacy.start },
      { key: 'endDough', label: legacy.endDough },
      { key: 'endBatch', label: legacy.endBatch },
    ];
  }
  return [
    { key: 'startSponge', label: `Start ${name}` },
    { key: 'endDough', label: `End ${name}` },
    { key: 'endBatch', label: 'End Batch' },
  ];
}

export function buildPlanColumnsForProcess(process) {
  return [
    PRODUCT_COL,
    { key: 'skuId', label: 'SKU ID#' },
    { key: 'soQty', label: 'Total Qty' },
    { key: 'theorOutput', label: 'Batch Qty' },
    { key: 'procTime', label: 'Proc.Time' },
    ...timeColumnsForProcess(process),
    ...ORDER_AND_SKU_BATCH,
    ...COLS_AFTER_TIME_BLOCK,
    ...TAIL_META,
  ];
}

const LEGACY_SECTION_IDS = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];

export const SECTION_COLUMNS = Object.fromEntries(
  LEGACY_SECTION_IDS.map((id) => {
    const label = SECTIONS.find((s) => s.id === id)?.label ?? id;
    return [id, buildPlanColumnsForProcess({ id, name: label })];
  })
);

const FALLBACK_COLUMNS = buildPlanColumnsForProcess({ id: 'mixing', name: 'Mixing' });

// copy/paste vibe from SchedulingView schedule mode — big time, small gray date under it
function SchedulingStackCell({ stack, topClassName = 'font-medium text-gray-900 tabular-nums' }) {
  if (!stack) return '—';
  return (
    <div className="leading-tight">
      <div className={topClassName}>{stack.time}</div>
      <div className="text-[0.65rem] sm:text-xs text-gray-500">{stack.sub}</div>
    </div>
  );
}

export default function PlanTable({
  sectionId,
  onAddBatch,
  addButtonLabel = 'Add batch',
  onDeleteBatch,
  onReorder,
  onExport,
  onExportPdf,
  onLiveView,
  maxRows,
  statusColumnLabel = 'Production Status',
  sortedProcesses,
  filterProductionLineId,
  scheduleAlignedDisplay = false,
  sortRowsByScheduleStart = false,
}) {
  const { rows: fullRows } = usePlan();

  const lineFiltered = useMemo(() => {
    if (!filterProductionLineId) return fullRows;
    return fullRows.filter((r) => r.productionLineId === filterProductionLineId);
  }, [fullRows, filterProductionLineId]);

  const orderedRows = useMemo(() => {
    if (!sortRowsByScheduleStart) return lineFiltered;
    return [...lineFiltered].sort(compareRowsScheduleOrder);
  }, [lineFiltered, sortRowsByScheduleStart]);

  const rows =
    typeof maxRows === 'number' && maxRows > 0 ? orderedRows.slice(0, maxRows) : orderedRows;

  const processesForProcTime = useMemo(() => {
    if (Array.isArray(sortedProcesses) && sortedProcesses.length > 0) return sortedProcesses;
    return SECTIONS.map((s, i) => ({ id: s.id, name: s.label, order: i }));
  }, [sortedProcesses]);

  const baseColumns = useMemo(() => {
    let cols;
    if (Array.isArray(sortedProcesses) && sortedProcesses.length > 0) {
      const p = sortedProcesses.find((x) => x.id === sectionId);
      if (p) cols = buildPlanColumnsForProcess(p);
    }
    if (!cols) cols = SECTION_COLUMNS[sectionId] || FALLBACK_COLUMNS;
    if (!scheduleAlignedDisplay) {
      return cols.map((c) => (c.key === 'batch' ? { ...c, label: 'Line Batch' } : c));
    }
    return cols;
  }, [sectionId, sortedProcesses, scheduleAlignedDisplay]);

  const restColumns = baseColumns.filter((c) => c.key !== 'productionStatus');
  const columns = [
    { key: 'productionStatus', label: statusColumnLabel },
    ...(onDeleteBatch ? [{ key: 'actions', label: 'Actions' }] : []),
    ...restColumns,
  ];

  const [statusTick, setStatusTick] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setStatusTick(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { orderBatch: orderBatchMap, lineBatch: lineBatchMapLegacy } = useMemo(
    () => getOrderBatchAndLineBatch(fullRows),
    [fullRows],
  );
  const skuBatchOrderMap = useMemo(() => buildSkuBatchOrderMap(fullRows), [fullRows]);

  const procTimeByRowId = useMemo(() => {
    const m = new Map();
    rows.forEach((row) => {
      if (row.isBreak) {
        m.set(row.id, null);
        return;
      }
      if (scheduleAlignedDisplay && isLegacyProcessSectionId(sectionId)) {
        const aligned = getAlignedLegacyProcessProcMinutes(row, sectionId);
        m.set(row.id, aligned != null && !Number.isNaN(aligned) ? aligned : null);
        return;
      }
      const mins = getProcMinutesForPlanSection(row, sectionId, processesForProcTime);
      m.set(row.id, mins != null && !Number.isNaN(Number(mins)) ? mins : null);
    });
    return m;
  }, [rows, sectionId, processesForProcTime, scheduleAlignedDisplay]);

  const timeLikeKeys = new Set(['startSponge', 'endDough', 'endBatch', 'procTime']);

  return (
    <div className="bg-surface-card rounded-b-card shadow-card overflow-hidden border border-t-0 border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg">
          <thead>
            <tr className="bg-surface-card-warm border-b border-gray-200">
              {columns.map(({ key, label }) => (
                <th key={key} className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap text-inherit">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleAlignedDisplay && typeof maxRows === 'number' && maxRows > 0 && (
              <tr className="bg-amber-50/60 border-b border-amber-100/90">
                <td
                  colSpan={columns.length}
                  className="py-2 px-3 sm:px-4 text-[0.7rem] sm:text-xs text-gray-700"
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0"
                      aria-hidden
                    />
                    Top {maxRows} upcoming batches
                  </span>
                  <span className="text-gray-600">
                    {' '}
                    — earliest start first for this line (schedule order). Open{' '}
                    <strong className="font-medium text-gray-800">Scheduling</strong> for the full plan.
                  </span>
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const rowStatus = getProductionStatus(row, statusTick);
              return (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 bg-surface-card">
                  {columns.map(({ key }) => {
                    if (key === 'actions') {
                      return (
                        <td key={key} className="py-2 sm:py-2.5 px-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() => onDeleteBatch(row.id)}
                            disabled={rowStatus === 'In Progress'}
                            className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            aria-label={rowStatus === 'In Progress' ? 'Cannot delete batch in progress' : 'Delete row'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      );
                    }
                    let value;
                    if (key === 'orderBatch') {
                      if (row.isBreak) {
                        value = '—';
                      } else if (scheduleAlignedDisplay) {
                        const ob = orderBatchMap[row.id] ?? '—';
                        const ymd = (row.date || '').split('T')[0];
                        value = (
                          <div className="leading-tight">
                            <div className="font-medium text-gray-900">{ob}</div>
                            <div className="text-[0.65rem] sm:text-xs text-gray-500">
                              {ymd ? formatDateRelativeScheduling(ymd) : '—'}
                            </div>
                          </div>
                        );
                      } else {
                        value = orderBatchMap[row.id] ?? '—';
                      }
                    } else if (key === 'batch') {
                      if (scheduleAlignedDisplay) {
                        value = row.isBreak ? '—' : (skuBatchOrderMap[row.id] ?? '—');
                      } else {
                        value = lineBatchMapLegacy[row.id] ?? row[key] ?? '—';
                      }
                    } else if (key === 'productionStatus') {
                      const statusClass =
                        rowStatus === 'In Progress'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : rowStatus === 'Finished'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200';
                      value = (
                        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${statusClass}`}>
                          {rowStatus}
                        </span>
                      );
                    } else if (key === 'procTime') {
                      const mins = procTimeByRowId.get(row.id);
                      if (mins == null) value = '—';
                      else value = scheduleAlignedDisplay ? formatProcMinutesAsHours(mins) : mins;
                    } else if (key === 'skuId') {
                      value = row.isBreak ? '—' : formatSkuIdFromMs(getRowCreatedAtMs(row));
                    } else if (key === 'startSponge' || key === 'endDough' || key === 'endBatch') {
                      if (row.isBreak) {
                        value = '—';
                      } else if (key === 'endBatch') {
                        const rawEb = row.endBatch;
                        if (rawEb == null || rawEb === '') value = '—';
                        else if (scheduleAlignedDisplay) {
                          value = (
                            <SchedulingStackCell stack={schedulingTimeStackFromRowHm(row, 'endBatch')} />
                          );
                        } else value = rawEb;
                      } else if (scheduleAlignedDisplay && isLegacyProcessSectionId(sectionId)) {
                        const anchor = batchScheduleAnchorMs(row);
                        if (anchor == null) {
                          value = '—';
                        } else if (key === 'startSponge') {
                          const off = getProcessWindowStartOffsetMinutes(row, sectionId);
                          value =
                            off === null ? (
                              '—'
                            ) : (
                              <SchedulingStackCell stack={schedulingTimeStackFromMs(anchor + off * 60000)} />
                            );
                        } else {
                          const off = getProcessWindowEndOffsetMinutes(row, sectionId);
                          value =
                            off === null ? (
                              '—'
                            ) : (
                              <SchedulingStackCell stack={schedulingTimeStackFromMs(anchor + off * 60000)} />
                            );
                        }
                      } else if (scheduleAlignedDisplay) {
                        const raw = row[key];
                        if (raw == null || raw === '') value = '—';
                        else
                          value = (
                            <SchedulingStackCell stack={schedulingTimeStackFromRowHm(row, key)} />
                          );
                      } else {
                        value = row[key] ?? '—';
                      }
                    } else if (key === 'soCoExcess') {
                      value = displaySoCoExcessForTable(row);
                    } else if (key === 'capacity') {
                      value = getCapacityForProduct(row.product, row.productionLineId) ?? row[key] ?? '—';
                    } else if (key === 'doughWeightKg') {
                      value =
                        getDoughWeightKgForProduct(row.product, row.productionLineId) != null
                          ? `${getDoughWeightKgForProduct(row.product, row.productionLineId)} kg`
                          : '—';
                    } else {
                      value = row[key] ?? '—';
                    }
                    const scheduleTimeCol = scheduleAlignedDisplay && timeLikeKeys.has(key);
                    const isScheduleStackTimeCell =
                      scheduleAlignedDisplay &&
                      !row.isBreak &&
                      (key === 'startSponge' || key === 'endDough' || key === 'endBatch');
                    const cellClass = [
                      'py-2 sm:py-2.5 px-3 sm:px-4 text-gray-800 text-inherit',
                      key === 'product' ? 'whitespace-nowrap' : '',
                      key === 'skuId' ? 'tabular-nums whitespace-nowrap' : '',
                      scheduleTimeCol && !isScheduleStackTimeCell ? 'tabular-nums whitespace-nowrap' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <td key={key} className={cellClass}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-surface-card-warm border-t border-gray-200 text-xs sm:text-sm 2xl:text-base">
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {onAddBatch && (
            <button
              type="button"
              onClick={onAddBatch}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-inherit"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              {addButtonLabel}
            </button>
          )}
        </div>
        {(onReorder || onExport || onExportPdf || onLiveView) && (
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 ml-auto">
            {onReorder && (
              <button
                type="button"
                onClick={() => onReorder?.()}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <ArrowUpDown className="w-4 h-4" />
                Reorder
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <Download className="w-4 h-4" />
                Export (CSV/JSON)
              </button>
            )}
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            )}
            {onLiveView && (
              <button
                type="button"
                onClick={onLiveView}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <Eye className="w-4 h-4" />
                Live view
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
