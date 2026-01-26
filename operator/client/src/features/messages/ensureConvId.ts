// Resolve/ensure a conversation id using the client app's socket API
import { tokens } from '../../auth/tokenStore';
import { ensureConversation } from './api';

async function getMyUserId(): Promise<string | null> {
  try {
    const id = await tokens.getUserIdAsync?.();
    if (id) return String(id);
  } catch {}
  // Fallback: decode JWT if your tokenStore doesn’t expose getUserIdAsync
  try {
    const t = tokens.getAccess?.();
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload?.user?.id ?? payload?.id ?? payload?.sub ?? '');
  } catch {}
  return null;
}

/**
 * If you arrive with a placeholder or missing conversation id, create/lookup a
 * direct conversation with the peer using `newConversation`.
 */
export async function ensureConversationId(currentId?: string, opts?: { peerUserId?: string; requestId?: string }): Promise<string | undefined> {
  const cid = (currentId || '').trim();
  if (cid && cid !== 'new') return cid;

  const peer = (opts?.peerUserId || '').trim();
  if (!peer) return undefined;

  const me = await getMyUserId();
  if (!me) return undefined;

  const { id } = await ensureConversation(peer, me, { requestId: opts?.requestId });
  return id;
}
