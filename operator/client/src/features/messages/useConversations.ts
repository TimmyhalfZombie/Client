import React from 'react';
import { ConversationPreview, listConversations } from './api';

export function useConversations() {
  const [items, setItems] = React.useState<ConversationPreview[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConversations(100);
      const mapped = data.map((item: any) => ({
        id: item.id,
        title: item.title || item.name || item?.peer?.name || 'Conversation',
        lastMessage: item.lastMessage || item.last_message || null,
        lastMessageAt: item.lastMessageAt || item.last_message_at || null,
        unread: item.unread ?? item.unreadCount ?? item.unread_count ?? null,
        requestId: item.requestId ?? item.request_id ?? null,
        avatarUrl: item.avatarUrl ?? item.peer?.avatarUrl ?? null,
      }));
      setItems(mapped as ConversationPreview[]);
      setError(null);
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return { items, loading, error, reload: load };
}
