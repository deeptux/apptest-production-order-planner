// recipes = products + how long each stage runs. newer shape is processDurations[processId]=minutes;
// old saved data still has mixing / makeupDividing keys — we normalize both ways so scheduling doesn't break
import { SKU_PROCESS_DURATIONS } from '../data/skuProcessDurations.js';
import { getLines, getProcessesForLine, getMixingProfiles, getProfileTotalMinutes } from './productionLinesStore.js';
import { isSupabaseConfigured } from '../lib/supabase';
import { updateConfig } from '../api/config';

const LOAF_RECIPES_KEY = 'loaf-recipes';

// fixed loaf order — ids line up with camelCase keys on disk
const LEGACY_PROCESS_IDS = ['mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging'];
const LEGACY_KEYS = ['mixing', 'makeupDividing', 'makeupPanning', 'baking', 'packaging'];

// ui uses hyphen ids; stored recipes often use camelCase — bridge table
export const PROCESS_ID_TO_LEGACY_KEY = {
  'mixing': 'mixing',
  'makeup-dividing': 'makeupDividing',
  'makeup-panning': 'makeupPanning',
  'baking': 'baking',
  'packaging': 'packaging',
};

function legacyToProcessDurations(r) {
  return {
    'mixing': Number(r.mixing) || 0,
    'makeup-dividing': Number(r.makeupDividing) || 0,
    'makeup-panning': Number(r.makeupPanning) || 0,
    'baking': Number(r.baking) || 0,
    'packaging': Number(r.packaging) || 0,
  };
}

function processDurationsToLegacy(pd) {
  if (!pd || typeof pd !== 'object') return {};
  return {
    mixing: Number(pd['mixing']) || 0,
    makeupDividing: Number(pd['makeup-dividing']) || 0,
    makeupPanning: Number(pd['makeup-panning']) || 0,
    baking: Number(pd['baking']) || 0,
    packaging: Number(pd['packaging']) || 0,
  };
}

function recipeFromSku(name, durations, productionLineId = 'line-loaf') {
  const processDurations = legacyToProcessDurations(durations);
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  return {
    id: `recipe-${slug}-${productionLineId}`,
    name,
    productionLineId,
    endDoughProcessId: 'mixing',
    ...processDurationsToLegacy(processDurations),
    processDurations,
  };
}

function getDefaultRecipes() {
  return Object.entries(SKU_PROCESS_DURATIONS).map(([name, d]) => recipeFromSku(name, d, 'line-loaf'));
}

function loadRecipes() {
  try {
    const raw = localStorage.getItem(LOAF_RECIPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeRecipe);
      }
    }
  } catch (_) {}
  const defaultRecipes = getDefaultRecipes();
  try {
    localStorage.setItem(LOAF_RECIPES_KEY, JSON.stringify(defaultRecipes));
  } catch (_) {}
  return defaultRecipes;
}

function normalizeRecipe(r) {
  const processDurations = r.processDurations && typeof r.processDurations === 'object'
    ? { ...r.processDurations }
    : legacyToProcessDurations(r);
  const processProfileIds = r.processProfileIds && typeof r.processProfileIds === 'object'
    ? { ...r.processProfileIds }
    : {};
  const legacy = processDurationsToLegacy(processDurations);
  const productionLineId = r.productionLineId || 'line-loaf';
  return {
    id: r.id || `recipe-${String(r.name).replace(/\s+/g, '-').toLowerCase()}-${productionLineId}-${Date.now()}`,
    name: String(r.name || '').trim(),
    productionLineId,
    endDoughProcessId: (r.endDoughProcessId && typeof r.endDoughProcessId === 'string') ? r.endDoughProcessId : 'mixing',
    ...legacy,
    processDurations,
    processProfileIds,
  };
}

let recipes = loadRecipes();

const recipeListeners = new Set();
let recipeVersion = 0;
let cachedRecipeSnapshot = { version: 0 };

function bumpRecipeVersion() {
  recipeVersion += 1;
  cachedRecipeSnapshot = { version: recipeVersion };
  recipeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('recipeStore listener', e);
    }
  });
}

/** React useSyncExternalStore — subscribe to recipe list changes (local edits, Realtime, other-tab storage). */
export function subscribeRecipes(listener) {
  recipeListeners.add(listener);
  return () => recipeListeners.delete(listener);
}

export function getRecipesSnapshot() {
  return cachedRecipeSnapshot;
}

function persistLocalOnly() {
  try {
    localStorage.setItem(LOAF_RECIPES_KEY, JSON.stringify(recipes));
  } catch (_) {}
  bumpRecipeVersion();
}

function persist() {
  persistLocalOnly();
  if (isSupabaseConfigured()) {
    updateConfig('recipes', { recipes }); // async, key "recipes"
  }
}

// supabase / cross-tab pull -> memory (do not upsert back to Supabase — avoids echo + extra writes)
export function hydrateRecipesFromApi(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  recipes = list.map((r) => normalizeRecipe(r));
  persistLocalOnly();
}

// body for PATCH config
export function getRecipesPayloadForApi() {
  return recipes.map((r) => ({ ...r }));
}

export function getRecipes() {
  return recipes.map((r) => ({ ...r }));
}

// recipe editor filters here so buns line doesn't show loaf skus
export function getRecipesForLine(lineId) {
  if (!lineId) return [];
  return recipes.filter((r) => r.productionLineId === lineId).map((r) => ({ ...r }));
}

export function getRecipeByName(name) {
  if (!name) return null;
  return recipes.find((r) => r.name === name) ?? null;
}

// which step counts as "end dough" on the grid — default mixing if recipe forgot to set it
export function getEndDoughProcessIdForProduct(productName) {
  const r = getRecipeByName(productName);
  return (r && r.endDoughProcessId) ? r.endDoughProcessId : 'mixing';
}

export function getStageDurationsForProduct(productName) {
  const r = getRecipeByName(productName);
  if (!r) return null;
  return {
    mixing: r.mixing,
    makeupDividing: r.makeupDividing,
    makeupPanning: r.makeupPanning,
    baking: r.baking,
    packaging: r.packaging,
  };
}

export function getTotalProcessMinutes(productName) {
  const d = getStageDurationsForProduct(productName);
  if (!d) return 0;
  return (d.mixing || 0) + (d.makeupDividing || 0) + (d.makeupPanning || 0) + (d.baking || 0) + (d.packaging || 0);
}

// sum minutes only for processes that actually exist on that line (custom lines may omit a stage)
export function getTotalProcessMinutesForLine(productName, lineId) {
  const r = getRecipeByName(productName);
  if (!r || !lineId) return getTotalProcessMinutes(productName);
  const procs = getProcessesForLine(lineId);
  if (!procs.length) return getTotalProcessMinutes(productName);
  const pd = r.processDurations || legacyToProcessDurations(r);
  return procs.reduce((sum, p) => sum + (Number(pd[p.id]) || 0), 0);
}

export function setRecipes(next) {
  if (!Array.isArray(next)) return;
  recipes = next.map(normalizeRecipe);
  persist();
}

export function addRecipe(recipe) {
  const lineId = recipe.productionLineId || 'line-loaf';
  const normalized = normalizeRecipe({
    id: recipe.id,
    name: recipe.name,
    productionLineId: lineId,
    endDoughProcessId: recipe.endDoughProcessId,
    mixing: recipe.mixing,
    makeupDividing: recipe.makeupDividing,
    makeupPanning: recipe.makeupPanning,
    baking: recipe.baking,
    packaging: recipe.packaging,
    processDurations: recipe.processDurations,
    processProfileIds: recipe.processProfileIds,
  });
  const slug = String(normalized.name).replace(/\s+/g, '-').toLowerCase();
  const id = normalized.id || `recipe-${slug}-${lineId}-${Date.now()}`;
  const newRecipe = { ...normalized, id };
  recipes = [...recipes, newRecipe];
  persist();
  return newRecipe;
}

export function updateRecipe(id, updates) {
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const current = recipes[idx];
  let next = { ...current, ...updates };
  if (updates.endDoughProcessId !== undefined) next.endDoughProcessId = updates.endDoughProcessId;
  if (updates.processDurations !== undefined) {
    // Recipe page edits pass the whole durations object, so we replace.
    // Merging here keeps stale keys around when line/process config changed.
    next.processDurations = { ...(updates.processDurations || {}) };
    const legacy = processDurationsToLegacy(next.processDurations);
    next = { ...next, ...legacy };
  }
  if (updates.processProfileIds !== undefined) {
    next.processProfileIds = { ...(updates.processProfileIds || {}) };
  }
  next = normalizeRecipe(next);
  recipes = [...recipes.slice(0, idx), next, ...recipes.slice(idx + 1)];
  persist();
  return next;
}

// Keep recipes valid even if Production line/process config changed a lot.
// This prevents "can't edit / doesn't reflect" issues after line changes.
export function repairRecipesAfterLinesChange() {
  const lines = getLines();
  if (!Array.isArray(lines) || lines.length === 0) return;

  const fallbackLineId = lines[0].id;
  let changed = false;

  const nextRecipes = recipes.map((raw) => {
    const current = normalizeRecipe(raw);
    const validLineId = lines.some((l) => l.id === current.productionLineId)
      ? current.productionLineId
      : fallbackLineId;
    const lineProcesses = getProcessesForLine(validLineId);
    const validProcessIds = new Set(lineProcesses.map((p) => p.id));
    const source = current.processDurations && typeof current.processDurations === 'object'
      ? current.processDurations
      : legacyToProcessDurations(current);
    const sourceProfileIds = current.processProfileIds && typeof current.processProfileIds === 'object'
      ? current.processProfileIds
      : {};

    const cleaned = {};
    const cleanedProfileIds = {};
    lineProcesses.forEach((p) => {
      const wantedProfileId = sourceProfileIds[p.id];
      const profiles = getMixingProfiles(validLineId, p.id);
      const hasProfile = wantedProfileId && profiles.some((x) => x.id === wantedProfileId);
      if (hasProfile) {
        cleanedProfileIds[p.id] = wantedProfileId;
        cleaned[p.id] = getProfileTotalMinutes(validLineId, p.id, wantedProfileId);
      } else {
        cleaned[p.id] = Number(source[p.id]) || 0;
      }
    });

    const preferredEndDough = String(current.endDoughProcessId || '').trim();
    const endDoughProcessId = validProcessIds.has(preferredEndDough)
      ? preferredEndDough
      : (lineProcesses[0]?.id || 'mixing');

    const normalized = normalizeRecipe({
      ...current,
      productionLineId: validLineId,
      processDurations: cleaned,
      processProfileIds: cleanedProfileIds,
      endDoughProcessId,
    });

    const before = JSON.stringify({
      productionLineId: current.productionLineId,
      processDurations: current.processDurations,
      processProfileIds: current.processProfileIds,
      endDoughProcessId: current.endDoughProcessId,
    });
    const after = JSON.stringify({
      productionLineId: normalized.productionLineId,
      processDurations: normalized.processDurations,
      processProfileIds: normalized.processProfileIds,
      endDoughProcessId: normalized.endDoughProcessId,
    });
    if (before !== after) changed = true;
    return normalized;
  });

  if (!changed) return;
  recipes = nextRecipes;
  persist();
}

export function deleteRecipe(id) {
  recipes = recipes.filter((r) => r.id !== id);
  persist();
}

export { LOAF_RECIPES_KEY };
