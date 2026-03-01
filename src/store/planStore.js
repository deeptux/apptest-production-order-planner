/**
 * Plan store: single source of truth for plan state.
 * Rows are aligned with Production page (productionLineId, capacity from line) and Recipe page (procTime from recipe per line).
 */
import { getPlan, updatePlan } from '../api/plan';
import { isSupabaseConfigured } from '../lib/supabase';
import { getRecipesForLine, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProductFromLine, getLines } from '../store/productionLinesStore';
import { recomputeEndTimesForRow } from '../utils/stageDurations';

const PLAN_ROWS_STORAGE_KEY = 'loaf-plan-rows';

function parsePlanDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getInitialPlanDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Return YYYY-MM-DD for storage and date inputs. */
function toDateString(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeRow(r) {
  const lineId = r.productionLineId || getLines()[0]?.id || 'line-loaf';
  return {
    ...r,
    productionLineId: lineId,
    date: r.date && typeof r.date === 'string' ? r.date.split('T')[0] : r.date,
  };
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

let state = {
  planId: null,
  planDate: getInitialPlanDate(),
  rows: getInitialRows(),
  hydrated: !isSupabaseConfigured(),
  isBackendConnected: isSupabaseConfigured(),
};

let getSkipRef = () => ({ current: false });

const listeners = new Set();

/** Cached snapshot so getSnapshot returns the same reference when state has not changed (required by useSyncExternalStore). */
let cachedSnapshot = null;

function buildSnapshot() {
  return {
    planId: state.planId,
    planDate: state.planDate,
    rows: state.rows,
    hydrated: state.hydrated,
    isBackendConnected: state.isBackendConnected,
    setPlanDate,
    setRows,
    addBatch,
    reorderRows,
    deleteBatch,
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
  };
  persistRows(state.rows);
  emit();
}

export function hydrateFromApi(data) {
  if (data?.rows && Array.isArray(data.rows)) {
    const rows = data.rows.map(normalizeRow);
    state = {
      ...state,
      planId: data.id ?? state.planId,
      planDate: parsePlanDate(data.plan_date) ?? state.planDate,
      rows,
      hydrated: true,
    };
    persistRows(state.rows);
  } else {
    state = { ...state, hydrated: true };
  }
  emit();
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
  const next = typeof updater === 'function' ? updater(state.rows) : updater;
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
  const newRow = {
    id: String(Date.now()),
    productionLineId: lineId,
    date: rowDate,
    product: defaultProduct,
    soQty: 0,
    theorOutput: 0,
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

export function deleteBatch(rowId) {
  const next = state.rows.filter((r) => r.id !== rowId);
  state = { ...state, rows: next };
  persistRows(next);
  pushToApi(state.planId, state.planDate, next);
  emit();
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
