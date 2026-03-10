/**
 * Plan store: single source of truth for plan state.
 * Rows are aligned with Production page (productionLineId, capacity from line) and Recipe page (procTime from recipe per line).
 */
import { getPlan, updatePlan } from '../api/plan';
import { isSupabaseConfigured } from '../lib/supabase';
import { getRecipesForLine, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProductFromLine, getYieldForProductFromLine, getLines } from '../store/productionLinesStore';
import { recomputeEndTimesForRow, parseTimeToMinutes } from '../utils/stageDurations';

const PLAN_ROWS_STORAGE_KEY = 'loaf-plan-rows';

function parsePlanDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getInitialPlanDate() {
  // Default plan date to "today" when the store is first loaded.
  return new Date();
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

/** Theoretical Output = SO-CO Excess + Exchange for LOSS + Excess + Samples (all in pieces). */
export function computeTheoreticalOutput(row) {
  const soCo = Number(row.soCoExcess) || 0;
  const loss = Number(row.exchangeForLoss) || 0;
  const excess = Number(row.excess) || 0;
  const samples = Number(row.samples) || 0;
  return soCo + loss + excess + samples;
}

function normalizeRow(r) {
  const lineId = r.productionLineId || getLines()[0]?.id || 'line-loaf';
  const soQty = Number(r.soQty) || 0;
  const salesOrder = r.salesOrder !== undefined && r.salesOrder !== '' ? Number(r.salesOrder) : undefined;
  const carryOverExcess = Number(r.carryOverExcess) || 0;
  const soCoExcess = r.soCoExcess !== undefined ? Number(r.soCoExcess) : (salesOrder !== undefined && !Number.isNaN(salesOrder) ? Math.max(0, salesOrder - carryOverExcess) : soQty);
  const exchangeForLoss = Number(r.exchangeForLoss) || 0;
  const excess = Number(r.excess) || 0;
  const samples = r.samples !== undefined ? Number(r.samples) : 2;
  const theorExcess = Number(r.theorExcess) || 0;
  const theorOutput = r.theorOutputOverride !== undefined && r.theorOutputOverride !== ''
    ? Number(r.theorOutputOverride)
    : computeTheoreticalOutput({ soCoExcess, exchangeForLoss, excess, samples });
  return {
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
    theorOutputOverride: r.theorOutputOverride,
    theorOutput,
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
    addBatchesFromModal,
    reorderRows,
    swapOrderBetweenRows,
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
      // Default plan date to today when the app loads (Scheduling page).
      planDate: new Date(),
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
  const raw = typeof updater === 'function' ? updater(state.rows) : updater;
  const next = raw.map((r) => normalizeRow(r));
  state = { ...state, rows: next };
  persistRows(next);
  pushToApi(state.planId, state.planDate, next);
  emit();
}

/** Update all plan rows that reference a product by its previous name (e.g. after renaming a recipe). */
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

/**
 * Compute Order Batch (per-product: 1st, 2nd, 3rd batch of that product) and
 * Line Batch (per line per date: 1st, 2nd, 3rd batch on that line that day).
 * @param {Array} rows - Plan rows
 * @returns {{ orderBatch: Record<string, string>, lineBatch: Record<string, string> }}
 */
export function getOrderBatchAndLineBatch(rows) {
  const orderBatch = {};
  const lineBatch = {};
  if (!Array.isArray(rows) || rows.length === 0) return { orderBatch, lineBatch };

  // Order Batch: group by product, sort by date then startSponge, assign 1st, 2nd, 3rd
  const byProduct = {};
  rows.forEach((r) => {
    const p = (r.product || '').trim() || '\0';
    if (!byProduct[p]) byProduct[p] = [];
    byProduct[p].push(r);
  });
  Object.keys(byProduct).forEach((product) => {
    const list = [...byProduct[product]].sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      if (d !== 0) return d;
      return parseTimeToMinutes(a.startSponge) - parseTimeToMinutes(b.startSponge);
    });
    list.forEach((r, i) => {
      orderBatch[r.id] = ordinal(i + 1);
    });
  });

  // Line Batch: by start time within (productionLineId, date) — 1st Line Batch = earliest Start Sponge that day; stays with the schedule, not array order
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
      lineBatch[r.id] = ordinal(i + 1);
    });
  });

  return { orderBatch, lineBatch };
}

/** Get the latest batch end (date + time) for a line, for validation. Returns { date, endBatch } in ms, or null. */
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

/**
 * Add one or more batch rows from modal input. Validates: when plan date is today, batch start >= now;
 * batch start must be after latest batch end on same line. Creates ceil(theorOutput/capacity) rows.
 * @param {Object} payload - { productionLineId, date (YYYY-MM-DD), startSponge (HH:MM), product, salesOrder?, soQty, soCoExcess, exchangeForLoss, excess, samples, theorOutputOverride? }
 * @returns {{ success: boolean, error?: string, rowsAdded?: number }}
 */
export function addBatchesFromModal(payload) {
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

  const recipes = getRecipesForLine(lineId);
  const productName = recipes.find((r) => r.name === product)?.name || product;
  const newRows = [];
  let currentStart = startSponge;
  let currentDate = dateStr;

  const carryOverPayload = Number(payload.carryOverExcess) || 0;
  for (let i = 0; i < numBatches; i++) {
    const pieceCount = i < numBatches - 1 ? batchSize : Math.min(batchSize, remaining);
    remaining -= pieceCount;
    const rowSoQty = useTotalQtyForBatches ? soQty : (i === 0 ? (payload.soQty !== undefined && payload.soQty !== '' ? Number(payload.soQty) : pieceCount) : pieceCount);
    const rowSalesOrder = i === 0 ? salesOrderPayload : undefined;
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
      id: String(Date.now()) + '-' + i,
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
    currentStart = endBatch;
    if (parseTimeToMinutes(endBatch) <= parseTimeToMinutes(prevStart) && endBatch !== prevStart) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      currentDate = toDateString(d);
    }
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
  const newRow = {
    id: String(Date.now()),
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

/** Order fields that move with the "order" when swapping slots; slot keeps id, productionLineId, date, startSponge (and we recompute endDough, endBatch). */
const ORDER_FIELDS = [
  'product', 'salesOrder', 'soQty', 'soCoExcess', 'exchangeForLoss', 'excess', 'samples',
  'carryOverExcess', 'theorExcess', 'theorOutputOverride', 'theorOutput', 'capacity', 'procTime',
];

/**
 * Swap which order runs in which slot: only order data (product, Batch Qty, Sales Order, etc.) is swapped;
 * each row keeps its slot's Start Sponge, and End Dough / End Batch are recomputed for the (possibly new) product.
 * Both rows must have the same productionLineId and date. Use for Order column move up/down within same line+date.
 */
export function swapOrderBetweenRows(rowIdA, rowIdB) {
  const idxA = state.rows.findIndex((r) => r.id === rowIdA);
  const idxB = state.rows.findIndex((r) => r.id === rowIdB);
  if (idxA === -1 || idxB === -1) return;
  const rowA = state.rows[idxA];
  const rowB = state.rows[idxB];
  if ((rowA.productionLineId || '') !== (rowB.productionLineId || '') || (rowA.date || '') !== (rowB.date || '')) return;

  const orderFromA = {};
  const orderFromB = {};
  ORDER_FIELDS.forEach((f) => {
    orderFromA[f] = rowA[f];
    orderFromB[f] = rowB[f];
  });

  const newA = { ...rowA, ...orderFromB };
  const newB = { ...rowB, ...orderFromA };
  const { endDough: endDoughA, endBatch: endBatchA } = recomputeEndTimesForRow(newA);
  const { endDough: endDoughB, endBatch: endBatchB } = recomputeEndTimesForRow(newB);
  newA.endDough = endDoughA;
  newA.endBatch = endBatchA;
  newB.endDough = endDoughB;
  newB.endBatch = endBatchB;

  const next = state.rows.map((r) => {
    if (r.id === rowIdA) return normalizeRow(newA);
    if (r.id === rowIdB) return normalizeRow(newB);
    return r;
  });
  state = { ...state, rows: next };
  persistRows(state.rows);
  pushToApi(state.planId, state.planDate, state.rows);
  emit();
}

/**
 * Delete a batch by row id.
 * @returns {{ success: boolean, error?: string }}
 */
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
