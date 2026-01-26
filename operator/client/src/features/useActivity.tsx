import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { tokens } from '../auth/tokenStore';
import { useDeclinedRequests } from '../contexts/DeclinedRequestsContext';
import { AssistItem, fetchOperatorInbox } from '../lib/activity.api';

const ACTIVE_MS = 500;        // poll every 0.5s in foreground
const BACKGROUND_MS = 1_000;  // poll every 1s in background

export function useActivity() {
  const [items, setItems] = useState<AssistItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { declinedIds, markAsDeclined } = useDeclinedRequests();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appActiveRef = useRef(true);
  const runningRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchOperatorInbox({ limit: 100 });
      setItems(data);
      if (!silent) setError(null);
    } catch (e) {
      if (!silent) {
        setError(e);
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // simple recursive timeout (more reliable than setInterval in RN)
  const schedule = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async function tick() {
      if (runningRef.current) return schedule(ms); // skip overlapping runs
      runningRef.current = true;
      try {
        await load(true); // silent refresh
      } finally {
        runningRef.current = false;
        timerRef.current = setTimeout(tick, ms);
      }
    }, ms);
  }, [load]);

  useEffect(() => {
    // initial load + start polling
    load(false);
    schedule(ACTIVE_MS);

    const sub = AppState.addEventListener('change', (s) => {
      const active = s === 'active';
      appActiveRef.current = active;
      // refresh immediately when user returns
      if (active) {
        load(true);
        schedule(ACTIVE_MS);
      } else {
        schedule(BACKGROUND_MS);
      }
    });

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load, schedule]);

  useEffect(() => {
    let active = true;
    tokens
      .getUserIdAsync()
      .then((id) => {
        if (active) setMyId(id);
      })
      .catch(() => {
        if (active) setMyId(null);
      });
    return () => {
      active = false;
    };
  }, []);


  // Split into "New" (pending), "Ongoing" (accepted but not completed), and "Recent" (completed/other)
  // Hide requests that this operator has declined locally, but keep database status as pending
  const newItems = useMemo(() => 
    items.filter(i => (i.status || 'pending') === 'pending'), [items]
  );
  
  const matchOwner = useCallback(
    (item: AssistItem | null | undefined): boolean => {
      if (!item || !myId) return false;
      const owner = item.operator?.id || item.assignedTo || item.acceptedBy;
      return owner ? String(owner) === String(myId) : false;
    },
    [myId]
  );

  const ongoingItems = useMemo(() => {
    if (!myId) return [];
    return items.filter((i) => (i.status || 'pending') === 'accepted' && matchOwner(i));
  }, [items, myId, matchOwner]);

  const hasOngoing = ongoingItems.length > 0;
  
  const filteredNewItems = useMemo(() => hasOngoing ? [] : newItems, [hasOngoing, newItems]);
  
  const recentItems = useMemo(() => {
    if (!myId) return [];
    return items.filter((i) => {
      const status = (i.status || 'pending').toLowerCase();
      if (status === 'pending' || status === 'accepted') return false;
      return matchOwner(i);
    });
  }, [items, myId, matchOwner]);

  return {
    items,
    newItems: filteredNewItems,
    ongoingItems,
    recentItems,
    hasOngoing,
    loading,
    error,
    markAsDeclined,
    reload: () => load(false),
  };
}
