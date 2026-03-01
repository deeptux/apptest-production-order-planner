import { useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePlan } from '../context/PlanContext';
import { recomputeEndTimesForRow } from '../utils/stageDurations';
import { getRecipesForLine, getTotalProcessMinutes, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProduct } from '../store/capacityProfileStore';
import { getLines, getLineById } from '../store/productionLinesStore';

const FIELDS_THAT_TRIGGER_AUTO_ADJUST = ['startSponge', 'product'];

export default function SchedulingView() {
  const { planDate, setPlanDate, rows, setRows, reorderRows, addBatch, deleteBatch } = usePlan();
  const [editingRowId, setEditingRowId] = useState(null);
  const [draftRow, setDraftRow] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState('all');
  const [showAllDates, setShowAllDates] = useState(false);
  const lines = getLines();

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

  const openConfirmModal = useCallback(() => {
    if (editingRowId && draftRow) setConfirmOpen(true);
  }, [editingRowId, draftRow]);

  const cancelEdit = useCallback(() => {
    setConfirmOpen(false);
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
    setConfirmOpen(false);
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
  const displayRow = (row) => (isEditing(row.id) && draftRow ? draftRow : row);

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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg">
            <thead>
              <tr className="bg-surface-card-warm border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Order</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Production line</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Date</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Product</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">SO Qty</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Theor. Output</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Capacity</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Proc.Time</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Start Sponge</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">End Dough</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">End Batch</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">Batch</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap w-12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, index) => {
                const editing = isEditing(row.id);
                const r = displayRow(row);
                const lineId = r.productionLineId || selectedLineId;
                const displayCapacity = editing ? (r.capacity ?? '') : (getCapacityForProduct(row.product, row.productionLineId) ?? row.capacity ?? '');
                const displayProcTime = editing ? (r.procTime ?? '') : (getTotalProcessMinutesForLine(row.product, row.productionLineId) || getTotalProcessMinutes(row.product) || row.procTime || '');
                const editRecipeOptions = lineId ? getRecipesForLine(lineId) : [];
                const inputClass = editing
                  ? 'border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white'
                  : 'border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed';
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 bg-surface-card ${editing ? 'ring-1 ring-primary/30 bg-primary/5' : 'hover:bg-gray-50/50'}`}
                  >
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
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
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      {editing ? (
                        <select
                          value={r.productionLineId ?? ''}
                          onChange={(e) => updateDraft('productionLineId', e.target.value)}
                          className="w-full max-w-[160px] border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white text-inherit"
                        >
                          {lines.map((line) => (
                            <option key={line.id} value={line.id}>{line.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700 text-inherit">{getLineById(r.productionLineId)?.name ?? '—'}</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      {editing ? (
                        <input
                          type="date"
                          value={r.date ?? ''}
                          onChange={(e) => updateDraft('date', e.target.value)}
                          className="w-full max-w-[140px] border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white text-inherit"
                        />
                      ) : (
                        <span className="text-gray-700 text-inherit">{r.date ?? '—'}</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      {editing ? (
                        <select
                          value={r.product ?? ''}
                          onChange={(e) => updateDraft('product', e.target.value)}
                          className="w-full max-w-[180px] border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white text-inherit"
                        >
                          <option value="">— Select product —</option>
                          {editRecipeOptions.map((rec) => (
                            <option key={rec.id} value={rec.name}>{rec.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-800 text-inherit">{r.product ?? '—'}</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="number"
                        value={r.soQty ?? ''}
                        onChange={(e) => updateDraft('soQty', Number(e.target.value) || 0)}
                        disabled={!editing}
                        className={`w-20 ${inputClass}`}
                        readOnly={!editing}
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="number"
                        value={r.theorOutput ?? ''}
                        onChange={(e) => updateDraft('theorOutput', Number(e.target.value) || 0)}
                        disabled={!editing}
                        className={`w-20 ${inputClass}`}
                        readOnly={!editing}
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="number"
                        value={displayCapacity}
                        readOnly
                        disabled
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed"
                        title="From capacity profile (read-only)"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="number"
                        value={displayProcTime}
                        readOnly
                        disabled
                        className="w-16 border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed"
                        title="From recipe (read-only)"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="text"
                        value={r.startSponge ?? ''}
                        onChange={(e) => updateDraft('startSponge', e.target.value)}
                        placeholder="HH:MM"
                        disabled={!editing}
                        className={`w-20 ${inputClass}`}
                        readOnly={!editing}
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="text"
                        value={r.endDough ?? ''}
                        readOnly
                        disabled
                        placeholder="HH:MM"
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed"
                        title="Computed (read-only)"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="text"
                        value={r.endBatch ?? ''}
                        readOnly
                        disabled
                        placeholder="HH:MM"
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed"
                        title="Computed (read-only)"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="text"
                        value={r.batch ?? ''}
                        readOnly
                        disabled
                        className="w-16 border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 cursor-not-allowed"
                        title="Derived (read-only)"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <div className="flex items-center gap-1">
                        {editing ? (
                          <button
                            type="button"
                            onClick={openConfirmModal}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-primary bg-primary text-white text-xs font-medium hover:bg-primary-dark"
                            aria-label="Confirm changes"
                          >
                            <Check className="w-4 h-4" />
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(row)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100"
                            aria-label="Edit row"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                        {editing ? (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100"
                            aria-label="Cancel edit"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deleteBatch(row.id)}
                            className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 transition-colors"
                            aria-label="Delete row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="p-2 sm:p-3 text-xs sm:text-sm 2xl:text-base text-muted bg-surface-card-warm border-t border-gray-200">
          Press Edit on a row to change it; press Confirm to save. Changes are reflected on the Dashboard after you confirm.
        </p>
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={(open) => !open && cancelEdit()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Save changes?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-600">
              Apply these changes to the production order and update the plan? This will sync to the Dashboard and other clients.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={confirmSave}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
              >
                Confirm
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
