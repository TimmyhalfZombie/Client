// Pure helpers and hook for Activity screen logic
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { useActivity } from '../../features/useActivity';

export function resolveRequestId(x: any) {
  return (
    x?.id ??
    x?._id ??
    x?.requestId ??
    x?.assistId ??
    x?.assistanceId ??
    x?.request?.id ??
    x?.request?._id ??
    null
  );
}

export function resolveActivityId(x: any) {
  return (
    x?.activityId ??
    x?.activity?.id ??
    x?.id ??
    x?._id ??
    null
  );
}

export function formatWhen(dt: string | Date) {
  const d = new Date(dt);
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

export function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const h = Math.floor(diff / 3600000);
  if (h < 1) {
    const m = Math.floor(diff / 60000);
    return m <= 1 ? 'now' : `${m} min`;
  }
  if (h < 24) return `${h} hrs`;
  const days = Math.floor(h / 24);
  return `${days} d`;
}

export function useActivityScreen() {
  const { newItems, ongoingItems, recentItems, loading, error } = useActivity();
  const empty = useMemo(
    () => !loading && !error && newItems.length === 0 && ongoingItems.length === 0 && recentItems.length === 0,
    [loading, error, newItems.length, ongoingItems.length, recentItems.length]
  );

  const onPressNew = React.useCallback(() => {
    router.push('/assist');
  }, []);

  const onPressOngoing = React.useCallback((it: any) => {
    const rid = resolveRequestId(it);
    const aid = resolveActivityId(it);

    // keep snapshot small (prefer _raw if present)
    let snapSrc: any = (it as any)?._raw ?? it;
    // strip very heavy fields if any
    const { image, photo, ...rest } = snapSrc || {};
    const snap = encodeURIComponent(JSON.stringify(rest || {}));

    const qs = new URLSearchParams();
    if (rid) qs.set('id', String(rid));
    if (aid && String(aid) !== String(rid)) qs.set('activityId', String(aid));
    qs.set('snap', snap);

    const url = `/ongoing-detail?${qs.toString()}`;
    // eslint-disable-next-line no-console
    console.log('[OngoingActivity] push detail with', { rid, aid, url });

    router.push(url);
  }, []);

  const onPressRecent = React.useCallback((it: any) => {
    const rid = resolveRequestId(it);
    const aid = resolveActivityId(it);

    // keep snapshot small (prefer _raw if present)
    let snapSrc: any = (it as any)?._raw ?? it;
    // strip very heavy fields if any
    const { image, photo, ...rest } = snapSrc || {};
    const snap = encodeURIComponent(JSON.stringify(rest || {}));

    const qs = new URLSearchParams();
    if (rid) qs.set('id', String(rid));
    if (aid && String(aid) !== String(rid)) qs.set('activityId', String(aid));
    qs.set('snap', snap);

    const url = `/activity-detail?${qs.toString()}`;
    // eslint-disable-next-line no-console
    console.log('[RecentActivity] push detail with', { rid, aid, url });

    router.push(url);
  }, []);

  return { newItems, ongoingItems, recentItems, loading, error, empty, onPressNew, onPressOngoing, onPressRecent } as const;
}


