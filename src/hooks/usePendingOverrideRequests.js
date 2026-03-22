import { useState, useEffect, useCallback } from 'react';
import { listOverrides, subscribeOverrides } from '../api/overrides';
import { isSupabaseConfigured } from '../lib/supabase';

export function usePendingOverrideRequests() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured()) {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listOverrides({ status: 'pending' }).then((list) => {
      setPending(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    return subscribeOverrides(() => refresh());
  }, [refresh]);

  return { pending, loading, refresh };
}
