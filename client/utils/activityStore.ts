// client/utils/activityStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACTIVITY_STORAGE_KEY } from "@/constants/activity";
import assistService from "@/services/assistService";
import { AssistRequest, ActivityItem } from "@/types";

type Listener = () => void;
const listeners = new Set<Listener>();

// Cross-platform-safe timer type (RN/Web/Node)
let notifyTimeout: ReturnType<typeof setTimeout> | null = null;

export function onActivityChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyActivityChange() {
  if (notifyTimeout) {
    clearTimeout(notifyTimeout);
  }
  notifyTimeout = setTimeout(() => {
    for (const fn of listeners) fn();
    notifyTimeout = null;
  }, 100);
}

export async function getActivity(): Promise<ActivityItem[]> {
  const raw = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ActivityItem[];
  } catch {
    return [];
  }
}

/* ===================== Server sync (no local seeding) ===================== */
let lastSyncTime = 0;
let isSyncing = false;
const SYNC_CACHE_DURATION = 30000; // 30s

export async function syncActivityFromServer(): Promise<ActivityItem[]> {
  const now = Date.now();

  if (isSyncing) {
    const cachedData = await getActivity();
    return cachedData;
  }

  if (now - lastSyncTime < SYNC_CACHE_DURATION) {
    const cachedData = await getActivity();
    if (cachedData.length > 0) {
      return cachedData;
    }
  }

  isSyncing = true;
  try {
    const serverRequests = await assistService.fetchUserAssistRequests();

    const activityItems: ActivityItem[] = serverRequests.map(
      (request: AssistRequest) => ({
        id: request._id, // use server id directly
        title: request.title || "Assistance Request",
        placeName:
          request.placeName || request.customerName || "Unknown location",
        createdAt: request.createdAt,
        status: request.status,
        meta: {
          assistId: request._id,
          operator: request.assignedTo,
        },
      })
    );

    await setActivity(activityItems, false);
    lastSyncTime = now;
    return activityItems;
  } catch (error) {
    console.error("❌ Error syncing activity from server:", error);
    const cachedData = await getActivity();
    return cachedData.length > 0 ? cachedData : [];
  } finally {
    isSyncing = false;
  }
}

export async function setActivity(
  list: ActivityItem[],
  shouldNotify = true
): Promise<void> {
  await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(list));
  if (shouldNotify) notifyActivityChange();
}

export async function addActivityItem(item: ActivityItem): Promise<void> {
  const list = await getActivity();
  
  // If this is a new pending request, remove any existing pending requests
  if (item.status === "pending") {
    const filteredList = list.filter(i => i.status !== "pending");
    filteredList.unshift(item);
    await setActivity(filteredList);
  } else {
    list.unshift(item);
    await setActivity(list);
  }
}

/**
 * Smarter update: try by id first; if not found, try by meta.assistId.
 * This lets us update items whether the caller holds the local temp id
 * or the server id.
 */
export async function updateActivityItem(
  idOrAssistId: string,
  patch: Partial<ActivityItem>
): Promise<void> {
  const list = await getActivity();

  let idx = list.findIndex((i) => i.id === idOrAssistId);
  if (idx < 0) {
    idx = list.findIndex(
      (i) => String(i.meta?.assistId ?? "") === String(idOrAssistId)
    );
  }

  if (idx >= 0) {
    const prev = list[idx];
    if (!prev) return; // guard for noUncheckedIndexedAccess

    const next: ActivityItem = {
      id: prev.id,
      title: patch.title ?? prev.title,
      placeName: patch.placeName ?? prev.placeName,
      createdAt: patch.createdAt ?? prev.createdAt,
      status: (patch.status ?? prev.status) as ActivityItem["status"],
      meta: { ...(prev.meta || {}), ...(patch.meta || {}) },
      location: {
        ...(prev.location || {}),
        ...(patch.location || {}),
      },
    };

    list[idx] = next;
    await setActivity(list);
  }
}

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY);
  notifyActivityChange();
}

export async function forceRefreshFromDatabase(): Promise<ActivityItem[]> {
  return await syncActivityFromServer();
}

/* ========================= Helpers the UI expects ========================= */

type Where = { id?: string; assistId?: string | number | null };

/**
 * Find item index by either local id or meta.assistId.
 */
function findIndexByWhere(list: ActivityItem[], where: Where): number {
  if (where.id) {
    const ix = list.findIndex((i) => i.id === where.id);
    if (ix >= 0) return ix;
  }
  if (where.assistId != null) {
    const srv = String(where.assistId);
    const ix = list.findIndex(
      (i) => String(i.meta?.assistId ?? "") === srv
    );
    if (ix >= 0) return ix;
  }
  return -1;
}

/**
 * Set activity status locally. Returns true if an item was updated.
 */
export async function setActivityStatus(
  where: Where,
  status: ActivityItem["status"]
): Promise<boolean> {
  const list = await getActivity();
  const idx = findIndexByWhere(list, where);
  if (idx < 0) return false;

  const prev = list[idx];
  if (!prev) return false; // guard

  const next: ActivityItem = {
    ...prev,
    status,
    id: prev.id,
    title: prev.title,
    createdAt: prev.createdAt,
    meta: { ...(prev.meta || {}) },
    location: prev.location ? { ...prev.location } : undefined,
    placeName: prev.placeName,
  };

  list[idx] = next;
  await setActivity(list);
  return true;
}

/**
 * Mark as canceled (local) & try to cancel on server if we have an assist id.
 * Returns true if local state changed.
 */
export async function markActivityCanceled(where: Where): Promise<boolean> {
  const list = await getActivity();
  const idx = findIndexByWhere(list, where);
  if (idx < 0) return false;

  const item = list[idx];
  if (!item) return false; // guard

  const assistId = item.meta?.assistId || item.id; // prefer server id

  // Best-effort server cancel; do not block UI
  try {
    if (assistId) {
      await assistService.cancelAssistRequest(String(assistId));
    }
  } catch {
    // swallow error; keep local state consistent
  }

  const next: ActivityItem = {
    ...item,
    status: "canceled",
    id: item.id,
    title: item.title,
    createdAt: item.createdAt,
    meta: { ...(item.meta || {}) },
    location: item.location ? { ...item.location } : undefined,
    placeName: item.placeName,
  };

  list[idx] = next;
  await setActivity(list);
  return true;
}

/**
 * Cancel the most recent pending item (first in array with status=pending).
 * Useful for the overlay "Cancel request" before we have ids.
 */
export async function cancelMostRecentPending(): Promise<boolean> {
  const list = await getActivity();
  const idx = list.findIndex((i) => i.status === "pending");
  if (idx < 0) return false;

  const item = list[idx];
  if (!item) return false; // guard

  const assistId = item.meta?.assistId;

  // Best-effort server cancel if we already have an assist id
  try {
    if (assistId) {
      await assistService.cancelAssistRequest(String(assistId));
    }
  } catch {
    // ignore
  }

  const next: ActivityItem = {
    ...item,
    status: "canceled",
    id: item.id,
    title: item.title,
    createdAt: item.createdAt,
    meta: { ...(item.meta || {}) },
    location: item.location ? { ...item.location } : undefined,
    placeName: item.placeName,
  };

  list[idx] = next;
  await setActivity(list);
  return true;
}

/* ===================== remove helpers & realtime binds ==================== */

export async function removeActivity(where: Where): Promise<boolean> {
  const list = await getActivity();
  const before = list.length;
  const next = list.filter(
    (i) =>
      !(
        (where.id && i.id === where.id) ||
        (where.assistId != null &&
          String(i.meta?.assistId ?? "") === String(where.assistId))
      )
  );
  if (next.length === before) return false;
  await setActivity(next);
  return true;
}
export async function removeActivityByAssistId(
  assistId: string | number
): Promise<boolean> {
  return removeActivity({ assistId });
}
export async function removeActivityById(id: string): Promise<boolean> {
  return removeActivity({ id });
}

export function bindAssistRealtimeDeletes(socket: {
  on: (ev: string, cb: (...a: any[]) => void) => void;
  off: (ev: string, cb: (...a: any[]) => void) => void;
}) {
  const onDeleted = ({ id }: { id: string }) => {
    removeActivityByAssistId(id);
    notifyActivityChange();
  };
  const onStatus = ({ id, status }: { id: string; status: string }) => {
    if (status === "deleted") {
      removeActivityByAssistId(id);
    } else {
      updateActivityItem(id, {
        status: status as ActivityItem["status"],
      });
    }
    notifyActivityChange();
  };
  const onApproved = ({ id }: { id: string }) => {
    updateActivityItem(id, { status: "accepted" });
    notifyActivityChange();
  };

  socket.on("assist:deleted", onDeleted);
  socket.on("assist:status", onStatus);
  socket.on("assist:approved", onApproved);

  return () => {
    socket.off("assist:deleted", onDeleted);
    socket.off("assist:status", onStatus);
    socket.off("assist:approved", onApproved);
  };
}
