// Plan rows live here. productionLineId + capacity come from Production; proc times come from Recipe per line.
import { getPlan, updatePlan } from '../api/plan';
import { isSupabaseConfigured } from '../lib/supabase';
import { getRecipesForLine, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProductFromLine, getYieldForProductFromLine, getLines, getStaggerMinutesForLine } from '../store/productionLinesStore';
import { recomputeEndTimesForRow, parseTimeToMinutes, addMinutesToTime } from '../utils/stageDurations';

const PLAN_ROWS_STORAGE_KEY = 'loaf-plan-rows';
/** Persisted: last plan sync source + stale flag (survives refresh). */
const PLAN_SYNC_META_KEY = 'loaf-plan-sync-meta';

export const PLAN_SYNC_SOURCE = {
  REMOTE: 'remote',
  LOCAL_FALLBACK: 'local_fallback',
  LOCAL_ONLY: 'local_only',
  PENDING: 'pending',
};

function readPlanSyncMeta() {
  try {
    const raw = localStorage.getItem(PLAN_SYNC_META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m && typeof m === 'object' ? m : null;
  } catch (_) {
    return null;
  }
}

function writePlanSyncMeta(meta) {
  try {
    localStorage.setItem(
      PLAN_SYNC_META_KEY,
      JSON.stringify({ ...meta, at: meta.at ?? Date.now() })
    );
  } catch (_) {}
}

function loadInitialPlanSyncState() {
  if (!isSupabaseConfigured()) {
    return { planSyncSource: PLAN_SYNC_SOURCE.LOCAL_ONLY, planCacheStale: false };
  }
  const meta = readPlanSyncMeta();
  if (meta?.source === PLAN_SYNC_SOURCE.LOCAL_FALLBACK && meta?.stale) {
    return { planSyncSource: PLAN_SYNC_SOURCE.LOCAL_FALLBACK, planCacheStale: true };
  }
  if (meta?.source === PLAN_SYNC_SOURCE.REMOTE) {
    return { planSyncSource: PLAN_SYNC_SOURCE.REMOTE, planCacheStale: false };
  }
  return { planSyncSource: PLAN_SYNC_SOURCE.PENDING, planCacheStale: false };
}

function parsePlanDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getInitialPlanDate() {
  // first time we boot, scheduling date = today
  return new Date();
}

// normalize dates to YYYY-MM-DD for inputs + localStorage
function toDateString(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// pieces: SO-CO + exch loss + excess + samples (formula from the spec / spreadsheet side)
export function computeTheoreticalOutput(row) {
  const soCo = Number(row.soCoExcess) || 0;
  const loss = Number(row.exchangeForLoss) || 0;
  const excess = Number(row.excess) || 0;
  const samples = Number(row.samples) || 0;
  return soCo + loss + excess + samples;
}

// one row's SO-CO field — must match normalizeRow() logic.
// gotcha: if user only entered Total Qty and we split batches, row 0 often has soCoExcess=0 and batch qty = yield;
// follow-up rows literally store pieceCount in soCoExcess. Don't replace 0 with full soQty in the UI.
export function computeSoCoExcessFromRawRow(r) {
  const soQty = Number(r?.soQty) || 0;
  const salesOrder =
    r?.salesOrder !== undefined && r.salesOrder !== '' ? Number(r.salesOrder) : undefined;
  const carryOverExcess = Number(r?.carryOverExcess) || 0;
  return r?.soCoExcess !== undefined
    ? Number(r.soCoExcess)
    : salesOrder !== undefined && !Number.isNaN(salesOrder)
      ? Math.max(0, salesOrder - carryOverExcess)
      : soQty;
}

// tables skip SO-CO for break rows (return null -> render em dash)
export function resolveSoCoExcessForDisplay(r) {
  if (!r || r.isBreak) return null;
  return computeSoCoExcessFromRawRow(r);
}

// on save from Scheduling edit modal: if they typed a sales order, persist SO minus carry.
// if no sales order, keep whatever computeSoCoExcessFromRawRow says (so batch 2+ don't all get wiped to 0)
export function soCoExcessForPersistedRow(r) {
  const salesPayload =
    r?.salesOrder !== undefined && r.salesOrder !== '' && !Number.isNaN(Number(r.salesOrder))
      ? Number(r.salesOrder)
      : undefined;
  if (salesPayload !== undefined && !Number.isNaN(salesPayload)) {
    return Math.max(0, salesPayload - (Number(r?.carryOverExcess) || 0));
  }
  return computeSoCoExcessFromRawRow(r);
}

function normalizeRow(r) {
  const lineId = r.productionLineId || getLines()[0]?.id || 'line-loaf';
  const soQty = Number(r.soQty) || 0;
  const salesOrder = r.salesOrder !== undefined && r.salesOrder !== '' ? Number(r.salesOrder) : undefined;
  const carryOverExcess = Number(r.carryOverExcess) || 0;
  const soCoExcess = computeSoCoExcessFromRawRow(r);
  const exchangeForLoss = Number(r.exchangeForLoss) || 0;
  const excess = Number(r.excess) || 0;
  const samples = r.samples !== undefined ? Number(r.samples) : 2;
  const theorExcess = Number(r.theorExcess) || 0;
  const theorOutputOverride = r.theorOutputOverride;
  const hasTheorOutputOverride = theorOutputOverride !== undefined && theorOutputOverride !== '';
  const storedTheorOutput = r.theorOutput !== undefined && r.theorOutput !== '' ? Number(r.theorOutput) : undefined;
  const hasStoredTheorOutput = storedTheorOutput !== undefined && !Number.isNaN(storedTheorOutput);
  const theorOutput = hasTheorOutputOverride
    ? Number(theorOutputOverride)
    : (hasStoredTheorOutput ? storedTheorOutput : computeTheoreticalOutput({ soCoExcess, exchangeForLoss, excess, samples }));
  const base = {
    ...r,
    productionLineId: lineId,
    date: r.date && typeof r.date === 'string' ? r.date.split('T')[0] : r.date,
    salesOrder: Number.isNaN(salesOrder) ? undefined : salesOrder,
    soCoExcess,
    exchangeForLoss,
    excess,
    samples,
    carryOverExcess,
    theorExcess,
    theorOutputOverride,
    theorOutput,
  };
  if (r.isBreak) {
    const sm = parseTimeToMinutes(r.startSponge);
    const em = parseTimeToMinutes(r.endBatch);
    const wallDur = em > sm ? em - sm : null;
    let bm = Number(r.breakMinutes);
    if (!Number.isFinite(bm) || bm <= 0) {
      bm = wallDur != null && wallDur > 0 ? wallDur : 0;
    }
    const pt = Number.isFinite(Number(r.procTime)) && Number(r.procTime) > 0 ? Number(r.procTime) : bm;
    return { ...base, breakMinutes: bm, procTime: pt };
  }
  return base;
}

function getInitialRows() {
  try {
    const saved = localStorage.getItem(PLAN_ROWS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeRow);
    }
  } catch (_) {}
  return [];
}

const _initSync = loadInitialPlanSyncState();

let state = {
  planId: null,
  planDate: getInitialPlanDate(),
  rows: getInitialRows(),
  hydrated: !isSupabaseConfigured(),
  planSyncSource: _initSync.planSyncSource,
  planCacheStale: _initSync.planCacheStale,
};

let getSkipRef = () => ({ current: false });

const listeners = new Set();

// useSyncExternalStore: if nothing changed, getSnapshot() should return the *same* object ref or React gets upset
let cachedSnapshot = null;

function buildSnapshot() {
  const backendUp =
    isSupabaseConfigured() && state.planSyncSource !== PLAN_SYNC_SOURCE.LOCAL_FALLBACK;
  return {
    planId: state.planId,
    planDate: state.planDate,
    rows: state.rows,
    hydrated: state.hydrated,
    isBackendConnected: backendUp,
    planSyncSource: state.planSyncSource,
    planCacheStale: state.planCacheStale,
    setPlanDate,
    setRows,
    addBatch,
    addBatchesFromModal,
    previewInsertBatchesWithReflow,
    insertBatchesWithReflow,
    insertBatchBreakWithReflow,
    previewSwapOrderBetweenRows,
    reorderRows,
    swapOrderBetweenRows,
    deleteBatch,
  };
}

function computeEndTimesForRowPreservingType(row) {
  if (row?.isBreak) {
    const mins = Number(row.breakMinutes);
    const safe = Number.isNaN(mins) ? 0 : Math.max(0, mins);
    const endBatch = safe > 0 ? addMinutesToTime(row.startSponge, safe) : (row.endBatch || row.startSponge);
    return { endDough: endBatch, endBatch };
  }
  return recomputeEndTimesForRow(row);
}

export function insertBatchBreakWithReflow(payload) {
  const lineId = payload.productionLineId || getLines()[0]?.id || 'line-loaf';
  const dateStr = payload.date && typeof payload.date === 'string' ? payload.date.split('T')[0] : toDateString(state.planDate);
  const startSponge = payload.startSponge && /^\d{1,2}:\d{2}$/.test(String(payload.startSponge).trim()) ? String(payload.startSponge).trim() : '00:00';
  const breakEnd = payload.breakEnd && /^\d{1,2}:\d{2}$/.test(String(payload.breakEnd).trim()) ? String(payload.breakEnd).trim() : '';
  if (!breakEnd) return { success: false, error: 'Batch Break End is required.' };
  const startM = parseTimeToMinutes(startSponge);
  const endM = parseTimeToMinutes(breakEnd);
  if (endM <= startM) return { success: false, error: 'Batch Break End must be after Batch Break Start.' };
  const duration = endM - startM;

  // snap to grid / detect overlap — same idea as inserting a batch, but breaks don't need a product picked
  const insertStartMs = new Date(dateStr + 'T' + startSponge).getTime();
  const lineRows = state.rows.filter((r) => r.productionLineId === lineId && (r.date || '') === dateStr);
  const starts = lineRows
    .map((r) => ({ row: r, startMs: computeRowStartEndMs(r)?.startMs ?? null }))
    .filter((x) => x.startMs != null)
    .sort((a, b) => a.startMs - b.startMs);
  const firstAtOrAfter = starts.find((x) => x.startMs >= insertStartMs) || null;
  const latest = getLatestBatchEndForLineOnDate(lineId, dateStr);

  let snappedDate = dateStr;
  let snappedStart = startSponge;
  let snappedStartMs = insertStartMs;
  if (firstAtOrAfter) {
    snappedStartMs = firstAtOrAfter.startMs;
    snappedDate = firstAtOrAfter.row.date;
    snappedStart = firstAtOrAfter.row.startSponge;
  } else if (latest && insertStartMs <= latest.endMs) {
    snappedStartMs = latest.endMs;
    snappedDate = latest.date;
    snappedStart = latest.endBatch;
  }

  const createdAtMs = Date.now();
  const createdAtIso = new Date(createdAtMs).toISOString();
  const label = payload.description && String(payload.description).trim() ? String(payload.description).trim() : 'Time Blocker';
  const newBreakRow = normalizeRow({
    id: String(createdAtMs) + '-break',
    createdAt: createdAtIso,
    productionLineId: lineId,
    date: snappedDate,
    product: label,
    isBreak: true,
    breakMinutes: duration,
    soQty: 0,
    soCoExcess: 0,
    exchangeForLoss: 0,
    excess: 0,
    samples: 0,
    carryOverExcess: 0,
    theorExcess: 0,
    theorOutputOverride: '',
    theorOutput: 0,
    capacity: 0,
    procTime: duration,
    startSponge: snappedStart,
    endDough: breakEnd,
    endBatch: breakEnd,
  });
  const { endDough, endBatch } = computeEndTimesForRowPreservingType(newBreakRow);
  newBreakRow.endDough = endDough;
  newBreakRow.endBatch = endBatch;

  const affectedSet = new Set(
    lineRows
      .map((r) => ({ r, se: computeRowStartEndMs(r) }))
      .filter((x) => x.se && x.se.startMs >= snappedStartMs)
      .sort((a, b) => a.se.startMs - b.se.startMs)
      .map((x) => x.r.id)
  );

  // push everything that started after the break forward
  const staggerMinutes = getStaggerMinutesForLine(lineId);
  const affectedRows = lineRows
    .filter((r) => affectedSet.has(r.id))
    .map((r) => ({ row: r, startMs: computeRowStartEndMs(r)?.startMs ?? 0 }))
    .sort((a, b) => a.startMs - b.startMs);

  let currentDate = snappedDate;
  let prevStart = snappedStart;
  let prevEndBatch = newBreakRow.endBatch;

  const updatedAffectedById = new Map();
  let firstAffectedAfterBreak = true;
  for (const item of affectedRows) {
    const original = item.row;
    let nextStart = '';
    if (staggerMinutes > 0) {
      // First batch after a Time Blocker: start when the line is free (break end), not breakStart + stagger
      // (breakStart + stagger is still "inside" or aligned to the pipelining grid but ignores buffer duration).
      if (firstAffectedAfterBreak) {
        nextStart = prevEndBatch;
        firstAffectedAfterBreak = false;
      } else {
        nextStart = addMinutesToTime(prevStart, staggerMinutes);
        if (parseTimeToMinutes(nextStart) < parseTimeToMinutes(prevStart) && nextStart !== prevStart) {
          currentDate = addDays(currentDate, 1);
        }
      }
    } else {
      nextStart = prevEndBatch;
      firstAffectedAfterBreak = false;
      if (parseTimeToMinutes(prevEndBatch) <= parseTimeToMinutes(prevStart) && prevEndBatch !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    }

    const moved = normalizeRow({ ...original, productionLineId: lineId, date: currentDate, startSponge: nextStart });
    const ends = computeEndTimesForRowPreservingType(moved);
    moved.endDough = ends.endDough;
    moved.endBatch = ends.endBatch;
    updatedAffectedById.set(original.id, moved);
    prevStart = moved.startSponge;
    prevEndBatch = moved.endBatch;
  }

  const updatedAffectedOrdered = affectedRows.map((x) => updatedAffectedById.get(x.row.id)).filter(Boolean);

  const nextAll = [];
  let inserted = false;
  let lastLineInsertIdx = -1;
  for (const r of state.rows) {
    if (r.productionLineId !== lineId || (r.date || '') !== dateStr) {
      nextAll.push(r);
      continue;
    }
    lastLineInsertIdx = nextAll.length;
    if (affectedSet.has(r.id)) {
      if (!inserted) {
        nextAll.push(newBreakRow);
        nextAll.push(...updatedAffectedOrdered);
        inserted = true;
      }
      continue;
    }
    nextAll.push(r);
  }
  if (!inserted) {
    const insertAt = lastLineInsertIdx >= 0 ? lastLineInsertIdx + 1 : nextAll.length;
    nextAll.splice(insertAt, 0, newBreakRow);
  }

  state = { ...state, rows: nextAll };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
  return { success: true, rowsAdded: 1, affectedMoved: updatedAffectedOrdered.length };
}

export function previewSwapOrderBetweenRows(rowIdA, rowIdB) {
  const idxA = state.rows.findIndex((r) => r.id === rowIdA);
  const idxB = state.rows.findIndex((r) => r.id === rowIdB);
  if (idxA === -1 || idxB === -1) return { canSwap: false, reason: 'Row not found' };
  const rowA = state.rows[idxA];
  const rowB = state.rows[idxB];
  const lineId = rowA.productionLineId || '';
  if (!lineId || (rowB.productionLineId || '') !== lineId) return { canSwap: false, reason: 'Different line' };

  const lineRows = state.rows
    .filter((r) => (r.productionLineId || '') === lineId)
    .map((r) => ({ r, se: computeRowStartEndMs(r) }))
    .sort((a, b) => (a.se?.startMs ?? 0) - (b.se?.startMs ?? 0));
  if (lineRows.length === 0) return { canSwap: false, reason: 'No rows on line' };

  const slots = lineRows.map((x) => ({
    id: x.r.id,
    date: (x.r.date || '').split('T')[0],
    startSponge: x.r.startSponge,
  }));

  const ids = slots.map((s) => s.id);
  const posA = ids.indexOf(rowIdA);
  const posB = ids.indexOf(rowIdB);
  if (posA === -1 || posB === -1) return { canSwap: false, reason: 'Row not in line ordering' };
  const crossDay = (slots[posA]?.date || '') !== (slots[posB]?.date || '');

  // dry-run the swap reflow so the UI can show how many rows would move
  [ids[posA], ids[posB]] = [ids[posB], ids[posA]];
  const startPos = Math.min(posA, posB);
  const byId = new Map(lineRows.map((x) => [x.r.id, x.r]));
  const staggerMinutes = getStaggerMinutesForLine(lineId);

  const updatedById = new Map();
  let currentDate = slots[startPos]?.date || slots[0]?.date || '';
  let prevStart = slots[startPos]?.startSponge || slots[0]?.startSponge || '';
  let prevEndBatch = prevStart;
  if (startPos > 0) {
    const prevId = slots[startPos - 1].id;
    const prevRow = byId.get(prevId);
    if (prevRow) {
      currentDate = (prevRow.date || '').split('T')[0] || currentDate;
      prevStart = prevRow.startSponge || prevStart;
      prevEndBatch = prevRow.endBatch || prevEndBatch;
    }
  }
  if (!currentDate || !prevStart) return { canSwap: false, reason: 'Invalid anchor' };

  ids.forEach((id, i) => {
    if (i < startPos) return;
    const original = byId.get(id);
    if (!original) return;

    if (i > startPos) {
      const prevSlot = slots[i - 1];
      const thisSlot = slots[i];
      if (prevSlot?.date && thisSlot?.date && thisSlot.date !== prevSlot.date) {
        currentDate = thisSlot.date;
        prevStart = thisSlot.startSponge || prevStart;
        prevEndBatch = thisSlot.startSponge || prevEndBatch;
      }
    }

    let startSponge = '';
    if (i === startPos) {
      const slot = slots[startPos];
      currentDate = slot?.date || currentDate;
      startSponge = slot?.startSponge || prevStart;
      prevStart = startSponge;
      prevEndBatch = startSponge;
    } else if (staggerMinutes > 0) {
      if (i > startPos) {
        const prevRefId = ids[i - 1];
        const prevMoved = updatedById.get(prevRefId);
        if (prevMoved?.isBreak && prevMoved.endBatch) {
          startSponge = prevMoved.endBatch;
        } else {
          startSponge = addMinutesToTime(prevStart, staggerMinutes);
          if (parseTimeToMinutes(startSponge) < parseTimeToMinutes(prevStart) && startSponge !== prevStart) {
            currentDate = addDays(currentDate, 1);
          }
        }
      }
    } else {
      startSponge = prevEndBatch;
      if (parseTimeToMinutes(prevEndBatch) <= parseTimeToMinutes(prevStart) && prevEndBatch !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    }

    const moved = normalizeRow({
      ...original,
      productionLineId: lineId,
      date: currentDate,
      startSponge,
    });
    const ends = computeEndTimesForRowPreservingType(moved);
    moved.endDough = ends.endDough;
    moved.endBatch = ends.endBatch;
    updatedById.set(id, moved);
    prevStart = moved.startSponge;
    prevEndBatch = moved.endBatch;
  });

  const changedRowIds = [];
  for (const [id, moved] of updatedById.entries()) {
    const orig = byId.get(id);
    if (!orig) continue;
    if ((orig.date || '') !== (moved.date || '') || (orig.startSponge || '') !== (moved.startSponge || '') || (orig.endBatch || '') !== (moved.endBatch || '')) {
      changedRowIds.push(id);
    }
  }

  const affected = changedRowIds.map((id) => {
    const orig = byId.get(id);
    const moved = updatedById.get(id);
    return {
      id,
      product: orig?.product ?? moved?.product ?? '',
      from: {
        date: (orig?.date || '').split('T')[0],
        startSponge: orig?.startSponge ?? '',
        endDough: orig?.endDough ?? '',
        endBatch: orig?.endBatch ?? '',
      },
      to: {
        date: (moved?.date || '').split('T')[0],
        startSponge: moved?.startSponge ?? '',
        endDough: moved?.endDough ?? '',
        endBatch: moved?.endBatch ?? '',
      },
    };
  });

  return {
    canSwap: true,
    productionLineId: lineId,
    crossDay,
    changedRowIds,
    changedCount: changedRowIds.length,
    affected,
  };
}

function emit() {
  cachedSnapshot = buildSnapshot();
  listeners.forEach((l) => l());
}

function persistRows(rows) {
  try {
    localStorage.setItem(PLAN_ROWS_STORAGE_KEY, JSON.stringify(rows));
  } catch (_) {}
}

function pushToApi(planId, planDate, rows) {
  if (!isSupabaseConfigured()) return;
  getSkipRef().current = true;
  const pd = planDate instanceof Date ? planDate.toISOString() : planDate;
  updatePlan(planId, { planDate: pd, rows }).then((res) => {
    if (res?.ok && res?.id) {
      state = { ...state, planId: res.id };
    }
  });
}

export function initPlanStore(options = {}) {
  getSkipRef = options.getSkipRef || (() => ({ current: false }));
}

export function setPlanFromRemote(data) {
  if (!data?.rows || !Array.isArray(data.rows)) return;
  const pd = parsePlanDate(data.plan_date);
  const rows = data.rows.map(normalizeRow);
  state = {
    ...state,
    planId: data.id ?? state.planId,
    planDate: pd ?? state.planDate,
    rows,
    planSyncSource: PLAN_SYNC_SOURCE.REMOTE,
    planCacheStale: false,
  };
  writePlanSyncMeta({ source: PLAN_SYNC_SOURCE.REMOTE, stale: false });
  persistRows(state.rows);
  emit();
}

export function hydrateFromApi(data) {
  if (data?.rows && Array.isArray(data.rows)) {
    const rows = data.rows.map(normalizeRow);
    state = {
      ...state,
      planId: data.id ?? state.planId,
      // Default plan date to today when the app loads (Scheduling page).
      planDate: new Date(),
      rows,
      hydrated: true,
      planSyncSource: PLAN_SYNC_SOURCE.REMOTE,
      planCacheStale: false,
    };
    writePlanSyncMeta({ source: PLAN_SYNC_SOURCE.REMOTE, stale: false });
    persistRows(state.rows);
  } else {
    state = {
      ...state,
      hydrated: true,
      planSyncSource: PLAN_SYNC_SOURCE.LOCAL_ONLY,
      planCacheStale: false,
    };
    writePlanSyncMeta({ source: PLAN_SYNC_SOURCE.LOCAL_ONLY, stale: false });
  }
  emit();
}

// Supabase configured but fetch failed / offline: use localStorage as cache (may be stale vs DB).
export function hydrateFromLocalStorage() {
  const rows = getInitialRows();
  const remote = isSupabaseConfigured();
  state = {
    ...state,
    rows,
    hydrated: true,
    planSyncSource: remote ? PLAN_SYNC_SOURCE.LOCAL_FALLBACK : PLAN_SYNC_SOURCE.LOCAL_ONLY,
    planCacheStale: remote,
  };
  if (remote) {
    writePlanSyncMeta({ source: PLAN_SYNC_SOURCE.LOCAL_FALLBACK, stale: true });
  } else {
    writePlanSyncMeta({ source: PLAN_SYNC_SOURCE.LOCAL_ONLY, stale: false });
  }
  emit();
}

// Before authoritative re-fetch from DB: drop cached rows so we never merge stale + remote.
export function clearLocalRowsCache() {
  try {
    localStorage.removeItem(PLAN_ROWS_STORAGE_KEY);
  } catch (_) {}
}

export function setPlanDate(date) {
  const d = typeof date === 'function' ? date() : date;
  const parsed = d instanceof Date ? d : parsePlanDate(d);
  if (!parsed) return;
  state = { ...state, planDate: parsed };
  pushToApi(state.planId, parsed, state.rows);
  emit();
}

export function setRows(updater) {
  const raw = typeof updater === 'function' ? updater(state.rows) : updater;
  const next = raw.map((r) => normalizeRow(r));
  state = { ...state, rows: next };
  persistRows(next);
  pushToApi(state.planId, state.planDate, next);
  emit();
}

// recipe rename in UI -> patch every row that still had the old product string
export function updateProductNameInRows(oldProductName, newProductName) {
  const oldName = (oldProductName || '').trim();
  const newName = (newProductName || '').trim();
  if (!oldName || oldName === newName) return;
  const next = state.rows.map((r) =>
    (r.product || '').trim() === oldName ? normalizeRow({ ...r, product: newName }) : normalizeRow(r)
  );
  state = { ...state, rows: next };
  persistRows(next);
  pushToApi(state.planId, state.planDate, next);
  emit();
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Order batch = 1st/2nd/3rd... by start sponge time, scoped to (line, date).
// lineBatch map is the same numbers — old name, didn't want to break anything that still reads it.
export function getOrderBatchAndLineBatch(rows) {
  const orderBatch = {};
  const lineBatch = {};
  if (!Array.isArray(rows) || rows.length === 0) return { orderBatch, lineBatch };

  // sort by start sponge within each line+day bucket
  const byLineDate = {};
  rows.forEach((r) => {
    const key = `${r.productionLineId || ''}\t${r.date || ''}`;
    if (!byLineDate[key]) byLineDate[key] = [];
    byLineDate[key].push(r);
  });
  Object.keys(byLineDate).forEach((key) => {
    const list = [...byLineDate[key]].sort(
      (a, b) => parseTimeToMinutes(a.startSponge) - parseTimeToMinutes(b.startSponge)
    );
    list.forEach((r, i) => {
      const v = ordinal(i + 1);
      orderBatch[r.id] = v;
      lineBatch[r.id] = v;
    });
  });

  return { orderBatch, lineBatch };
}

// newest endBatch on a line (used to block "start before previous batch finished" type errors). { date, endBatch, endMs } or null
export function getLatestBatchEndForLine(lineId) {
  const lineRows = state.rows.filter((r) => r.productionLineId === lineId);
  if (lineRows.length === 0) return null;
  let maxEndMs = 0;
  let result = null;
  for (const row of lineRows) {
    const dateStr = row.date && typeof row.date === 'string' ? row.date.split('T')[0] : '';
    if (!dateStr || !row.endBatch || !row.startSponge) continue;
    let endMs = new Date(dateStr + 'T' + row.endBatch).getTime();
    if (parseTimeToMinutes(row.endBatch) <= parseTimeToMinutes(row.startSponge)) endMs += 24 * 60 * 60 * 1000;
    if (endMs > maxEndMs) {
      maxEndMs = endMs;
      result = { date: dateStr, endBatch: row.endBatch, endMs };
    }
  }
  return result;
}

function getLatestBatchEndForLineOnDate(lineId, dateStr) {
  const ds = dateStr && typeof dateStr === 'string' ? dateStr.split('T')[0] : '';
  if (!ds) return null;
  const lineRows = state.rows.filter((r) => r.productionLineId === lineId && (r.date || '') === ds);
  if (lineRows.length === 0) return null;
  let maxEndMs = 0;
  let result = null;
  for (const row of lineRows) {
    if (!row.endBatch || !row.startSponge) continue;
    let endMs = new Date(ds + 'T' + row.endBatch).getTime();
    if (parseTimeToMinutes(row.endBatch) <= parseTimeToMinutes(row.startSponge)) endMs += 24 * 60 * 60 * 1000;
    if (endMs > maxEndMs) {
      maxEndMs = endMs;
      result = { date: ds, endBatch: row.endBatch, endMs };
    }
  }
  return result;
}

function computeRowStartEndMs(row) {
  const dateStr = row.date && typeof row.date === 'string' ? row.date.split('T')[0] : '';
  if (!dateStr || !row.startSponge || !row.endBatch) return null;
  const startMs = new Date(dateStr + 'T' + row.startSponge).getTime();
  let endMs = new Date(dateStr + 'T' + row.endBatch).getTime();
  if (parseTimeToMinutes(row.endBatch) <= parseTimeToMinutes(row.startSponge)) endMs += 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function buildNewRowsFromModal(payload, createdAtMs) {
  const lineId = payload.productionLineId || getLines()[0]?.id || 'line-loaf';
  const dateStr = payload.date && typeof payload.date === 'string' ? payload.date.split('T')[0] : toDateString(state.planDate);
  const startSponge = payload.startSponge && /^\d{1,2}:\d{2}$/.test(String(payload.startSponge).trim()) ? String(payload.startSponge).trim() : '00:00';
  const product = payload.product && String(payload.product).trim() || '';
  const salesOrderPayload = payload.salesOrder !== undefined && payload.salesOrder !== '' && !Number.isNaN(Number(payload.salesOrder)) ? Number(payload.salesOrder) : undefined;
  const soCoExcess = payload.soCoExcess !== undefined && payload.soCoExcess !== '' ? Number(payload.soCoExcess) : (salesOrderPayload !== undefined ? Math.max(0, salesOrderPayload - (Number(payload.carryOverExcess) || 0)) : 0);
  const exchangeForLoss = Number(payload.exchangeForLoss) || 0;
  const excess = Number(payload.excess) || 0;
  const samples = Number(payload.samples) || 2;
  const theorOutput = payload.theorOutputOverride !== undefined && payload.theorOutputOverride !== '' && !Number.isNaN(Number(payload.theorOutputOverride))
    ? Number(payload.theorOutputOverride)
    : soCoExcess + exchangeForLoss + excess + samples;
  const soQty = Number(payload.soQty) || 0;

  if (!product) return { success: false, error: 'Select a product.' };
  const capacity = getCapacityForProductFromLine(lineId, product);
  if (!capacity || capacity <= 0) return { success: false, error: 'No capacity for this product on this line.' };
  const procTime = getTotalProcessMinutesForLine(product, lineId) || 0;
  if (procTime <= 0) {
    return {
      success: false,
      error: 'This product has no process profile or process durations for this line. End Dough and End Batch cannot be calculated. Add a recipe with stage durations or add a process profile for this product on the Production page, then try again.',
    };
  }
  const yieldPerBatch = getYieldForProductFromLine(lineId, product);
  const useTotalQtyForBatches = soQty > 0 && yieldPerBatch != null && yieldPerBatch > 0;
  const numBatches = useTotalQtyForBatches
    ? Math.ceil(soQty / yieldPerBatch)
    : Math.ceil(theorOutput / capacity);
  if (useTotalQtyForBatches && numBatches <= 0) return { success: false, error: 'Total Quantity and Yield must be greater than 0 to create batches.' };
  if (!useTotalQtyForBatches && theorOutput <= 0) return { success: false, error: 'Theoretical Output must be greater than 0.' };

  const batchSize = useTotalQtyForBatches ? yieldPerBatch : capacity;
  let remaining = useTotalQtyForBatches ? soQty : theorOutput;

  const recipes = getRecipesForLine(lineId);
  const productName = recipes.find((r) => r.name === product)?.name || product;
  const newRows = [];
  let currentStart = startSponge;
  let currentDate = dateStr;
  const createdAtIso = new Date(createdAtMs).toISOString();

  const carryOverPayload = Number(payload.carryOverExcess) || 0;
  for (let i = 0; i < numBatches; i++) {
    const pieceCount = i < numBatches - 1 ? batchSize : Math.min(batchSize, remaining);
    remaining -= pieceCount;
    const rowSoQty = useTotalQtyForBatches ? soQty : (i === 0 ? (payload.soQty !== undefined && payload.soQty !== '' ? Number(payload.soQty) : pieceCount) : pieceCount);
    const rowSalesOrder = i === 0 ? salesOrderPayload : undefined;
    // i===0: whatever came from modal (qty-only path => often 0). i>0: we stuff pieceCount into soCoExcess — yeah it's weird but matches how rows were always built
    const rowSoCoExcess = i === 0 ? soCoExcess : pieceCount;
    const rowExchangeForLoss = i === 0 ? exchangeForLoss : 0;
    const rowExcess = i === 0 ? excess : 0;
    const rowSamples = i === 0 ? samples : 0;
    const rowCarryOverExcess = i === 0 ? carryOverPayload : 0;
    const rowTheorOutput = pieceCount;
    const prevStart = currentStart;
    const { endDough, endBatch } = recomputeEndTimesForRow({
      product: productName,
      productionLineId: lineId,
      startSponge: currentStart,
      endDough: '00:00',
      endBatch: '00:00',
    });
    const batchLabel = ordinal(state.rows.length + newRows.length + 1);
    const newRow = {
      id: String(createdAtMs) + '-' + i,
      createdAt: createdAtIso,
      productionLineId: lineId,
      date: currentDate,
      product: productName,
      salesOrder: rowSalesOrder,
      soQty: rowSoQty,
      soCoExcess: rowSoCoExcess,
      exchangeForLoss: rowExchangeForLoss,
      excess: rowExcess,
      samples: rowSamples,
      carryOverExcess: rowCarryOverExcess,
      theorExcess: 0,
      theorOutputOverride: '',
      theorOutput: rowTheorOutput,
      capacity,
      procTime,
      startSponge: currentStart,
      endDough,
      endBatch,
      batch: batchLabel,
    };
    newRows.push(newRow);
    const staggerMinutes = getStaggerMinutesForLine(lineId);
    if (staggerMinutes > 0) {
      currentStart = addMinutesToTime(prevStart, staggerMinutes);
      if (parseTimeToMinutes(currentStart) < parseTimeToMinutes(prevStart) && currentStart !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    } else {
      currentStart = endBatch;
      if (parseTimeToMinutes(endBatch) <= parseTimeToMinutes(prevStart) && endBatch !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    }
  }

  return { success: true, newRows, lineId, dateStr, startSponge };
}

export function previewInsertBatchesWithReflow(payload) {
  const lineId = payload.productionLineId || getLines()[0]?.id || 'line-loaf';
  const dateStr = payload.date && typeof payload.date === 'string' ? payload.date.split('T')[0] : toDateString(state.planDate);
  const startSponge = payload.startSponge && /^\d{1,2}:\d{2}$/.test(String(payload.startSponge).trim()) ? String(payload.startSponge).trim() : '00:00';
  const insertStartMs = new Date(dateStr + 'T' + startSponge).getTime();
  const lineRows = state.rows.filter((r) => r.productionLineId === lineId && (r.date || '') === dateStr);
  if (lineRows.length === 0) return { hasConflict: false, affectedRowIds: [], snappedTo: null };

  // Snap rule (forward-only):
  // - Find the nearest existing batch start at/after the typed time. If none, snap to "end of day schedule" (latest end on line).
  const starts = lineRows
    .map((r) => ({ row: r, startMs: computeRowStartEndMs(r)?.startMs ?? null }))
    .filter((x) => x.startMs != null)
    .sort((a, b) => a.startMs - b.startMs);

  const firstAtOrAfter = starts.find((x) => x.startMs >= insertStartMs) || null;
  const latest = getLatestBatchEndForLineOnDate(lineId, dateStr);

  let snappedDate = dateStr;
  let snappedStartSponge = startSponge;
  let snappedStartMs = insertStartMs;

  if (firstAtOrAfter) {
    snappedStartMs = firstAtOrAfter.startMs;
    snappedDate = firstAtOrAfter.row.date;
    snappedStartSponge = firstAtOrAfter.row.startSponge;
  } else if (latest && insertStartMs <= latest.endMs) {
    // typed time is before the last batch finishes but there's no "next" start slot — shove them to end of the last batch
    snappedStartMs = latest.endMs;
    snappedDate = latest.date;
    snappedStartSponge = latest.endBatch;
  }

  const affectedRowIds = lineRows
    .map((r) => ({ r, se: computeRowStartEndMs(r) }))
    .filter((x) => x.se && x.se.startMs >= snappedStartMs)
    .sort((a, b) => a.se.startMs - b.se.startMs)
    .map((x) => x.r.id);

  const didSnap = snappedDate !== dateStr || snappedStartSponge !== startSponge;
  return {
    hasConflict: affectedRowIds.length > 0 || didSnap,
    affectedRowIds,
    snappedTo: didSnap ? { date: snappedDate, startSponge: snappedStartSponge } : null,
  };
}

export function insertBatchesWithReflow(payload) {
  const preview = previewInsertBatchesWithReflow(payload);
  const snappedPayload = preview?.snappedTo
    ? { ...payload, date: preview.snappedTo.date, startSponge: preview.snappedTo.startSponge }
    : payload;

  const createdAtMs = Date.now();
  const build = buildNewRowsFromModal(snappedPayload, createdAtMs);
  if (!build.success) return build;

  const { lineId, dateStr, startSponge, newRows } = build;
  const batchStartMs = new Date(dateStr + 'T' + startSponge).getTime();
  const now = new Date();
  const planDateStr = toDateString(state.planDate);
  const isPlanDateToday = planDateStr === toDateString(now);
  if (isPlanDateToday) {
    const nowStartOfMinute = Math.floor(now.getTime() / 60000) * 60000;
    if (batchStartMs < nowStartOfMinute) {
      return { success: false, error: 'When plan date is today, batch start date and time cannot be in the past.' };
    }
  }

  const affectedSet = new Set(preview?.affectedRowIds || []);
  const staggerMinutes = getStaggerMinutesForLine(lineId);

  // anything starting at/after the insert point gets bumped along the pipeline
  const lineRows = state.rows.filter((r) => r.productionLineId === lineId && (r.date || '') === dateStr);
  const affectedRows = lineRows
    .filter((r) => affectedSet.has(r.id))
    .map((r) => {
      const se = computeRowStartEndMs(r);
      return { row: r, startMs: se?.startMs ?? 0, endMs: se?.endMs ?? 0 };
    })
    .sort((a, b) => a.startMs - b.startMs);

  // reflow chains from the *last* row of what we just inserted (not the first)
  const insertedGroupLast = newRows[newRows.length - 1] || null;
  const reflowBase = insertedGroupLast;

  // first row we're about to shove: starts after reflowBase's end (or stagger from its start, depending branch below)
  let currentDate = reflowBase ? (reflowBase.date || dateStr) : dateStr;
  let prevStart = reflowBase ? (reflowBase.startSponge || startSponge) : startSponge;
  let prevEndBatch = reflowBase ? (reflowBase.endBatch || startSponge) : startSponge;

  const updatedAffectedById = new Map();
  for (const item of affectedRows) {
    const original = item.row;

    let nextStart = '';
    if (staggerMinutes > 0) {
      nextStart = addMinutesToTime(prevStart, staggerMinutes);
      if (parseTimeToMinutes(nextStart) < parseTimeToMinutes(prevStart) && nextStart !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    } else {
      nextStart = prevEndBatch;
      if (parseTimeToMinutes(prevEndBatch) <= parseTimeToMinutes(prevStart) && prevEndBatch !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    }

    const moved = normalizeRow({
      ...original,
      productionLineId: lineId,
      date: currentDate,
      startSponge: nextStart,
    });
    const { endDough, endBatch } = recomputeEndTimesForRow(moved);
    moved.endDough = endDough;
    moved.endBatch = endBatch;

    updatedAffectedById.set(original.id, moved);

    prevStart = moved.startSponge;
    prevEndBatch = moved.endBatch;
  }

  // stitch arrays without nuking unrelated lines: other lines untouched; on this line, rows before the conflict stay put;
  // first time we hit an affected id we splice in [new rows][reflowed affected...] and skip the rest of the old affected ids
  const updatedAffectedOrdered = affectedRows.map((x) => updatedAffectedById.get(x.row.id)).filter(Boolean);
  const nextAll = [];
  let inserted = false;
  let lastLineInsertIdx = -1;
  for (const r of state.rows) {
    if (r.productionLineId !== lineId || (r.date || '') !== dateStr) {
      nextAll.push(r);
      continue;
    }
    lastLineInsertIdx = nextAll.length;
    if (affectedSet.has(r.id)) {
      if (!inserted) {
        nextAll.push(...newRows.map(normalizeRow));
        nextAll.push(...updatedAffectedOrdered);
        inserted = true;
      }
      continue;
    }
    nextAll.push(r);
  }
  if (!inserted) {
    const insertAt = lastLineInsertIdx >= 0 ? lastLineInsertIdx + 1 : nextAll.length;
    nextAll.splice(insertAt, 0, ...newRows.map(normalizeRow));
  }

  state = { ...state, rows: nextAll };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
  return { success: true, rowsAdded: newRows.length, affectedMoved: updatedAffectedOrdered.length };
}

// legacy append path (no reflow): checks "today => not in past" and "start after last end on line".
// row count = ceil(theorOutput/capacity) OR total-qty / yield path inside buildNewRowsFromModal
// payload shape: productionLineId, date, startSponge, product, optional sales/soQty/soCo/etc.
export function addBatchesFromModal(payload) {
  const createdAtMs = Date.now();
  const build = buildNewRowsFromModal(payload, createdAtMs);
  if (!build.success) return build;
  const { lineId, dateStr, startSponge, newRows } = build;

  const batchStartMs = new Date(dateStr + 'T' + startSponge).getTime();
  const now = new Date();
  const planDateStr = toDateString(state.planDate);
  const isPlanDateToday = planDateStr === toDateString(now);
  if (isPlanDateToday) {
    const nowStartOfMinute = Math.floor(now.getTime() / 60000) * 60000;
    if (batchStartMs < nowStartOfMinute) {
      return { success: false, error: 'When plan date is today, batch start date and time cannot be in the past.' };
    }
  }
  const latest = getLatestBatchEndForLine(lineId);
  if (latest && batchStartMs <= latest.endMs) {
    return { success: false, error: 'Batch start must be after the end of existing batches on this line (e.g. after ' + latest.endBatch + ' on ' + latest.date + ').' };
  }

  state = { ...state, rows: [...state.rows, ...newRows] };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
  return { success: true, rowsAdded: newRows.length };
}

export function addBatch(productionLineId) {
  const lineId = productionLineId || getLines()[0]?.id || 'line-loaf';
  const recipes = getRecipesForLine(lineId);
  const defaultProduct = recipes[0]?.name || '';
  const capacity = defaultProduct ? getCapacityForProductFromLine(lineId, defaultProduct) : null;
  const procTime = defaultProduct ? getTotalProcessMinutesForLine(defaultProduct, lineId) : 0;
  const startSponge = '00:00';
  const { endDough, endBatch } = recomputeEndTimesForRow({
    product: defaultProduct,
    productionLineId: lineId,
    startSponge,
    endDough: '00:00',
    endBatch: '00:00',
  });
  const batchLabel = ordinal(state.rows.length + 1);
  const rowDate = toDateString(state.planDate);
  const createdAtIso = new Date().toISOString();
  const newRow = {
    id: String(Date.now()),
    createdAt: createdAtIso,
    productionLineId: lineId,
    date: rowDate,
    product: defaultProduct,
    salesOrder: undefined,
    soQty: 0,
    soCoExcess: 0,
    exchangeForLoss: 0,
    excess: 0,
    samples: 2,
    carryOverExcess: 0,
    theorExcess: 0,
    theorOutput: 2,
    capacity: capacity ?? 0,
    procTime,
    startSponge,
    endDough,
    endBatch,
    batch: batchLabel,
  };
  state = { ...state, rows: [...state.rows, newRow] };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
}

export function reorderRows(fromIndex, toIndex) {
  const copy = [...state.rows];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  state = { ...state, rows: copy };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
}

// swap two slots on the same line's timeline, then re-run start/end times with stagger or back-to-back rules.
// dates can roll to next day if midnight wraps — that's intentional
export function swapOrderBetweenRows(rowIdA, rowIdB) {
  const idxA = state.rows.findIndex((r) => r.id === rowIdA);
  const idxB = state.rows.findIndex((r) => r.id === rowIdB);
  if (idxA === -1 || idxB === -1) return;
  const rowA = state.rows[idxA];
  const rowB = state.rows[idxB];
  const lineId = rowA.productionLineId || '';
  if (!lineId || (rowB.productionLineId || '') !== lineId) return;

  const lineRows = state.rows
    .filter((r) => (r.productionLineId || '') === lineId)
    .map((r) => ({ r, se: computeRowStartEndMs(r) }))
    .sort((a, b) => (a.se?.startMs ?? 0) - (b.se?.startMs ?? 0));
  if (lineRows.length === 0) return;

  // Slots: preserve the existing slot start (date + time) for the first changed position,
  // then reflow forward from there using pipelining rules.
  const slots = lineRows.map((x) => ({
    id: x.r.id,
    date: (x.r.date || '').split('T')[0],
    startSponge: x.r.startSponge,
  }));

  const ids = slots.map((s) => s.id);
  const posA = ids.indexOf(rowIdA);
  const posB = ids.indexOf(rowIdB);
  if (posA === -1 || posB === -1) return;
  [ids[posA], ids[posB]] = [ids[posB], ids[posA]];
  const startPos = Math.min(posA, posB);

  const byId = new Map(lineRows.map((x) => [x.r.id, x.r]));
  const staggerMinutes = getStaggerMinutesForLine(lineId);

  const updatedById = new Map();
  // anchor from the row immediately before the swap window so we don't invent a fake gap
  let currentDate = slots[startPos]?.date || slots[0]?.date || '';
  let prevStart = slots[startPos]?.startSponge || slots[0]?.startSponge || '';
  let prevEndBatch = prevStart;
  if (startPos > 0) {
    const prevId = slots[startPos - 1].id;
    const prevRow = byId.get(prevId);
    if (prevRow) {
      currentDate = (prevRow.date || '').split('T')[0] || currentDate;
      prevStart = prevRow.startSponge || prevStart;
      prevEndBatch = prevRow.endBatch || prevEndBatch;
    }
  }
  if (!currentDate || !prevStart) return;

  ids.forEach((id, i) => {
    if (i < startPos) return; // left of swap: leave alone
    const original = byId.get(id);
    if (!original) return;

    // if the pre-swap schedule already had a row on the next calendar day, don't merge it onto yesterday's reflow
    // (e.g. tomorrow 4:56pm should stay tomorrow until a real midnight rollover happens)
    if (i > startPos) {
      const prevSlot = slots[i - 1];
      const thisSlot = slots[i];
      if (prevSlot?.date && thisSlot?.date && thisSlot.date !== prevSlot.date) {
        currentDate = thisSlot.date;
        prevStart = thisSlot.startSponge || prevStart;
        prevEndBatch = thisSlot.startSponge || prevEndBatch;
      }
    }

    // first swapped index keeps its wall clock; later indices are derived from pipeline math
    let startSponge = '';
    if (i === startPos) {
      const slot = slots[startPos];
      currentDate = slot?.date || currentDate;
      startSponge = slot?.startSponge || prevStart;
      // new anchor for the segment we're rebuilding
      prevStart = startSponge;
      prevEndBatch = startSponge;
    } else if (staggerMinutes > 0) {
      if (i > startPos) {
        const prevRefId = ids[i - 1];
        const prevMoved = updatedById.get(prevRefId);
        if (prevMoved?.isBreak && prevMoved.endBatch) {
          // match insertBatchBreakWithReflow — production resumes at break end, not breakStart+stagger
          startSponge = prevMoved.endBatch;
        } else {
          startSponge = addMinutesToTime(prevStart, staggerMinutes);
          if (parseTimeToMinutes(startSponge) < parseTimeToMinutes(prevStart) && startSponge !== prevStart) {
            currentDate = addDays(currentDate, 1);
          }
        }
      }
    } else {
      startSponge = prevEndBatch;
      if (parseTimeToMinutes(prevEndBatch) <= parseTimeToMinutes(prevStart) && prevEndBatch !== prevStart) {
        currentDate = addDays(currentDate, 1);
      }
    }

    const moved = normalizeRow({
      ...original,
      productionLineId: lineId,
      date: currentDate,
      startSponge,
    });
    const ends = computeEndTimesForRowPreservingType(moved);
    moved.endDough = ends.endDough;
    moved.endBatch = ends.endBatch;

    updatedById.set(id, moved);
    prevStart = moved.startSponge;
    prevEndBatch = moved.endBatch;
  });

  const next = state.rows.map((r) => {
    if ((r.productionLineId || '') !== lineId) return r;
    const updated = updatedById.get(r.id);
    return updated ? normalizeRow(updated) : r;
  });

  state = { ...state, rows: next };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
}

// returns { success, error? } — error if id missing
export function deleteBatch(rowId) {
  const next = state.rows.filter((r) => r.id !== rowId);
  if (next.length === state.rows.length) {
    return { success: false, error: 'Row not found.' };
  }
  state = { ...state, rows: next };
  persistRows(next);
  pushToApi(state.planId, state.planDate, next);
  emit();
  return { success: true };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  if (cachedSnapshot === null) cachedSnapshot = buildSnapshot();
  return cachedSnapshot;
}

export function shouldSkipNextRealtime() {
  const ref = getSkipRef();
  if (ref.current) {
    ref.current = false;
    return true;
  }
  return false;
}

export { getPlan, PLAN_ROWS_STORAGE_KEY };
