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
import { getLines, getProcessesForLine } from '../store/productionLinesStore';

export default function RecipesView() {
  const [selectedLineId, setSelectedLineId] = useState(() => getLines()[0]?.id ?? '');
  const [recipes, setRecipesState] = useState(() => getRecipesForLine(getLines()[0]?.id ?? ''));
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({
    name: '',
    processDurations: {},
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDurations, setNewRecipeDurations] = useState({});

  const lines = getLines();
  const processes = selectedLineId ? getProcessesForLine(selectedLineId) : [];

  const refresh = useCallback(() => {
    setRecipesState(getRecipesForLine(selectedLineId));
  }, [selectedLineId]);

  useEffect(() => {
    setRecipesState(getRecipesForLine(selectedLineId));
  }, [selectedLineId]);

  const startEdit = useCallback((recipe) => {
    setEditingId(recipe.id);
    setDraft({ ...recipe, processDurations: { ...(recipe.processDurations || {}) } });
  }, []);

  const updateDraftField = useCallback((field, value) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : null));
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
    updateRecipe(draft.id, { name: draft.name, processDurations: draft.processDurations });
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
    const toAdd = {
      name: addDraft.name.trim(),
      productionLineId: selectedLineId || undefined,
      processDurations: addDraft.processDurations && Object.keys(addDraft.processDurations).length
        ? addDraft.processDurations
        : {},
    };
    addRecipe(toAdd);
    refresh();
    setAddOpen(false);
    setAddDraft({ name: '', processDurations: {} });
  }, [addDraft, selectedLineId, refresh]);

  const handleDelete = useCallback((id) => {
    deleteRecipe(id);
    refresh();
    setDeleteConfirmId(null);
    if (editingId === id) cancelEdit();
  }, [refresh, editingId, cancelEdit]);

  const handleAddInline = useCallback(() => {
    if (!newRecipeName.trim() || !selectedLineId) return;
    addRecipe({
      name: newRecipeName.trim(),
      productionLineId: selectedLineId,
      processDurations: { ...newRecipeDurations },
    });
    setNewRecipeName('');
    setNewRecipeDurations({});
    refresh();
  }, [newRecipeName, selectedLineId, newRecipeDurations, refresh]);

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
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-inherit text-xs sm:text-sm md:text-base max-w-[200px] w-full bg-transparent font-semibold"
                    aria-label="Production line"
                  >
                    <option value="">— Select production line —</option>
                    {lines.map((line) => (
                      <option key={line.id} value={line.id}>{line.name}</option>
                    ))}
                  </select>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  Product name
                </th>
                {processes.map((proc) => (
                  <th key={proc.id} className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                    {proc.name}
                  </th>
                ))}
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  Total Process Time (mins)
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 w-24 sm:w-28 whitespace-nowrap bg-surface-card-warm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="sticky top-12 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">
                  {selectedLineId ? (lines.find((l) => l.id === selectedLineId)?.name ?? '—') : '—'}
                </td>
                <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                  <input
                    type="text"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="Product name"
                    className="border border-gray-300 rounded-lg px-2 py-1 w-full min-w-[120px] text-inherit"
                  />
                </td>
                {processes.map((proc) => (
                  <td key={proc.id} className="py-2 sm:py-2.5 px-2 sm:px-4">
                    <input
                      type="number"
                      min={0}
                      value={newRecipeDurations[proc.id] ?? ''}
                      onChange={(e) => setNewRecipeDurations((p) => ({ ...p, [proc.id]: Number(e.target.value) || 0 }))}
                      className="border border-gray-300 rounded px-2 py-1 w-full max-w-[80px] text-inherit"
                    />
                  </td>
                ))}
                <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-500 text-xs">—</td>
                <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                  <button
                    type="button"
                    onClick={handleAddInline}
                    disabled={!newRecipeName.trim() || !selectedLineId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </td>
              </tr>
              {recipes.map((recipe) => {
                const isEditing = editingId === recipe.id;
                const r = isEditing && draft ? draft : recipe;
                const pd = r.processDurations || {};
                const displayTotal = selectedLineId && processes.length > 0
                  ? processes.reduce((s, p) => s + (Number((isEditing && draft ? draft.processDurations : pd)[p.id]) || 0), 0)
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
                      {selectedLineId ? lines.find((l) => l.id === selectedLineId)?.name ?? '—' : '—'}
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
                    {processes.map((proc) => (
                      <td key={proc.id} className="py-2 sm:py-2.5 px-2 sm:px-4">
                        <input
                          type="number"
                          min={0}
                          value={pd[proc.id] ?? ''}
                          onChange={(e) => updateDraftProcessDuration(proc.id, e.target.value)}
                          disabled={!isEditing}
                          className={inputClass}
                        />
                      </td>
                    ))}
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 tabular-nums select-none">{displayTotal}</td>
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
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Product name</label>
              <input
                type="text"
                value={addDraft.name}
                onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm sm:text-base"
                placeholder="e.g. Everyday Bread 8s"
              />
              {selectedLineId && processes.length > 0 && (
                <>
                  <span className="block text-xs sm:text-sm font-medium text-gray-700 mt-3">Process durations (mins)</span>
                  {processes.map((proc) => (
                    <div key={proc.id}>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">{proc.name}</label>
                      <input
                        type="number"
                        min={0}
                        value={addDraft.processDurations[proc.id] ?? ''}
                        onChange={(e) => setAddDraft((p) => ({
                          ...p,
                          processDurations: { ...(p.processDurations || {}), [proc.id]: Number(e.target.value) || 0 },
                        }))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm"
                      />
                    </div>
                  ))}
                </>
              )}
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
