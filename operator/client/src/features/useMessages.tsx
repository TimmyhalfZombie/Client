import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

export type Message = {
  _id: string;
  name: string;
  preview: string;
  time: string;
  unread?: boolean;
};

export function useMessages() {
  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet<{ items: Message[] }>('/api/messages');
        if (mounted) setData(res.items);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load messages');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}