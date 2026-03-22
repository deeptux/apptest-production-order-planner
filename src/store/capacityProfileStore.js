// thin facades so scheduling/dashboard don't import productionLinesStore everywhere.
// pass lineId from the plan row when you have it; otherwise we guess from recipe.productionLineId or default loaf line
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

export function getCapacityForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getCapacityForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getCapacityForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getCapacityForProductFromLine(loaf.id, productName) : null;
}

export function getDoughWeightKgForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getDoughWeightKgForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getDoughWeightKgForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getDoughWeightKgForProductFromLine(loaf.id, productName) : null;
}

export function getYieldForProduct(productName, lineId) {
  if (!productName || typeof productName !== 'string') return null;
  if (lineId) return getYieldForProductFromLine(lineId, productName);
  const recipe = getRecipeByName(productName);
  if (recipe?.productionLineId) return getYieldForProductFromLine(recipe.productionLineId, productName);
  const loaf = getLoafLine();
  return loaf ? getYieldForProductFromLine(loaf.id, productName) : null;
}

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

// @deprecated — use getCapacityProfileForLine(loaf id)
export function getCapacityProfile() {
  const loaf = getLoafLine();
  return loaf ? getCapacityProfileForLine(loaf.id) : [];
}

// @deprecated
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

// @deprecated
export function addCapacityEntry(productOrType, capacity) {
  const loaf = getLoafLine();
  if (loaf) addCapacityEntryForLine(loaf.id, { capacityName: productOrType, productName: '', capacity });
}

// @deprecated
export function updateCapacityEntry(index, productOrType, capacity) {
  const loaf = getLoafLine();
  if (!loaf || !Array.isArray(loaf.capacityProfile)) return;
  const entry = loaf.capacityProfile[index];
  if (entry) updateCapacityEntryForLine(loaf.id, entry.id, { capacityName: productOrType, productName: entry.productName, capacity });
}

// @deprecated
export function deleteCapacityEntry(index) {
  const loaf = getLoafLine();
  if (!loaf || !Array.isArray(loaf.capacityProfile)) return;
  const entry = loaf.capacityProfile[index];
  if (entry) deleteCapacityEntryForLine(loaf.id, entry.id);
}
