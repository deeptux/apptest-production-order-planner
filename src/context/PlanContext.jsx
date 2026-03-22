import { useSyncExternalStore, useRef, useEffect } from 'react';
import { getPlan, subscribePlan } from '../api/plan';
import { getConfig, updateConfig, subscribeConfig } from '../api/config';
import { isSupabaseConfigured } from '../lib/supabase';
import { hydrateRecipesFromApi, getRecipesPayloadForApi, LOAF_RECIPES_KEY } from '../store/recipeStore';
import { hydrateLinesFromApi, getLinesPayloadForApi, LINES_STORAGE_KEY } from '../store/productionLinesStore';
import { useSnackbar } from './SnackbarContext';
import {
  initPlanStore,
  hydrateFromApi,
  hydrateFromLocalStorage,
  clearLocalRowsCache,
  setPlanFromRemote,
  shouldSkipNextRealtime,
  subscribe,
  getSnapshot,
  PLAN_ROWS_STORAGE_KEY,
} from '../store/planStore';

// invisible child: pulls remote plan + config, pushes into planStore. keeps layout from re-rendering on every row edit
// because actual row state lives in the external store, not react context
function PlanSync() {
  const skipRef = useRef(false);
  const { show: showSnackbar } = useSnackbar() ?? {};

  useEffect(() => {
    initPlanStore({ getSkipRef: () => skipRef });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      hydrateFromApi(null);
      return;
    }
    getPlan()
      .then((data) => {
        // Authoritative Supabase: discard local cache then hydrate from Supabase.
        clearLocalRowsCache();
        hydrateFromApi(data);
      })
      .catch(() => {
        hydrateFromLocalStorage(); // couldn't reach supabase — last local copy
        if (typeof showSnackbar === 'function') showSnackbar('Offline mode (local cache)');
      });
  }, []);

  // When the browser comes back online, re-hydrate from Supabase (authoritative).
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const onOnline = () => {
      getPlan()
        .then((data) => {
          clearLocalRowsCache();
          hydrateFromApi(data);
          if (typeof showSnackbar === 'function') showSnackbar('Re-synced from Supabase');
        })
        .catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [showSnackbar]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getConfig('recipes').then((data) => {
      if (data?.payload?.recipes && Array.isArray(data.payload.recipes) && data.payload.recipes.length > 0) {
        hydrateRecipesFromApi(data.payload.recipes);
      } else {
        // Seed Supabase with current local recipes (defaults) if no config exists yet.
        const recipes = getRecipesPayloadForApi();
        if (recipes.length > 0) updateConfig('recipes', { recipes });
      }
    });
    getConfig('lines').then((data) => {
      if (data?.payload?.lines && Array.isArray(data.payload.lines) && data.payload.lines.length > 0) {
        hydrateLinesFromApi(data.payload.lines);
      } else {
        const lines = getLinesPayloadForApi();
        if (lines.length > 0) updateConfig('lines', { lines });
      }
    });
  }, []);

  // Supabase Realtime on config (recipes / lines) — WebSocket-backed, same as plan.
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsub = subscribeConfig((key, row) => {
      if (key === 'recipes') {
        const list = row?.payload?.recipes;
        if (Array.isArray(list) && list.length > 0) {
          hydrateRecipesFromApi(list);
        } else {
          getConfig('recipes').then((data) => {
            if (data?.payload?.recipes && Array.isArray(data.payload.recipes) && data.payload.recipes.length > 0) {
              hydrateRecipesFromApi(data.payload.recipes);
            }
          });
        }
        return;
      }
      if (key === 'lines') {
        const list = row?.payload?.lines;
        if (Array.isArray(list) && list.length > 0) {
          hydrateLinesFromApi(list);
        } else {
          getConfig('lines').then((data) => {
            if (data?.payload?.lines && Array.isArray(data.payload.lines) && data.payload.lines.length > 0) {
              hydrateLinesFromApi(data.payload.lines);
            }
          });
        }
      }
    });
    return unsub;
  }, []);

  // Offline / no Supabase: other tabs writing localStorage for recipes or lines
  useEffect(() => {
    if (isSupabaseConfigured()) return undefined;
    const onStorage = (e) => {
      if (e.key !== LOAF_RECIPES_KEY && e.key !== LINES_STORAGE_KEY) return;
      if (e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (!Array.isArray(parsed)) return;
        if (e.key === LOAF_RECIPES_KEY && parsed.length > 0) hydrateRecipesFromApi(parsed);
        if (e.key === LINES_STORAGE_KEY && parsed.length > 0) hydrateLinesFromApi(parsed);
      } catch (_) {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const unsub = subscribePlan((data) => {
      if (shouldSkipNextRealtime()) return;
      if (data?.rows && Array.isArray(data.rows)) {
        setPlanFromRemote(data);
        if (typeof showSnackbar === 'function') showSnackbar('Plan updated');
      }
    });
    return unsub;
  }, [showSnackbar]);

  useEffect(() => {
    if (isSupabaseConfigured()) return undefined;
    const handleStorage = (e) => {
      if (e.key !== PLAN_ROWS_STORAGE_KEY || e.newValue == null) return;
      try {
        const next = JSON.parse(e.newValue);
        if (Array.isArray(next)) setPlanFromRemote({ rows: next });
      } catch (_) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}

export function PlanProvider({ children }) {
  return (
    <>
      <PlanSync />
      {children}
    </>
  );
}

function getServerSnapshot() {
  return getSnapshot();
}

export function usePlan() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!snapshot) throw new Error('usePlan: store not ready');
  return snapshot;
}
