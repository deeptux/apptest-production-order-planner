import { getStageDurationsForProduct as getFromRecipe, getTotalProcessMinutes as getTotalFromRecipe } from '../store/recipeStore.js';
import { getStageDurationsForProduct as getFromSku, getTotalProcessMinutes as getTotalFromSku } from '../data/skuProcessDurations.js';

function getStageDurationsForProduct(productName) {
  return getFromRecipe(productName) ?? getFromSku(productName);
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

/** Add minutes to "HH:MM" and return "HH:MM" (can cross midnight). */
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

/** Returns stage durations for this row: real SKU data when product is known, else ratio-based fallback. */
export function computeStageDurationsForRow(row) {
  const sku = getStageDurationsForProduct(row.product);
  if (sku) return { ...sku };
  const total = computeTotalMinutesForRow(row);
  return computeStageDurations(total);
}

/**
 * Recompute endDough (end of mixing) and endBatch from row's startSponge and process durations.
 * Returns { endDough, endBatch } as "HH:MM" or existing values if total minutes are invalid.
 */
export function recomputeEndTimesForRow(row) {
  const stages = computeStageDurationsForRow(row);
  const total = stages.mixing + stages.makeupDividing + stages.makeupPanning + stages.baking + stages.packaging;
  if (!total || !row.startSponge || typeof row.startSponge !== 'string') {
    return { endDough: row.endDough ?? '00:00', endBatch: row.endBatch ?? '00:00' };
  }
  const mixingMinutes = stages.mixing ?? 0;
  const endDough = addMinutesToTime(row.startSponge, mixingMinutes);
  const endBatch = addMinutesToTime(row.startSponge, total);
  return { endDough, endBatch };
}

export { DAY_MINUTES };
