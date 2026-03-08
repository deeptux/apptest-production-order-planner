import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { usePlan } from '../context/PlanContext';
import { computeTheoreticalOutput } from '../store/planStore';
import { recomputeEndTimesForRow } from '../utils/stageDurations';
import { getRecipesForLine, getTotalProcessMinutes, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProduct, getDoughWeightKgForProduct, getGramsPerUnitForProduct, getTotalDoughWeightKgForProduct } from '../store/capacityProfileStore';
import { getLines, getLineById } from '../store/productionLinesStore';

const FIELDS_THAT_TRIGGER_AUTO_ADJUST = ['startSponge', 'product'];

export default function SchedulingView() {
  const { planDate, setPlanDate, rows, setRows, reorderRows, addBatch, deleteBatch } = usePlan();
  const [editingRowId, setEditingRowId] = useState(null);
  const [draftRow, setDraftRow] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState('all');
  const [showAllDates, setShowAllDates] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [clickedRowId, setClickedRowId] = useState(null);
  const clickTimeoutRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const lines = getLines();

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const formatDateInput = (d) => {
    if (!d || !(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const planDateStr = formatDateInput(planDate);
  const isFilterAll = !selectedLineId || selectedLineId === 'all';
  const rowsByLine = isFilterAll ? rows : rows.filter((r) => r.productionLineId === selectedLineId);
  // When showAllDates: no date filter (all scheduled batches by line). Otherwise filter by plan date.
  const displayedRows = showAllDates || !planDateStr
    ? rowsByLine
    : rowsByLine.filter((r) => r.date === planDateStr);
  const lineIdForNewBatch = selectedLineId && selectedLineId !== 'all' ? selectedLineId : getLines()[0]?.id;
  const recipeOptions = lineIdForNewBatch ? getRecipesForLine(lineIdForNewBatch) : [];

  const handlePlanDateChange = (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v);
    if (!isNaN(d.getTime())) setPlanDate(d);
  };

  const startEditing = useCallback((row) => {
    setEditingRowId(row.id);
    const lineId = row.productionLineId || lineIdForNewBatch || getLines()[0]?.id;
    const draft = { ...row, productionLineId: lineId };
    draft.date = row.date ?? '';
    draft.soCoExcess = row.soCoExcess !== undefined ? row.soCoExcess : (row.soQty ?? 0);
    draft.exchangeForLoss = row.exchangeForLoss !== undefined ? row.exchangeForLoss : 0;
    draft.excess = row.excess !== undefined ? row.excess : 0;
    draft.samples = row.samples !== undefined ? row.samples : 2;
    draft.carryOverExcess = row.carryOverExcess !== undefined ? row.carryOverExcess : 0;
    draft.theorExcess = row.theorExcess !== undefined ? row.theorExcess : 0;
    draft.theorOutputOverride = row.theorOutputOverride !== undefined ? row.theorOutputOverride : '';
    draft.capacity = getCapacityForProduct(row.product, lineId) ?? row.capacity;
    draft.procTime = getTotalProcessMinutesForLine(row.product, lineId) || getTotalProcessMinutes(row.product) || row.procTime;
    const { endDough, endBatch } = recomputeEndTimesForRow(draft);
    draft.endDough = endDough;
    draft.endBatch = endBatch;
    setDraftRow(draft);
  }, [lineIdForNewBatch]);

  const updateDraft = useCallback((field, value) => {
    setDraftRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'productionLineId') {
        next.product = '';
        next.capacity = null;
        next.procTime = 0;
        next.endDough = '00:00';
        next.endBatch = '00:00';
      }
      if (field === 'product') {
        const lineId = next.productionLineId || lineIdForNewBatch;
        next.capacity = getCapacityForProduct(value, lineId) ?? prev.capacity;
        next.procTime = getTotalProcessMinutesForLine(value, lineId) || getTotalProcessMinutes(value) || prev.procTime;
        const { endDough, endBatch } = recomputeEndTimesForRow(next);
        next.endDough = endDough;
        next.endBatch = endBatch;
      }
      if (FIELDS_THAT_TRIGGER_AUTO_ADJUST.includes(field) && field !== 'product') {
        const { endDough, endBatch } = recomputeEndTimesForRow(next);
        return { ...next, endDough, endBatch };
      }
      return next;
    });
  }, [lineIdForNewBatch]);

  const openEditModal = useCallback((row) => {
    startEditing(row);
  }, [startEditing]);

  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setDraftRow(null);
  }, []);

  const confirmSave = useCallback(() => {
    if (!draftRow) return;
    const lineId = draftRow.productionLineId || lineIdForNewBatch;
    const toSave = { ...draftRow, productionLineId: lineId };
    setRows((prev) =>
      prev.map((r) => (r.id === toSave.id ? { ...toSave } : r))
    );
    setEditingRowId(null);
    setDraftRow(null);
  }, [draftRow, lineIdForNewBatch, setRows]);

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const fromIdx = rows.findIndex((r) => r.id === displayedRows[index].id);
    const toIdx = rows.findIndex((r) => r.id === displayedRows[index - 1].id);
    if (fromIdx === -1 || toIdx === -1) return;
    reorderRows(fromIdx, toIdx);
  };

  const handleMoveDown = (index) => {
    if (index >= displayedRows.length - 1) return;
    const fromIdx = rows.findIndex((r) => r.id === displayedRows[index].id);
    const toIdx = rows.findIndex((r) => r.id === displayedRows[index + 1].id);
    if (fromIdx === -1 || toIdx === -1) return;
    reorderRows(fromIdx, toIdx);
  };

  const isEditing = (rowId) => editingRowId === rowId;

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <h2 className="text-lg sm:text-xl md:text-2xl 2xl:text-3xl font-semibold text-gray-900 mb-0">
        Scheduling
      </h2>

      <div className="bg-surface-card rounded-card shadow-card p-4 border border-gray-100">
        <label className="block text-kpi-label sm:text-sm-kpi-label font-medium text-gray-700 mb-2 uppercase tracking-wide text-muted">
          Plan date
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={formatDateInput(planDate)}
            onChange={handlePlanDateChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-xs sm:text-sm md:text-base w-full max-w-xs"
            aria-label="Show batches scheduled for this date"
          />
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
              aria-label="Show all dates"
            />
            <span className="text-sm text-gray-700">Show all dates</span>
          </label>
        </div>
        <p className="text-xs text-muted mt-1">
          {showAllDates
            ? 'Table shows all scheduled batches (all dates). Production line filter still applies: All = all lines; selected line = that line only.'
            : 'Table shows only batches scheduled for the selected date. Check "Show all dates" to see batches across all dates.'}
        </p>
        <div className="mt-3">
          <label className="block text-kpi-label sm:text-sm-kpi-label font-medium text-gray-700 mb-2 uppercase tracking-wide text-muted">
            Production line
          </label>
          <select
            value={selectedLineId}
            onChange={(e) => setSelectedLineId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-xs sm:text-sm md:text-base max-w-xs w-full"
            aria-label="Filter by production line"
          >
            <option value="all">All</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">Filter by production line. New batches use the selected line (or first line when All) and get the plan date above as their scheduled date.</p>
        </div>
      </div>

      <div className="bg-surface-card rounded-card shadow-card overflow-hidden border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm">
          <span className="text-xs sm:text-sm 2xl:text-base text-muted font-medium">Production orders</span>
          <button
            type="button"
            onClick={() => addBatch(lineIdForNewBatch)}
            disabled={!lineIdForNewBatch}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-xs sm:text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add batch
          </button>
        </div>
        <div className="overflow-x-auto min-w-0">
          <Tooltip.Provider delayDuration={300}>
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl min-w-[800px]">
            <thead>
              <tr className="bg-surface-card-warm border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Order</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap w-10 sm:w-12">Actions</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Line</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">Date</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[6rem]">Product</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">Sales Order (SO) Qty</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Process Time</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Start Sponge</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">End Dough</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">End Batch</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[3rem]">Batch</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, index) => {
                const displayProcTime = getTotalProcessMinutesForLine(row.product, row.productionLineId) || getTotalProcessMinutes(row.product) || row.procTime || '';
                const capacityDisplay = getCapacityForProduct(row.product, row.productionLineId) ?? row.capacity ?? '—';
                const doughDisplay = getDoughWeightKgForProduct(row.product, row.productionLineId) != null ? `${getDoughWeightKgForProduct(row.product, row.productionLineId)} kg` : '—';
                const totalDoughKg = getTotalDoughWeightKgForProduct(row.product, row.productionLineId);
                const gramsPerUnit = getGramsPerUnitForProduct(row.product, row.productionLineId);
                const totalGramsDisplay = totalDoughKg != null && !Number.isNaN(totalDoughKg) ? (totalDoughKg * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
                const tooltipContent = (
                  <div className="text-left text-xs sm:text-sm space-y-1 p-1 max-w-[280px]">
                    <div><span className="font-medium text-gray-500">Sales Order (SO) Qty:</span> {row.soQty ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">SO-CO Excess:</span> {row.soCoExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Exchange Loss:</span> {row.exchangeForLoss ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Excess:</span> {row.excess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Samples:</span> {row.samples ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Carry Over:</span> {row.carryOverExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Theoretical Excess:</span> {row.theorExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Theoretical Output:</span> {row.theorOutput ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Capacity:</span> {capacityDisplay}</div>
                    <div><span className="font-medium text-gray-500">Dough (kg):</span> {doughDisplay}</div>
                    <div><span className="font-medium text-gray-500">Total dough (kg):</span> {totalDoughKg != null ? `${totalDoughKg} kg` : '—'}</div>
                    <div><span className="font-medium text-gray-500">Grams:</span> {gramsPerUnit != null ? gramsPerUnit : '—'}</div>
                    <div><span className="font-medium text-gray-500">Total grams:</span> {totalGramsDisplay}</div>
                  </div>
                );
                return (
                  <Tooltip.Root
                    key={row.id}
                    delayDuration={300}
                    open={hoveredRowId === row.id || clickedRowId === row.id}
                  >
                    <Tooltip.Trigger asChild>
                  <tr
                    className={`border-b border-gray-100 bg-surface-card hover:bg-gray-50/50 whitespace-nowrap ${clickedRowId === row.id ? 'bg-blue-50/80 ring-1 ring-blue-200 ring-inset' : ''}`}
                    onPointerEnter={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = setTimeout(() => setHoveredRowId(row.id), 300);
                    }}
                    onPointerLeave={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                      setHoveredRowId(null);
                    }}
                    onClick={(e) => {
                      if (e.target.closest('button')) return;
                      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                      setClickedRowId(row.id);
                      clickTimeoutRef.current = setTimeout(() => {
                        setClickedRowId(null);
                        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
                      }, 4000);
                    }}
                  >
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100 text-inherit"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === displayedRows.length - 1}
                          className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100 text-inherit"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center"
                          aria-label="Edit row"
                        >
                          <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBatch(row.id)}
                          className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 transition-colors inline-flex items-center justify-center"
                          aria-label="Delete row"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{getLineById(row.productionLineId)?.name ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{row.date ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.product ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.soQty ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{displayProcTime || '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{row.startSponge ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{row.endDough ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{row.endBatch ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{row.batch ?? '—'}</td>
                  </tr>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-[90vw] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-900">
                        {tooltipContent}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </tbody>
          </table>
          </Tooltip.Provider>
        </div>
        <p className="p-2 sm:p-3 text-xs sm:text-sm 2xl:text-base text-muted bg-surface-card-warm border-t border-gray-200">
          Click Edit on a row to open the edit modal and change all fields. Move rows with Order arrows.
        </p>
      </div>

      <Dialog.Root open={!!editingRowId && !!draftRow} onOpenChange={(open) => !open && cancelEdit()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Edit batch</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 mt-0.5">Change any field below. Theoretical Output is computed from formula or override.</Dialog.Description>
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {draftRow && (() => {
                const r = draftRow;
                const lineId = r.productionLineId || lineIdForNewBatch;
                const editRecipeOptions = lineId ? getRecipesForLine(lineId) : [];
                const capacityVal = getCapacityForProduct(r.product, lineId) ?? r.capacity ?? '—';
                const doughVal = getDoughWeightKgForProduct(r.product, lineId) != null ? `${getDoughWeightKgForProduct(r.product, lineId)} kg` : '—';
                const procTimeVal = getTotalProcessMinutesForLine(r.product, lineId) || getTotalProcessMinutes(r.product) || r.procTime || '—';
                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Line</label>
                      <select value={r.productionLineId ?? ''} onChange={(e) => updateDraft('productionLineId', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900">
                        {lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Date</label>
                      <input type="date" value={r.date ?? ''} onChange={(e) => updateDraft('date', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Product</label>
                      <select value={r.product ?? ''} onChange={(e) => updateDraft('product', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900">
                        <option value="">— Select product —</option>
                        {editRecipeOptions.map((rec) => <option key={rec.id} value={rec.name}>{rec.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Sales Order (SO) Qty</label>
                      <input type="number" value={r.soQty ?? ''} onChange={(e) => updateDraft('soQty', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">SO-CO Excess</label>
                      <input type="number" value={r.soCoExcess ?? ''} onChange={(e) => updateDraft('soCoExcess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Exchange Loss</label>
                      <input type="number" value={r.exchangeForLoss ?? ''} onChange={(e) => updateDraft('exchangeForLoss', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Excess</label>
                      <input type="number" value={r.excess ?? ''} onChange={(e) => updateDraft('excess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Samples</label>
                      <input type="number" value={r.samples ?? ''} onChange={(e) => updateDraft('samples', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Carry Over</label>
                      <input type="number" value={r.carryOverExcess ?? ''} onChange={(e) => updateDraft('carryOverExcess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Excess</label>
                      <input type="number" value={r.theorExcess ?? ''} onChange={(e) => updateDraft('theorExcess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Output (override)</label>
                      <input type="number" value={r.theorOutputOverride !== undefined && r.theorOutputOverride !== '' ? r.theorOutputOverride : computeTheoreticalOutput(r)} onChange={(e) => updateDraft('theorOutputOverride', e.target.value === '' ? '' : e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" placeholder="Computed" />
                      <span className="text-xs text-gray-500">Computed: {computeTheoreticalOutput(r)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Capacity</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{capacityVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Dough (kg)</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{doughVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Process Time</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{procTimeVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Start Sponge</label>
                      <input type="text" value={r.startSponge ?? ''} onChange={(e) => updateDraft('startSponge', e.target.value)} placeholder="HH:MM" className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">End Dough</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{r.endDough ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">End Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{r.endBatch ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{r.batch ?? '—'}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button type="button" onClick={confirmSave} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark">
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
