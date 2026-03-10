import { useState, useCallback, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  getRecipes,
  getRecipesForLine,
  getTotalProcessMinutes,
  addRecipe,
  updateRecipe,
  deleteRecipe,
} from '../store/recipeStore';
import { getLines, getProcessesForLine, getMixingProfiles, getProfileTotalMinutes, updateProductNameInCapacityProfiles } from '../store/productionLinesStore';
import { updateProductNameInRows } from '../store/planStore';

export default function RecipesView() {
  const [selectedLineId, setSelectedLineId] = useState(''); // '' = All lines
  const allRecipes = getRecipes();
  const recipes = selectedLineId ? getRecipesForLine(selectedLineId) : allRecipes;
  const lines = getLines();
  const processesForColumns = selectedLineId
    ? getProcessesForLine(selectedLineId)
    : (lines[0] ? getProcessesForLine(lines[0].id) : []);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({
    name: '',
    productionLineId: lines[0]?.id ?? '',
    processDurations: {},
    endDoughProcessId: 'mixing',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const startEdit = useCallback((recipe) => {
    setEditingId(recipe.id);
    setDraft({
      ...recipe,
      processDurations: { ...(recipe.processDurations || {}) },
      endDoughProcessId: recipe.endDoughProcessId ?? 'mixing',
    });
  }, []);

  const updateDraftField = useCallback((field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'productionLineId') next.processDurations = {};
      return next;
    });
  }, []);

  const updateDraftProcessDuration = useCallback((processId, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, processDurations: { ...(prev.processDurations || {}), [processId]: Number(value) || 0 } };
      return next;
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!draft) return;
    const oldName = getRecipes().find((r) => r.id === draft.id)?.name?.trim();
    const newName = (draft.name || '').trim();
    updateRecipe(draft.id, {
      name: newName,
      productionLineId: draft.productionLineId,
      processDurations: draft.processDurations,
      endDoughProcessId: draft.endDoughProcessId,
    });
    if (oldName && oldName !== newName) {
      updateProductNameInRows(oldName, newName);
      updateProductNameInCapacityProfiles(oldName, newName);
    }
    refresh();
    setEditingId(null);
    setDraft(null);
  }, [draft, refresh]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!addDraft.name?.trim()) return;
    const lineId = addDraft.productionLineId || lines[0]?.id;
    const toAdd = {
      name: addDraft.name.trim(),
      productionLineId: lineId || undefined,
      processDurations: addDraft.processDurations && Object.keys(addDraft.processDurations).length
        ? addDraft.processDurations
        : {},
      endDoughProcessId: addDraft.endDoughProcessId || 'mixing',
    };
    addRecipe(toAdd);
    refresh();
    setAddOpen(false);
    setAddDraft({ name: '', productionLineId: lines[0]?.id ?? '', processDurations: {}, endDoughProcessId: 'mixing' });
  }, [addDraft, lines, refresh]);

  const handleDelete = useCallback((id) => {
    deleteRecipe(id);
    refresh();
    setDeleteConfirmId(null);
    if (editingId === id) cancelEdit();
  }, [refresh, editingId, cancelEdit]);

  const containerClass = 'p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0';

  return (
    <div className={containerClass}>
      <h2 className="text-lg sm:text-xl md:text-2xl 2xl:text-3xl font-semibold text-gray-900">
        Recipe
      </h2>
      <p className="text-xs sm:text-sm 2xl:text-base text-muted">
        Products (recipes) and their stage durations. These drive the Product list and Proc.Time on Scheduling and Dashboard.
      </p>

      <div className="bg-surface-card rounded-card shadow-card overflow-hidden border border-gray-100 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm">
          <span className="text-xs sm:text-sm 2xl:text-base text-muted font-medium">Recipes</span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            Add recipe
          </button>
        </div>
        <div className="overflow-auto min-w-0 border border-gray-200 rounded-b-lg" style={{ maxHeight: 'min(60vh, 480px)' }}>
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg min-w-[320px]">
            <thead className="sticky top-0 z-10 bg-surface-card-warm shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  <select
                    value={selectedLineId}
                    onChange={(e) => setSelectedLineId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-inherit text-xs sm:text-sm md:text-base w-full bg-transparent font-semibold min-w-[7rem] sm:min-w-[8rem] md:min-w-[10rem] max-w-[200px]"
                    aria-label="Production line filter"
                  >
                    <option value="">All</option>
                    {lines.map((line) => (
                      <option key={line.id} value={line.id}>{line.name}</option>
                    ))}
                  </select>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 w-24 sm:w-28 whitespace-nowrap bg-surface-card-warm">Actions</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  Product name
                </th>
                {processesForColumns.map((proc) => (
                  <th key={proc.id} className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                    {proc.name}
                  </th>
                ))}
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  Total Process Time (mins)
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  End Dough
                </th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => {
                const isEditing = editingId === recipe.id;
                const r = isEditing && draft ? draft : recipe;
                const pd = r.processDurations || {};
                const editLineId = (isEditing && draft && draft.productionLineId) ? draft.productionLineId : recipe.productionLineId;
                const displayTotal = processesForColumns.length > 0
                  ? processesForColumns.reduce((s, p) => s + (Number((isEditing && draft ? draft.processDurations : pd)[p.id]) || 0), 0)
                  : (isEditing && draft
                    ? (draft.mixing || 0) + (draft.makeupDividing || 0) + (draft.makeupPanning || 0) + (draft.baking || 0) + (draft.packaging || 0)
                    : getTotalProcessMinutes(recipe.name));
                const inputClass = isEditing
                  ? 'border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white w-full max-w-[100px] text-inherit'
                  : 'border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 w-full max-w-[100px] cursor-not-allowed text-inherit';
                return (
                  <tr
                    key={recipe.id}
                    className={`border-b border-gray-100 ${isEditing ? 'bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-gray-50/50'}`}
                  >
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                      {isEditing ? (
                        <select
                          value={r.productionLineId ?? ''}
                          onChange={(e) => updateDraftField('productionLineId', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white text-inherit min-w-[7rem] sm:min-w-[8rem] md:min-w-[9rem]"
                        >
                          {lines.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      ) : (
                        (selectedLineId ? lines.find((l) => l.id === selectedLineId)?.name : lines.find((l) => l.id === recipe.productionLineId)?.name) ?? '—'
                      )}
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-primary bg-primary text-white text-xs font-medium hover:bg-primary-dark"
                            >
                              <Check className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(recipe)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(recipe.id)}
                              className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      <input
                        type="text"
                        value={r.name ?? ''}
                        onChange={(e) => updateDraftField('name', e.target.value)}
                        disabled={!isEditing}
                        className={isEditing ? 'border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white min-w-[120px] sm:min-w-[140px] text-inherit' : 'border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 min-w-[120px] sm:min-w-[140px] cursor-not-allowed text-inherit'}
                      />
                    </td>
                    {processesForColumns.map((proc) => {
                      const editProfiles = isEditing && editLineId ? getMixingProfiles(editLineId, proc.id) : [];
                      const currentMins = Number(pd[proc.id]) || 0;
                      const hasExplicitProfile = editProfiles.some((p) => getProfileTotalMinutes(editLineId, proc.id, p.id) === currentMins);
                      const selectedProfileId = hasExplicitProfile
                        ? (editProfiles.find((p) => getProfileTotalMinutes(editLineId, proc.id, p.id) === currentMins)?.id ?? '')
                        : '';
                      return (
                        <td key={proc.id} className="py-2 sm:py-2.5 px-2 sm:px-4">
                          {isEditing && editProfiles.length > 0 ? (
                            <select
                              value={selectedProfileId}
                              onChange={(e) => {
                                const pid = e.target.value;
                                const mins = pid ? getProfileTotalMinutes(editLineId, proc.id, pid) : 0;
                                updateDraftProcessDuration(proc.id, mins);
                              }}
                              className={`${inputClass.replace('cursor-not-allowed', '')} min-w-[5.5rem] sm:min-w-[6rem] md:min-w-[7rem]`}
                            >
                              <option value="">— Select —</option>
                              {editProfiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {getProfileTotalMinutes(editLineId, proc.id, p.id)} min
                                </option>
                              ))}
                            </select>
                          ) : isEditing && editProfiles.length === 0 ? (
                            <span className="text-gray-500 text-xs sm:text-sm">N/A</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={pd[proc.id] ?? ''}
                              onChange={(e) => updateDraftProcessDuration(proc.id, e.target.value)}
                              disabled={!isEditing}
                              className={inputClass}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 tabular-nums select-none">{displayTotal}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      {(() => {
                        const lineId = (isEditing && draft ? draft.productionLineId : recipe.productionLineId) ?? '';
                        const procs = lineId ? getProcessesForLine(lineId) : [];
                        const currentEndDough = (isEditing && draft ? draft.endDoughProcessId : recipe.endDoughProcessId) ?? 'mixing';
                        const selectedProc = procs.find((p) => p.id === currentEndDough);
                        if (isEditing && procs.length > 0) {
                          return (
                            <select
                              value={currentEndDough}
                              onChange={(e) => updateDraftField('endDoughProcessId', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white text-inherit min-w-[8rem] sm:min-w-[10rem]"
                              aria-label="End Dough process"
                            >
                              {procs.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          );
                        }
                        return (
                          <span className="text-gray-700 text-inherit">
                            {selectedProc ? selectedProc.name : (currentEndDough || '—')}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add recipe dialog */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Add recipe</Dialog.Title>
            <div className="mt-4 space-y-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Production line</label>
              <select
                value={addDraft.productionLineId ?? ''}
                onChange={(e) => {
                  const lineId = (e.target.value || lines[0]?.id) ?? '';
                  const procs = lineId ? getProcessesForLine(lineId) : [];
                  const firstProcessId = procs[0]?.id ?? 'mixing';
                  setAddDraft((p) => ({
                    ...p,
                    productionLineId: lineId,
                    processDurations: {},
                    endDoughProcessId: firstProcessId,
                  }));
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm sm:text-base bg-white min-w-[10rem]"
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Product name</label>
              <input
                type="text"
                value={addDraft.name}
                onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm sm:text-base"
                placeholder="e.g. Everyday Bread 8s"
              />
              {addDraft.productionLineId && (() => {
                const addLineProcs = getProcessesForLine(addDraft.productionLineId);
                return addLineProcs.length > 0 ? (
                  <>
                    <span className="block text-xs sm:text-sm font-medium text-gray-700 mt-3">Process profile (sets duration in mins)</span>
                    {addLineProcs.map((proc) => {
                      const profiles = getMixingProfiles(addDraft.productionLineId, proc.id);
                      const hasValue = addDraft.processDurations && Object.prototype.hasOwnProperty.call(addDraft.processDurations, proc.id);
                      const currentMins = hasValue ? Number(addDraft.processDurations[proc.id]) : null;
                      const selectedProfileId = hasValue && currentMins != null
                        ? (profiles.find((p) => getProfileTotalMinutes(addDraft.productionLineId, proc.id, p.id) === currentMins)?.id ?? '')
                        : '';
                      if (profiles.length === 0) {
                        return (
                          <div key={proc.id}>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700">{proc.name}</label>
                            <div className="w-full border border-gray-200 rounded px-3 py-2 text-gray-500 text-sm bg-gray-50">
                              N/A
                            </div>
                            <p className="text-[0.65rem] sm:text-xs text-gray-400 mt-0.5">No process profile added yet for this process.</p>
                          </div>
                        );
                      }
                      return (
                        <div key={proc.id}>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700">{proc.name}</label>
                          <select
                            value={selectedProfileId}
                            onChange={(e) => {
                              const pid = e.target.value;
                              const mins = pid ? getProfileTotalMinutes(addDraft.productionLineId, proc.id, pid) : 0;
                              setAddDraft((p) => ({
                                ...p,
                                processDurations: { ...(p.processDurations || {}), [proc.id]: mins },
                              }));
                            }}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm bg-white min-w-[6rem] sm:min-w-[7rem]"
                          >
                            <option value="">— Select —</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {getProfileTotalMinutes(addDraft.productionLineId, proc.id, p.id)} min
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </>
                ) : null;
              })()}
              {addDraft.productionLineId && (() => {
                const addLineProcs = getProcessesForLine(addDraft.productionLineId);
                if (addLineProcs.length === 0) return null;
                const currentEndDough = addDraft.endDoughProcessId || 'mixing';
                const validEndDough = addLineProcs.some((p) => p.id === currentEndDough) ? currentEndDough : (addLineProcs[0]?.id ?? 'mixing');
                return (
                  <div className="mt-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">End Dough</label>
                    <p className="text-[0.65rem] sm:text-xs text-gray-400 mt-0.5 mb-1">
                      Process that defines the &quot;End Dough&quot; time on the Scheduling page (Start Sponge + duration up to this process).
                    </p>
                    <select
                      value={validEndDough}
                      onChange={(e) => setAddDraft((p) => ({ ...p, endDoughProcessId: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm sm:text-base bg-white min-w-[10rem]"
                    >
                      {addLineProcs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!addDraft.name?.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm */}
      <Dialog.Root open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg">
            <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Delete recipe?</Dialog.Title>
            <p className="mt-2 text-xs sm:text-sm text-gray-600">
              This will remove the recipe from the list. Product will no longer appear in the Scheduling dropdown.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
