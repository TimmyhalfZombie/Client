import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { acceptAssist, declineAssist, fetchNextAssist } from './assistance/api';
import { AssistanceRequest } from './assistance/types';

const ACTIVE_MS = 10_000;     // poll every 10s in foreground
const BACKGROUND_MS = 30_000; // poll every 30s in background

export function useNextAssist() {
  const [data, setData] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appActiveRef = useRef(true);
  const runningRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const item = await fetchNextAssist();
      setData(item ?? null);
      if (!silent) setError('');
    } catch (e: any) {
      if (!silent) setError(e?.message ?? 'Failed to load');
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

  const accept = useCallback(
    async (explicitId?: string) => {
      const id = explicitId ?? data?.id;
      if (!id) throw new Error('Missing request id');
      try {
        const { conversationId } = await acceptAssist(id);
        if (conversationId) {
          const displayName = data?.clientName || data?._raw?.clientName || 'Client';
          router.push({ pathname: '/chat/[id]', params: { id: conversationId, name: displayName } });
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not pending')) {
          throw new Error('This request is no longer pending (already handled).');
        }
        throw e;
      } finally {
        await load(true);
      }
    },
    [data?.id, load]
  );

  const decline = useCallback(
    async (explicitId?: string) => {
      const id = explicitId ?? data?.id;
      if (!id) throw new Error('Missing request id');
      try {
        await declineAssist(id);
      } finally {
        await load(true);
      }
    },
    [data?.id, load]
  );

  return { data, loading, error, reload: () => load(false), accept, decline };
}
