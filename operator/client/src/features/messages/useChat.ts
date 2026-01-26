import React from 'react';
import { SocketContext } from '../../contexts/SocketProvider';
import { ChatMessage, fetchMessages, sendMessage } from './api';

// Normalize to ChatMessage using the client app server shape
function normalize(raw: any): ChatMessage | null {
  if (!raw) return null;
  // server broadcast: { success, data: { _id, content, createdAt, conversationId, senderId:{_id,...} } }
  const d = raw?.data ?? raw;
  const id = String(d?._id ?? d?.id ?? '');
  const conversationId = String(d?.conversationId ?? '');
  const from = String(d?.senderId?._id ?? d?.from ?? '');
  const text = String(d?.content ?? d?.text ?? '');
  const createdAt = String(d?.createdAt ?? new Date().toISOString());
  if (!conversationId || !from || (!text && !id)) return null;
  return { id: id || `${conversationId}:${createdAt}:${from}`, conversationId, from, text, createdAt };
}

function byTimeAsc(a: ChatMessage, b: ChatMessage) {
  return +new Date(a.createdAt) - +new Date(b.createdAt);
}

/**
 * useChat (aligned to the client app server)
 */
export function useChat(conversationId?: string, meId: string = 'me') {
  const { socket } = React.useContext(SocketContext);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const seenIds = React.useRef<Set<string>>(new Set());

  // Initial history
  React.useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const hist = await fetchMessages(conversationId);
        if (!alive) return;
        const list = hist.map((m) => ({ ...m, pending: false }));
        list.forEach((m) => seenIds.current.add(String(m.id)));
        setMessages(list.sort(byTimeAsc));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      setMessages([]);
      seenIds.current.clear();
    };
  }, [conversationId]);

  // Realtime socket wiring (listen to client server events)
  React.useEffect(() => {
    if (!socket || !conversationId) return;

    const upsert = (raw: any) => {
      // raw format is { success, data }
      const m = normalize(raw);
      if (!m || m.conversationId !== conversationId) return;
      if (seenIds.current.has(String(m.id))) return;

      setMessages((prev) => {
        // replace optimistic if text+from match
        const idx = prev.findIndex((x) => x.pending && x.text === m.text && (x.from === m.from || x.from === 'me'));
        const next = prev.slice();
        if (idx >= 0) next[idx] = { ...m, pending: false };
        else next.push({ ...m, pending: false });
        seenIds.current.add(String(m.id));
        return next.sort(byTimeAsc);
      });
    };

    socket.on('newMessage', upsert); // broadcast from client app server

    return () => {
      socket.off('newMessage', upsert);
    };
  }, [socket, conversationId]);

  const send = React.useCallback(
    async (text: string) => {
      const t = text?.trim();
      if (!t) return;

      // optimistic bubble
      const optimistic = await sendMessage(conversationId!, t);
      setMessages((prev) => [...prev, optimistic].sort(byTimeAsc));
    },
    [conversationId]
  );

  // Typing indicators are not part of the client app server contract; no-ops here.
  const setIsTyping = React.useCallback((_flag: boolean) => {}, []);

  return { messages, loading, typing: [], send, setIsTyping };
}
