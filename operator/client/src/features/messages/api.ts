// client/src/features/messages/api.ts
// OPERATOR APP — socket-first API that uses acks (no more silent timeouts)
import { api } from '../../lib/http';
import { emitWithAck } from '../../lib/socket';

/* ---------------- types ---------------- */
export type ConversationPreview = {
  id: string;
  title?: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unread?: number | null;
  requestId?: string | null;
  avatarUrl?: string | null;
};

export type ConversationDetail = ConversationPreview & {
  participants?: string[];
  peer?: {
    id: string;
    username?: string;
    phone?: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
  } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  from: string;
  text: string;
  createdAt: string;
  attachment?: string | null;
  pending?: boolean;
  failed?: boolean;
};

/* ---------------- helpers ---------------- */
function toId(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}

function cleanMessageText(val: any): string {
  const collapsed = String(val ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
  const lower = collapsed.toLowerCase();
  if (lower === '[photo]' || lower === '[attachment]') return '';
  if (!collapsed) return '';
  const tokens = collapsed.split(' ');
  if (tokens.length > 1 && tokens.every((tok) => tok.length === 1)) {
    return tokens.join('');
  }
  return collapsed;
}

function extractPreviewText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.toLowerCase() === '[attachment]' || trimmed.toLowerCase() === '[photo]') {
      return 'Photo';
    }
    return cleanMessageText(raw);
  }
  if (typeof raw === 'object') {
    const content = raw?.content ?? raw?.text ?? raw?.message ?? '';
    const cleaned = cleanMessageText(content);
    if (cleaned) return cleaned;
    if (raw?.attachment || raw?.imageUri || raw?.image_uri || raw?.mediaUrl || raw?.media_url) {
      return 'Photo';
    }
  }
  return '';
}

function normalizeMsg(raw: any): ChatMessage {
  const rawContent = raw?.content ?? raw?.text ?? '';
  const cleanedContent = cleanMessageText(rawContent);
  const hasCleanContent = typeof cleanedContent === 'string' && cleanedContent.length > 0;
  const fallbackText = hasCleanContent
    ? cleanedContent
    : raw?.attachment
      ? '[attachment]'
      : '';

  return {
    id: toId(raw?._id ?? raw?.id),
    conversationId: toId(
      raw?.conversationId ??
        raw?.conversation_id ??
        raw?.conversation?.id ??
        raw?.conversation?._id
    ),
    from: toId(
      raw?.senderId?._id ??
        raw?.senderId ??
        raw?.sender?._id ??
        raw?.sender ??
        raw?.from
    ),
    text: fallbackText,
    createdAt: new Date(
      raw?.createdAt ??
        raw?.created_at ??
        raw?.timestamp ??
        Date.now()
    ).toISOString(),
    attachment:
      raw?.attachment ??
      raw?.imageUri ??
      raw?.image_uri ??
      raw?.mediaUrl ??
      raw?.media_url ??
      null,
  };
}
function normalizeMsgList(items: any[]): ChatMessage[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeMsg);
}

/* ---------------- conversations ---------------- */

/** Ensure a direct conversation between exactly two participants. */
export async function ensureConversation(
  peerUserId: string,
  meUserId?: string,
  options: { requestId?: string } = {}
): Promise<{ id: string }> {
  const participants = Array.from(
    new Set(
      [peerUserId, meUserId]
        .filter(Boolean)
        .map((p) => String(p))
    )
  ).sort();

  let ackError: any = null;
  if (participants.length >= 2) {
    try {
      const res: any = await emitWithAck('newConversation', {
        type: 'direct',
        participants,
        name: '',
      });

      if (res?.success && res?.data?._id) {
        return { id: String(res.data._id) };
      }
      ackError = res?.msg || 'failed_to_ensure_conversation';
    } catch (err) {
      ackError = err;
    }
  }

  try {
    const body = await api('/api/conversations/ensure', {
      method: 'POST',
      auth: true,
      body: {
        peerUserId: String(peerUserId),
        requestId: options.requestId ? String(options.requestId) : undefined,
      },
    });
    const id = body?.id ?? body?.data?.id;
    if (id) return { id: String(id) };
  } catch (restErr) {
    ackError = ackError ?? restErr;
  }

  throw new Error(
    typeof ackError === 'string'
      ? ackError
      : ackError?.message || 'failed_to_ensure_conversation'
  );
}

/** List conversations for the current user (ack-based). */
export async function listConversations(limit = 50): Promise<ConversationPreview[]> {
  let rows: any[] | null = null;
  try {
    const res: any = await emitWithAck('getConversations');
    if (res?.success && Array.isArray(res?.data)) {
      rows = res.data;
    }
  } catch {}

  if (!rows) {
    try {
      const rest = await api(`/api/conversations?limit=${limit}`, { method: 'GET', auth: true });
      const raw = (rest?.items ?? rest?.data?.items ?? rest?.data ?? rest) as any;
      if (Array.isArray(raw)) rows = raw;
    } catch {}
  }

  if (!rows) return [];

  return rows.slice(0, limit).map((c: any) => {
    const id = toId(c?._id ?? c?.id);
    const rawLast = c?.lastMessage ?? c?.last_message ?? null;
    const last = extractPreviewText(rawLast) || extractPreviewText(rawLast?.content) || extractPreviewText(c?.lastMessage?.content);
    const lastCreatedAt =
      c?.lastMessageAt ??
      c?.last_message_at ??
      (typeof c?.lastMessage === 'object' ? c.lastMessage?.createdAt ?? c.lastMessage?.created_at : null) ??
      (typeof c?.last_message === 'object' ? c.last_message?.createdAt ?? c.last_message?.created_at : null);
    return {
      id,
      title: String(c?.title || c?.name || 'Conversation'),
      lastMessage: last ? String(last) : null,
      lastMessageAt: lastCreatedAt ? new Date(lastCreatedAt).toISOString() : null,
      unread: typeof c?.unreadCount === 'number'
        ? c.unreadCount
        : typeof c?.unread_count === 'number'
          ? c.unread_count
          : typeof c?.unread === 'number'
            ? c.unread
            : null,
      requestId: c?.requestId ? String(c.requestId) : c?.request_id ? String(c.request_id) : null,
      avatarUrl: c?.peer?.avatarUrl ?? c?.peer?.avatar ?? null,
    } as ConversationPreview;
  });
}

/** Alias to avoid singular import bugs */
export const listConversation = listConversations;

/** Minimal conversation detail (ack-based). */
export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const res: any = await emitWithAck('verifyConversationParticipants', String(conversationId));
  if (!res?.success) {
    return { id: String(conversationId), title: 'Conversation' };
  }

  const participants: any[] = Array.isArray(res?.data?.participants) ? res.data.participants : [];
  const me = String(res?.data?.currentUser ?? '');
  const others = participants.filter((p: any) => String(p?._id) !== me);
  const peer = others[0];

  return {
    id: String(conversationId),
    title: String(peer?.name || 'Conversation'),
    participants: participants.map((p: any) => String(p?._id)).filter(Boolean),
    peer: peer
      ? {
          id: String(peer._id),
          name: peer.name || undefined,
          email: peer.email || undefined,
          avatarUrl: (peer as any).avatar || null,
        }
      : null,
  };
}

/* ---------------- messages ---------------- */

export async function fetchMessages(
  conversationId: string,
  limit = 50
): Promise<ChatMessage[]> {
  let rows: any[] | null = null;
  try {
    const res: any = await emitWithAck('getMessages', String(conversationId));
    if (res?.success && Array.isArray(res?.data)) {
      rows = res.data;
    }
  } catch {}

  if (!rows) {
    try {
      const rest = await api(`/api/conversations/${conversationId}/messages?limit=${limit}`, { method: 'GET', auth: true });
      const data = rest?.items ?? rest?.data?.items ?? rest?.data ?? rest;
      if (Array.isArray(data)) rows = data;
    } catch {}
  }

  if (!rows) return [];

  return rows
    .slice(0, limit)
    .map((raw) => normalizeMsg(raw))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function sendMessage(
  conversationId: string,
  text: string,
  myId?: string,
  attachment?: string | null
): Promise<ChatMessage> {
  const payload = {
    conversationId: String(conversationId),
    content: cleanMessageText(text),
    attachment: attachment ? String(attachment) : undefined,
  };

  try {
    const ack: any = await emitWithAck('newMessage', payload, 6000);
    if (ack?.success && ack?.data) {
      return normalizeMsg(ack.data);
    }
  } catch {}

  // fallback optimistic message
  return {
    id: `tmp_${Math.random().toString(36).slice(2, 8)}`,
    conversationId: String(conversationId),
    from: myId ?? 'me',
    text: cleanMessageText(payload.content),
    attachment: attachment ?? null,
    createdAt: new Date().toISOString(),
    pending: true,
  };
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await api(`/api/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await api(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
    auth: true,
  });
}
