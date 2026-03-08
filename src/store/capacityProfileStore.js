/**
 * Capacity profile store: product → capacity per line.
 * Uses Production page (productionLinesStore) as source of truth.
 * When lineId is provided (e.g. from plan row), uses that line; else infers from recipe's productionLineId or Loaf Line.
 */
import {
  getLoafLine,
  getCapacityForProductFromLine,
  getDoughWeightKgForProductFromLine,
  getYieldForProductFromLine,
  getCapacityProfileForLine,
  setCapacityProfileForLine,
  addCapacityEntryForLine,
  updateCapacityEntryForLine,
  deleteCapacityEntryForLine,
  getCapacityEntryForProduct,
} from './productionLinesStore.js';
import { getRecipeByName } from './recipeStore.js';

/**
 * Resolve capacity by product name. Uses lineId when provided (e.g. from plan row); otherwise infers from recipe's production line or Loaf Line.
 */
export function getCapacityForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getCapacityForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getCapacityForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getCapacityForProductFromLine(loaf.id, productName) : null;
}

/**
 * Resolve dough weight (kg) by product name. Uses lineId when provided; otherwise infers from recipe or Loaf Line.
 */
export function getDoughWeightKgForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getDoughWeightKgForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getDoughWeightKgForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getDoughWeightKgForProductFromLine(loaf.id, productName) : null;
}

/**
 * Resolve yield (pieces per one dough batch, e.g. 1092 for 8s) by product name. Uses lineId when provided; otherwise infers from recipe or Loaf Line.
 */
export function getYieldForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getYieldForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getYieldForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getYieldForProductFromLine(loaf.id, productName) : null;
}

/** Resolve grams per unit (target weight per piece in g) by product name. */
export function getGramsPerUnitForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  const entry = lineId
    ? getCapacityEntryForProduct(lineId, productName)
    : (() => {
        const recipe = getRecipeByName(productName);
        if (recipe?.productionLineId) return getCapacityEntryForProduct(recipe.productionLineId, productName);
        const loaf = getLoafLine();
        return loaf ? getCapacityEntryForProduct(loaf.id, productName) : null;
      })();
  return entry?.gramsPerUnit != null ? entry.gramsPerUnit : null;
}

/** Resolve total dough weight (kg) per batch including ingredients by product name. */
export function getTotalDoughWeightKgForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  const entry = lineId
    ? getCapacityEntryForProduct(lineId, productName)
    : (() => {
        const recipe = getRecipeByName(productName);
        if (recipe?.productionLineId) return getCapacityEntryForProduct(recipe.productionLineId, productName);
        const loaf = getLoafLine();
        return loaf ? getCapacityEntryForProduct(loaf.id, productName) : null;
      })();
  return entry?.totalDoughWeightKg != null ? entry.totalDoughWeightKg : null;
}

/** @deprecated Use productionLinesStore.getCapacityProfileForLine(loafLineId) for Loaf Line. */
export function getCapacityProfile() {
  const loaf = getLoafLine();
  return loaf ? getCapacityProfileForLine(loaf.id) : [];
}

/** @deprecated Use productionLinesStore.setCapacityProfileForLine(loafLineId, entries). */
export function setCapacityProfile(entries) {
  const loaf = getLoafLine();
  if (loaf && Array.isArray(entries)) {
    setCapacityProfileForLine(loaf.id, entries.map((e) => ({
      id: e.id,
      capacityName: String(e.capacityName ?? e.productOrType ?? '').trim(),
      productName: String(e.productName ?? '').trim(),
      capacity: Number(e.capacity) || 0,
    })));
  }
}

/** @deprecated Use productionLinesStore.addCapacityEntryForLine(loafLineId, entry). */
export function addCapacityEntry(productOrType, capacity) {
  const loaf = getLoafLine();
  if (loaf) addCapacityEntryForLine(loaf.id, { capacityName: productOrType, productName: '', capacity });
}

/** @deprecated Use productionLinesStore.updateCapacityEntryForLine. */
export function updateCapacityEntry(index, productOrType, capacity) {
  const loaf = getLoafLine();
  if (!loaf || !Array.isArray(loaf.capacityProfile)) return;
  const entry = loaf.capacityProfile[index];
  if (entry) updateCapacityEntryForLine(loaf.id, entry.id, { capacityName: productOrType, productName: entry.productName, capacity });
}

/** @deprecated Use productionLinesStore.deleteCapacityEntryForLine. */
export function deleteCapacityEntry(index) {
  const loaf = getLoafLine();
  if (!loaf || !Array.isArray(loaf.capacityProfile)) return;
  const entry = loaf.capacityProfile[index];
  if (entry) deleteCapacityEntryForLine(loaf.id, entry.id);
}
