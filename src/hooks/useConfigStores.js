import { useSyncExternalStore, useMemo } from 'react';
import {
  subscribeRecipes,
  getRecipesSnapshot,
  getRecipes,
  getRecipesForLine,
} from '../store/recipeStore';
import {
  subscribeLines,
  getLinesSnapshot,
  getLines,
} from '../store/productionLinesStore';

function getRecipesServerSnapshot() {
  return getRecipesSnapshot();
}

function getLinesServerSnapshot() {
  return getLinesSnapshot();
}

/** Re-render when recipes change (Realtime, same-tab edits, other-tab localStorage). */
export function useRecipesVersion() {
  return useSyncExternalStore(subscribeRecipes, getRecipesSnapshot, getRecipesServerSnapshot);
}

/** Re-render when production lines change. */
export function useLinesVersion() {
  return useSyncExternalStore(subscribeLines, getLinesSnapshot, getLinesServerSnapshot);
}

export function useRecipesList() {
  const { version } = useRecipesVersion();
  return useMemo(() => getRecipes(), [version]);
}

export function useLinesList() {
  const { version } = useLinesVersion();
  return useMemo(() => getLines(), [version]);
}

export function useRecipesForLine(lineId) {
  const { version } = useRecipesVersion();
  return useMemo(() => (lineId ? getRecipesForLine(lineId) : getRecipes()), [version, lineId]);
}
