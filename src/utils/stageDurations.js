import { getStageDurationsForProduct as getFromRecipe, getTotalProcessMinutes as getTotalFromRecipe, getEndDoughProcessIdForProduct } from '../store/recipeStore.js';
import { getStageDurationsForProduct as getFromSku, getTotalProcessMinutes as getTotalFromSku } from '../data/skuProcessDurations.js';

function getStageDurationsForProduct(productName) {
  return getFromRecipe(productName) ?? getFromSku(productName);
}

// loaf line process chain — used when we sum minutes up to "end dough" for a given recipe step
const END_DOUGH_ORDER = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];
const PROCESS_ID_TO_LEGACY_KEY = {
  'mixing': 'mixing',
  'makeup-dividing': 'makeupDividing',
  'makeup-panning': 'makeupPanning',
  'baking': 'baking',
  'packaging': 'packaging',
};

// running sum of stage minutes through the chosen process — drives "end dough" time on the schedule
function getCumulativeMinutesUpToProcess(stages, processId) {
  const idx = END_DOUGH_ORDER.indexOf(processId);
  if (idx === -1) return stages.mixing ?? 0;
  let sum = 0;
  for (let i = 0; i <= idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    if (key) sum += (stages[key] ?? 0);
  }
  return sum;
}

function getTotalProcessMinutes(productName) {
  const total = getTotalFromRecipe(productName);
  if (total > 0) return total;
  return getTotalFromSku(productName) ?? 0;
}

const DAY_MINUTES = 24 * 60;

export const STAGE_RATIOS = {
  mixing: 0.18,
  makeupDividing: 0.16,
  makeupPanning: 0.18,
  baking: 0.30,
  packaging: 0.18,
};

export function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}

// wall clock add; wraps modulo 24h (we only return HH:MM so "next day" is handled elsewhere via date)
export function addMinutesToTime(timeStr, minutes) {
  const total = parseTimeToMinutes(timeStr) + Number(minutes);
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(normalized / 60) % 24;
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeTotalMinutesForRow(row) {
  const total = getTotalProcessMinutes(row.product);
  if (total > 0) return total;
  const base = Number(row.procTime);
  if (!Number.isNaN(base) && base > 0) return base;
  const startHM = parseTimeToMinutes(row.startSponge);
  const endHM = parseTimeToMinutes(row.endBatch);
  let endAbs = endHM;
  if (endAbs <= startHM) endAbs += DAY_MINUTES;
  return Math.max(30, endAbs - startHM);
}

export function computeStageDurations(totalMinutes) {
  const total = Math.max(30, Number(totalMinutes) || 0);
  if (!total) {
    return {
      mixing: 0,
      makeupDividing: 0,
      makeupPanning: 0,
      baking: 0,
      packaging: 0,
    };
  }
  const mixing = Math.max(5, Math.round(total * STAGE_RATIOS.mixing));
  const makeupDividing = Math.max(5, Math.round(total * STAGE_RATIOS.makeupDividing));
  const makeupPanning = Math.max(5, Math.round(total * STAGE_RATIOS.makeupPanning));
  const baking = Math.max(5, Math.round(total * STAGE_RATIOS.baking));
  const used = mixing + makeupDividing + makeupPanning + baking;
  const packaging = Math.max(5, total - used);
  return {
    mixing,
    makeupDividing,
    makeupPanning,
    baking,
    packaging,
  };
}

// prefer recipe/SKU table minutes; if product missing, fake it from total time * STAGE_RATIOS
export function computeStageDurationsForRow(row) {
  const sku = getStageDurationsForProduct(row.product);
  if (sku) return { ...sku };
  const total = computeTotalMinutesForRow(row);
  return computeStageDurations(total);
}

// endDough depends which process is flagged as "end dough" in the recipe (mixing only vs through panning etc).
// endBatch is start + full pipeline. returns HH:MM; bails to existing row values if totals are garbage
export function recomputeEndTimesForRow(row) {
  const stages = computeStageDurationsForRow(row);
  const total = stages.mixing + stages.makeupDividing + stages.makeupPanning + stages.baking + stages.packaging;
  if (!total || !row.startSponge || typeof row.startSponge !== 'string') {
    return { endDough: row.endDough ?? '00:00', endBatch: row.endBatch ?? '00:00' };
  }
  const endDoughProcessId = getEndDoughProcessIdForProduct(row.product);
  const endDoughMinutes = getCumulativeMinutesUpToProcess(stages, endDoughProcessId);
  const endDough = addMinutesToTime(row.startSponge, endDoughMinutes);
  const endBatch = addMinutesToTime(row.startSponge, total);
  return { endDough, endBatch };
}

const STAGE_KEYS_ORDERED = ['mixing', 'makeupDividing', 'makeupPanning', 'baking', 'packaging'];

// proc column for a tab: legacy ids (mixing, baking...) map straight to stage minutes.
// custom line process lists that still match the 5 loaf ids in order -> same mapping.
// anything else -> split total time evenly across N processes (best we can do)
export function getProcMinutesForPlanSection(row, sectionId, sortedProcesses) {
  const stages = computeStageDurationsForRow(row);
  const legacyKey = PROCESS_ID_TO_LEGACY_KEY[sectionId];
  if (legacyKey) {
    const v = stages[legacyKey];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  }

  const list = Array.isArray(sortedProcesses) ? sortedProcesses : [];
  const n = list.length;
  if (n === 0) return null;
  const idx = list.findIndex((p) => p.id === sectionId);
  if (idx < 0) return null;

  const matchesLoafOrder =
    n === END_DOUGH_ORDER.length && list.every((p, i) => p.id === END_DOUGH_ORDER[i]);
  if (matchesLoafOrder) {
    const k = STAGE_KEYS_ORDERED[idx];
    const v = stages[k];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  }

  const total =
    STAGE_KEYS_ORDERED.reduce((s, k) => s + (Number(stages[k]) || 0), 0) || computeTotalMinutesForRow(row);
  if (!total) return null;
  return Math.max(1, Math.round(total / n));
}

export function isLegacyProcessSectionId(sectionId) {
  return END_DOUGH_ORDER.includes(sectionId);
}

export function getProcessWindowStartOffsetMinutes(row, sectionId) {
  if (!isLegacyProcessSectionId(sectionId)) return null;
  const idx = END_DOUGH_ORDER.indexOf(sectionId);
  const stages = computeStageDurationsForRow(row);
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    sum += Number(stages[key]) || 0;
  }
  return sum;
}

export function getProcessWindowEndOffsetMinutes(row, sectionId) {
  if (!isLegacyProcessSectionId(sectionId)) return null;
  const idx = END_DOUGH_ORDER.indexOf(sectionId);
  const stages = computeStageDurationsForRow(row);
  let sum = 0;
  for (let i = 0; i <= idx; i++) {
    const key = PROCESS_ID_TO_LEGACY_KEY[END_DOUGH_ORDER[i]];
    sum += Number(stages[key]) || 0;
  }
  return sum;
}

export function getAlignedLegacyProcessProcMinutes(row, sectionId) {
  const start = getProcessWindowStartOffsetMinutes(row, sectionId);
  const end = getProcessWindowEndOffsetMinutes(row, sectionId);
  if (start === null || end === null) return null;
  return Math.max(0, Math.round(end - start));
}

export { DAY_MINUTES };
