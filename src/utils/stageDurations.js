import { getStageDurationsForProduct, getTotalProcessMinutes } from '../data/skuProcessDurations.js';

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

export { DAY_MINUTES };
