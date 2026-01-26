// client/src/lib/completedCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CompletedDoc = {
  id: string;
  status?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  placeName?: string;
  address?: string;
  vehicle?: { model?: string; plate?: string } | null;
  vehicleType?: string;
  plateNumber?: string;
  otherInfo?: string;
  location?: { address?: string; coordinates?: number[] } | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  operator?: {
    name?: string;
    location?: string;
    initial_address?: string;
    lastSeen?: string;
    acceptedAt?: string;
  };
  rating?: number | null;
  _raw?: any;
};

const MEM = new Map<string, CompletedDoc>();
const k = (id: string) => `completed:${id}`;

export async function saveCompleted(doc: CompletedDoc) {
  if (!doc?.id) return;
  MEM.set(doc.id, doc);
  try {
    await AsyncStorage.setItem(k(doc.id), JSON.stringify(doc));
  } catch {}
}

export async function getCompleted(id: string): Promise<CompletedDoc | null> {
  if (!id) return null;
  const m = MEM.get(id);
  if (m) return m;
  try {
    const txt = await AsyncStorage.getItem(k(id));
    if (txt) {
      const parsed = JSON.parse(txt);
      MEM.set(id, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

// Try a variety of common id shapes; use whatever hits the cache first
export async function getCompletedByAnyId(anyId: string): Promise<CompletedDoc | null> {
  if (!anyId) return null;
  // direct
  const direct = await getCompleted(anyId);
  if (direct) return direct;

  // Some apps prefix/suffix ids—try basic sanitized lookup
  const alt = String(anyId).trim();
  if (alt !== anyId) {
    const s = await getCompleted(alt);
    if (s) return s;
  }

  return null;
}
