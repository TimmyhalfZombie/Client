import { tokens } from '../../auth/tokenStore';
import { api } from '../../lib/http';
import { AssistanceRequest } from './types';

function toLatLng(loc?: { coordinates?: [number, number] | number[] }) {
  const c = loc?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return undefined;
  const [lng, lat] = c;
  if (!Number.isFinite(lat as any) || !Number.isFinite(lng as any)) return undefined;
  return { lat: Number(lat), lng: Number(lng) };
}

function normalize(raw: any): AssistanceRequest {
  if (!raw) return raw;

  const address = raw?.address ?? raw?.location?.address ?? '';

  return {
    id: raw?.id ?? raw?._id,
    status: raw?.status,

    clientName: raw?.clientName ?? raw?.customerName ?? 'Customer',
    phone: raw?.phone ?? raw?.customerPhone ?? undefined,

    placeName: raw?.placeName ?? address,
    address,
    coords: raw?.coords ?? toLatLng(raw?.location) ?? null,

    vehicleType: raw?.vehicleType ?? raw?.vehicle?.model ?? undefined,
    plateNumber: raw?.plateNumber ?? raw?.vehicle?.plate ?? undefined,
    otherInfo: raw?.otherInfo ?? raw?.vehicle?.notes ?? undefined,

    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,

    // User information
    userId: raw?.userId,
    user: raw?.user,

    // Preserve full objects for consumers that need them
    location: raw?.location,
    vehicle: raw?.vehicle,

    _raw: raw,
  };
}

/** Get newest pending request for the operator. */
export async function fetchNextAssist(): Promise<AssistanceRequest | null> {
  try {
    const myId = await tokens.getUserIdAsync();
    if (myId) {
      const accepted = await fetchAssistInbox({ status: 'accepted', limit: 100 });
      const hasMyAccepted = Array.isArray(accepted)
        ? accepted.some((item) => {
            const owner = item.assignedTo || item.acceptedBy || item.operator?.id;
            return owner ? String(owner) === String(myId) : false;
          })
        : false;
      if (hasMyAccepted) {
        return null;
      }
    }
  } catch (err) {
    // If inbox fetch fails, continue and let /next handle errors
    console.warn('[assist] fetchNextAssist: failed to check accepted requests', (err as Error)?.message ?? err);
  }

  const res = await api('/api/assist/next', { method: 'GET', auth: true });
  const body = (res && (res as any).data !== undefined ? (res as any).data : res) as any;
  const raw = body && body.data !== undefined ? body.data : body;
  if (!raw) return null;
  return normalize(raw);
}

/** Shape we expect back from accept (supports both old/new wrappers). */
export type AcceptAssistResponse = {
  ok: boolean;
  conversationId?: string;
  autoMessageSent?: boolean;
};

/** Accept a specific request by id. Returns { ok, conversationId }. */
export async function acceptAssist(id: string): Promise<AcceptAssistResponse> {
  try {
    const res = await api(`/api/assist/${id}/accept`, { method: 'POST', auth: true });

    // Normalize wrapper shapes:
    const body = (res && (res as any).data !== undefined ? (res as any).data : res) as any;

    // Server returns { ok: true, conversationId?: string }
    const ok = Boolean(body?.ok ?? body?.success ?? true); // default to true if server omitted ok
    const conversationId = body?.conversationId ?? undefined;
    const autoMessageSent = body?.autoMessageSent ?? undefined;

    return { ok, conversationId, autoMessageSent };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/not\s*pending|not\s*found|404|409/i.test(msg)) {
      throw new Error('This request is no longer pending (already handled).');
    }
    throw e;
  }
}

/** Decline a specific request by id. */
export async function declineAssist(id: string): Promise<void> {
  await api(`/api/assist/${id}/decline`, { method: 'POST', auth: true });
}

/** List requests for Activity (recent/inbox feed). */
export async function fetchAssistInbox(params: { status?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  const res = await api(`/api/assist/inbox?${q.toString()}`, { method: 'GET', auth: true });
  const items = (res?.items ?? res?.data?.items ?? []) as any[];
  return items.map(normalize);
}

/**
 * Mark a request as completed (used when operator taps "Repaired").
 * If the server replies 404 (already completed), return minimal payload so UI can proceed.
 */
export async function completeAssist(
  id: string,
  rating?: number
): Promise<{
  id: string;
  status: string;
  completedAt?: string;
  clientName?: string;
  phone?: string;
  placeName?: string;
  address?: string;
  vehicleType?: string;
  plateNumber?: string;
  otherInfo?: string;
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  rating?: number | null;
}> {
  try {
    const res = await api(`/api/assist/${id}/complete`, {
      method: 'POST',
      auth: true,
      body: rating === undefined ? {} : { rating },
    });
    return (res?.data ?? res) as any;
  } catch (e: any) {
    const status = e?.status ?? 0;
    const msg = String(e?.message || '');
    if (status === 404 && /not\s*found/i.test(msg)) {
      return { id, status: 'completed' };
    }
    throw e;
  }
}

/** Fetch a single request by id (used for Activity detail screen). */
export async function getAssistById(id: string): Promise<AssistanceRequest> {
  const res = await api(`/api/assist/${id}`, { method: 'GET', auth: true });
  const raw = (res?.data ?? res) as any;
  return normalize(raw);
}

/** Optional: Try to fetch an "activity" by id using common endpoints (if your server exposes them). */
export async function getActivityById(id: string): Promise<any | null> {
  const paths = [
    `/api/activities/${id}`,
    `/api/activity/${id}`,
    `/api/assist/activity/${id}`,
  ];

  for (const p of paths) {
    try {
      const res = await api(p, { method: 'GET', auth: true });
      const data = (res?.data ?? res) as any;
      if (data) return data;
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      if (status === 404) continue;
      throw e;
    }
  }
  return null;
}

/** FINAL fallback: scan inbox for a matching id in any common field (including _raw). */
async function findAssistInInboxByAnyId(anyId: string): Promise<AssistanceRequest | null> {
  const items = await fetchAssistInbox({ limit: 200 }).catch(() => []);
  const target = String(anyId).toLowerCase();

  const normalizeCands = (vals: any[]) =>
    vals.filter(Boolean).map((x: any) => String(x).toLowerCase());

  const hasMatch = (it: any) => {
    const r = it?._raw ?? {};
    const cands = normalizeCands([
      // normalized fields
      it?.id, it?._id, it?.requestId, it?.assistId, it?.assistanceId,
      it?.request?.id, it?.request?._id,
      // raw fields (server may only include on raw)
      r?.id, r?._id, r?.requestId, r?.assistId, r?.assistanceId,
      r?.request?.id, r?.request?._id,
      r?.activityId, r?.activity?.id,
    ]);
    return cands.includes(target);
  };

  const hit = (items as any[]).find(hasMatch);
  return hit || null;
}

/**
 * Resolve either a request id or an activity id into the request document.
 * 1) Try the id as a request id
 * 2) Try activity endpoints and extract request id
 * 3) Scan inbox for any matching id in normalized or _raw shapes
 */
export async function getAssistByAnyId(anyId: string): Promise<AssistanceRequest | null> {
  try {
    const req = await getAssistById(anyId);
    if (req) return req;
  } catch {
    // not a direct request id — continue
  }

  const act = await getActivityById(anyId);
  const reqId =
    act?.requestId ??
    act?.assistId ??
    act?.assistanceId ??
    act?.request?.id ??
    act?.request?._id ??
    null;

  if (reqId) {
    try {
      return await getAssistById(String(reqId));
    } catch {
      // fall through to inbox
    }
  }

  // last resort
  const viaInbox = await findAssistInInboxByAnyId(anyId);
  return viaInbox;
}
