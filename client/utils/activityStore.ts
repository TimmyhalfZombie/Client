import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACTIVITY_STORAGE_KEY } from "@/constants/activity";
import assistService, { AssistRequest } from "@/services/assistService";

export type ActivityItem = {
  id: string;
  title: string;
  placeName?: string;
  createdAt: string;
  status: "pending" | "accepted" | "done" | "canceled";
  meta?: { assistId?: string | null; operator?: any; [k: string]: any };
  location?: {
    street?: string;
    barangay?: string;
    city?: string;
  };
};

type Listener = () => void;
const listeners = new Set<Listener>();
let notifyTimeout: NodeJS.Timeout | null = null;

export function onActivityChange(fn: Listener) { 
  listeners.add(fn); 
  return () => listeners.delete(fn); 
}

function notifyActivityChange() { 
  // Debounce notifications to prevent excessive re-renders
  if (notifyTimeout) {
    clearTimeout(notifyTimeout);
  }
  notifyTimeout = setTimeout(() => {
    for (const fn of listeners) fn();
    notifyTimeout = null;
  }, 100); // 100ms debounce
}

export async function getActivity(): Promise<ActivityItem[]> {
  const raw = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ActivityItem[]; } catch { return []; }
}

// ✅ NEW: Sync with server data - ONLY database data, no fallback
let lastSyncTime = 0;
let isSyncing = false;
const SYNC_CACHE_DURATION = 30000; // 30 seconds cache to prevent spamming

export async function syncActivityFromServer(): Promise<ActivityItem[]> {
  const now = Date.now();
  
  // Prevent concurrent syncs
  if (isSyncing) {
    console.log("⏳ Sync already in progress, waiting...");
    // Wait a bit and return cached data
    const cachedData = await getActivity();
    return cachedData;
  }
  
  // Use cache if data was synced recently
  if (now - lastSyncTime < SYNC_CACHE_DURATION) {
    const cachedData = await getActivity();
    if (cachedData.length > 0) {
      console.log("📦 Using cached data (synced recently)");
      return cachedData;
    }
  }
  
  isSyncing = true;
  try {
    console.log("🔄 Syncing from server...");
    const serverRequests = await assistService.fetchUserAssistRequests();
    console.log("📊 Server returned", serverRequests.length, "requests");
    
    const activityItems: ActivityItem[] = serverRequests.map((request: AssistRequest) => ({
      id: request._id,
      title: request.title || "Assistance Request",
      placeName: request.placeName || request.customerName || "Unknown location",
      createdAt: request.createdAt,
      status: request.status,
      meta: {
        assistId: request._id,
        operator: request.assignedTo,
      },
    }));
    
    console.log("💾 Created", activityItems.length, "activity items");
    await setActivity(activityItems, false); // Don't notify during sync
    lastSyncTime = now;
    return activityItems;
  } catch (error) {
    console.error("❌ Error syncing activity from server:", error);
    // Return cached data if available, otherwise empty array
    const cachedData = await getActivity();
    console.log("📦 Returning cached data:", cachedData.length, "items");
    return cachedData.length > 0 ? cachedData : [];
  } finally {
    isSyncing = false;
  }
}
export async function setActivity(list: ActivityItem[], shouldNotify: boolean = true) {
  await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(list));
  if (shouldNotify) {
    notifyActivityChange();
  }
}
export async function addActivityItem(item: ActivityItem) {
  const list = await getActivity(); list.unshift(item); await setActivity(list);
}
export async function updateActivityItem(id: string, patch: Partial<ActivityItem>) {
  const list = await getActivity();
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = { ...prev, ...patch, meta: { ...(prev.meta || {}), ...(patch.meta || {}) } };
    await setActivity(list);
  }
}

// ✅ REMOVED: Demo data seeding - now only use database data
export async function clearAllLocalData() {
  await AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY);
  notifyActivityChange();
}

// ✅ NEW: Force refresh from database only
export async function forceRefreshFromDatabase(): Promise<ActivityItem[]> {
  // Only clear local data if we're forcing a refresh
  // This prevents unnecessary clearing on every load
  return await syncActivityFromServer();
}

type Where = { id?: string; assistId?: string | number | null };
export async function setActivityStatus(where: Where, status: ActivityItem["status"]) { /* keep yours */ }
export async function markActivityCanceled(where: Where) { /* keep yours */ }
export async function cancelMostRecentPending() { /* keep yours */ }

// ✅ NEW: remove helpers
export async function removeActivity(where: Where): Promise<boolean> {
  const list = await getActivity();
  const before = list.length;
  const next = list.filter(
    (i) =>
      !(
        (where.id && i.id === where.id) ||
        (where.assistId != null && String(i.meta?.assistId ?? "") === String(where.assistId))
      )
  );
  if (next.length === before) return false;
  await setActivity(next);
  return true;
}
export async function removeActivityByAssistId(assistId: string | number) { return removeActivity({ assistId }); }
export async function removeActivityById(id: string) { return removeActivity({ id }); }

// ✅ NEW: realtime binding to server delete events
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
      // Update status for existing items
      updateActivityItem(id, { status: status as ActivityItem["status"] });
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
