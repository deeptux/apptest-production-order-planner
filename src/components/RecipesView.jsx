import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  getRecipes,
  getRecipesForLine,
  getTotalProcessMinutes,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  repairRecipesAfterLinesChange,
} from '../store/recipeStore';
import { getLines, getProcessesForLine, getMixingProfiles, getProfileTotalMinutes, updateProductNameInCapacityProfiles } from '../store/productionLinesStore';
import { updateProductNameInRows } from '../store/planStore';
import { useLinesVersion, useRecipesVersion } from '../hooks/useConfigStores';

// Process profiles store tags on `tags[]` (plus legacy `tag` string). Recipe picker search must match any tag, not only the old single field.
function profileTagsForSearch(p) {
  const parts = [];
  if (Array.isArray(p.tags)) {
    for (const t of p.tags) {
      const s = String(t ?? '').trim();
      if (s) parts.push(s.toLowerCase());
    }
  }
  const leg = String(p.tag ?? '').trim().toLowerCase();
  if (leg) parts.push(leg);
  return parts.join(' ');
}

function profileTagsDisplayLine(p) {
  const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
  const leg = p.tag && String(p.tag).trim();
  if (leg && !tags.some((t) => t.toLowerCase() === leg.toLowerCase())) tags.push(leg);
  return tags.length ? tags.join(', ') : '';
}

export default function RecipesView() {
  const { version: recipesVersion } = useRecipesVersion();
  const { version: linesVersion } = useLinesVersion();
  const [selectedLineId, setSelectedLineId] = useState(''); // '' = All lines
  const allRecipes = useMemo(() => getRecipes(), [recipesVersion]);
  const lines = useMemo(() => getLines(), [linesVersion]);
  const recipes = selectedLineId ? getRecipesForLine(selectedLineId) : allRecipes;
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
    processProfileIds: {},
    endDoughProcessId: 'mixing',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [, setRefreshTick] = useState(0);
  const [profilePickerOpenKey, setProfilePickerOpenKey] = useState(null); // `${context}:${recipeId}:${procId}` | null
  const [profilePickerQuery, setProfilePickerQuery] = useState('');
  const profilePickerRef = useRef(null);
  const profilePickerPanelRef = useRef(null);
  const [profilePickerBounds, setProfilePickerBounds] = useState(null); // { left, top, width } | null

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    // If lines/processes were edited or a line got deleted, repair recipes first.
    repairRecipesAfterLinesChange();
  }, [linesVersion]);

  useEffect(() => {
    if (!selectedLineId) return;
    const stillExists = lines.some((l) => l.id === selectedLineId);
    if (!stillExists) setSelectedLineId('');
  }, [lines, selectedLineId]);

  useEffect(() => {
    if (!profilePickerOpenKey) return undefined;
    const onDown = (e) => {
      const triggerRoot = profilePickerRef.current;
      const panelRoot = profilePickerPanelRef.current;
      const inTrigger = !!triggerRoot && triggerRoot.contains(e.target);
      const inPanel = !!panelRoot && panelRoot.contains(e.target);
      if (!inTrigger && !inPanel) {
        setProfilePickerOpenKey(null);
        setProfilePickerQuery('');
        setProfilePickerBounds(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [profilePickerOpenKey]);

  useEffect(() => {
    if (!profilePickerOpenKey) return undefined;
    const onScrollOrResize = () => {
      // Keep it simple: close on scroll/resize to avoid misalignment.
      setProfilePickerOpenKey(null);
      setProfilePickerQuery('');
      setProfilePickerBounds(null);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [profilePickerOpenKey]);

  const profileOptionLabel = useCallback((lineId, procId, profile) => {
    const mins = getProfileTotalMinutes(lineId, procId, profile.id);
    return `${mins} min`;
  }, []);

  const ProfilePicker = useCallback(function ProfilePicker({ openKey, lineId, procId, selectedProfileId, profiles, onSelect }) {
    const isOpen = profilePickerOpenKey === openKey;
    const q = profilePickerQuery.trim().toLowerCase();
    const filtered = q
      ? profiles.filter((p) => {
          const mins = String(getProfileTotalMinutes(lineId, procId, p.id));
          const tagHaystack = profileTagsForSearch(p);
          return mins.includes(q) || tagHaystack.includes(q);
        })
      : profiles;
    const selected = selectedProfileId ? profiles.find((p) => p.id === selectedProfileId) : null;
    return (
      <div className="relative" ref={isOpen ? profilePickerRef : null}>
        <button
          type="button"
          onClick={() => {
            setProfilePickerOpenKey((prev) => {
              const next = prev === openKey ? null : openKey;
              if (next) {
                const r = profilePickerRef.current?.querySelector('button')?.getBoundingClientRect?.();
                // Prefer currentTarget bounds if available
              }
              return next;
            });
          }}
          onMouseDown={(e) => {
            // Capture trigger bounds before opening so portal can position correctly.
            const rect = e.currentTarget.getBoundingClientRect();
            setProfilePickerBounds({ left: rect.left, top: rect.bottom + 6, width: rect.width });
            setProfilePickerQuery('');
          }}
          className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white w-full min-w-[7rem] sm:min-w-[8rem] text-left"
          title="Select process profile (searchable by minutes or tag)"
        >
          {selected ? profileOptionLabel(lineId, procId, selected) : '— Select —'}
        </button>
        {isOpen && (
          createPortal(
            <div
              ref={profilePickerPanelRef}
              className="fixed z-[100] rounded-lg border border-gray-200 bg-white shadow-lg"
              style={{
                left: profilePickerBounds?.left ?? 0,
                top: profilePickerBounds?.top ?? 0,
                width: Math.max(profilePickerBounds?.width ?? 0, 240),
                maxWidth: 'min(24rem, 90vw)',
              }}
            >
              <div className="p-2 border-b border-gray-200">
                <input
                  value={profilePickerQuery}
                  onChange={(e) => setProfilePickerQuery(e.target.value)}
                  placeholder="Search by minutes or tag…"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-auto">
                <button
                  type="button"
                  onClick={() => { onSelect(''); setProfilePickerOpenKey(null); setProfilePickerQuery(''); setProfilePickerBounds(null); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  — Select —
                </button>
                {filtered.map((p) => {
                  const tagLine = profileTagsDisplayLine(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onSelect(p.id); setProfilePickerOpenKey(null); setProfilePickerQuery(''); setProfilePickerBounds(null); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${p.id === selectedProfileId ? 'bg-primary/5' : ''}`}
                    >
                      <span className="tabular-nums font-medium text-gray-900">{profileOptionLabel(lineId, procId, p)}</span>
                      {tagLine ? (
                        <span className="block text-xs text-gray-500 mt-0.5 truncate" title={tagLine}>
                          {tagLine}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                )}
              </div>
            </div>,
            document.body
          )
        )}
      </div>
    );
  }, [getProfileTotalMinutes, profileOptionLabel, profilePickerOpenKey, profilePickerQuery]);

  const formatMinutesAsHours = useCallback((mins) => {
    const total = Math.max(0, Number(mins) || 0);
    const h = Math.floor(total / 60);
    const m = Math.round(total % 60);
    if (h <= 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, []);

  const startEdit = useCallback((recipe) => {
    setEditingId(recipe.id);
    setDraft({
      ...recipe,
      processDurations: { ...(recipe.processDurations || {}) },
      processProfileIds: { ...(recipe.processProfileIds || {}) },
      endDoughProcessId: recipe.endDoughProcessId ?? 'mixing',
    });
  }, []);

  const updateDraftField = useCallback((field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'productionLineId') {
        next.processDurations = {};
        next.processProfileIds = {};
      }
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
      processProfileIds: draft.processProfileIds,
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
      processProfileIds: addDraft.processProfileIds && Object.keys(addDraft.processProfileIds).length
        ? addDraft.processProfileIds
        : {},
      endDoughProcessId: addDraft.endDoughProcessId || 'mixing',
    };
    addRecipe(toAdd);
    refresh();
    setAddOpen(false);
    setAddDraft({ name: '', productionLineId: lines[0]?.id ?? '', processDurations: {}, processProfileIds: {}, endDoughProcessId: 'mixing' });
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
          <table className="w-full border-collapse text-[11px] sm:text-xs md:text-sm lg:text-base min-w-[720px]">
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
                  <th key={proc.id} className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm min-w-[6.5rem]">
                    {proc.name}
                  </th>
                ))}
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">
                  Total Process Time
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
                  ? 'border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white w-16 sm:w-20 md:w-24 text-center tabular-nums text-inherit'
                  : 'border border-gray-200 rounded px-2 py-1 text-gray-700 bg-gray-50 w-16 sm:w-20 md:w-24 cursor-not-allowed text-center tabular-nums text-inherit';
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
                      const explicitProfileId = r.processProfileIds?.[proc.id] ?? '';
                      const selectedProfileId = explicitProfileId && editProfiles.some((p) => p.id === explicitProfileId)
                        ? explicitProfileId
                        : ((editProfiles.find((p) => getProfileTotalMinutes(editLineId, proc.id, p.id) === currentMins)?.id) ?? '');
                      return (
                        <td key={proc.id} className="py-2 sm:py-2.5 px-2 sm:px-4">
                          {isEditing && editProfiles.length > 0 ? (
                            <ProfilePicker
                              openKey={`edit:${recipe.id}:${proc.id}`}
                              lineId={editLineId}
                              procId={proc.id}
                              profiles={editProfiles}
                              selectedProfileId={selectedProfileId}
                              onSelect={(pid) => {
                                const mins = pid ? getProfileTotalMinutes(editLineId, proc.id, pid) : 0;
                                updateDraftProcessDuration(proc.id, mins);
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  const nextProfileIds = { ...(prev.processProfileIds || {}) };
                                  if (pid) nextProfileIds[proc.id] = pid;
                                  else delete nextProfileIds[proc.id];
                                  return { ...prev, processProfileIds: nextProfileIds };
                                });
                              }}
                            />
                          ) : isEditing && editProfiles.length === 0 ? (
                            <span className="text-gray-500 text-xs sm:text-sm">N/A</span>
                          ) : (
                            <span className="inline-block tabular-nums text-gray-800 min-w-[3.5rem] text-center">
                              {(pd[proc.id] ?? 0)} min
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 tabular-nums select-none whitespace-nowrap">{formatMinutesAsHours(displayTotal)}</td>
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
                    processProfileIds: {},
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
                          <ProfilePicker
                            openKey={`add:${proc.id}`}
                            lineId={addDraft.productionLineId}
                            procId={proc.id}
                            profiles={profiles}
                            selectedProfileId={selectedProfileId}
                            onSelect={(pid) => {
                              const mins = pid ? getProfileTotalMinutes(addDraft.productionLineId, proc.id, pid) : 0;
                              setAddDraft((p) => ({
                                ...p,
                                processDurations: { ...(p.processDurations || {}), [proc.id]: mins },
                                processProfileIds: pid
                                  ? { ...(p.processProfileIds || {}), [proc.id]: pid }
                                  : (() => {
                                      const next = { ...(p.processProfileIds || {}) };
                                      delete next[proc.id];
                                      return next;
                                    })(),
                              }));
                            }}
                          />
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
