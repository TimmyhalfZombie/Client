// client/src/features/assistance/useInboxNotifications.ts
import React from 'react';
import { http } from '..//lib/http';
import { initNotifications, presentNow } from '../services/notificationService';

type InboxItem = {
  id: string;
  status?: string;
  clientName?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  location?: any;
  vehicle?: any;
  createdAt?: string | null;
};

const POLL_MS = 5000; // adjust as desired

export function useInboxNotifications(enabled = true) {
  const seen = React.useRef<Set<string>>(new Set());
  const primed = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await http.get('/api/assist/inbox?status=pending&limit=50', { auth: true });
        const items: InboxItem[] = Array.isArray(res?.items) ? res.items : [];

        const currentIds = new Set(items.map((i) => String(i.id)));
        if (!primed.current) {
          // First pass: learn existing IDs (no notifications)
          seen.current = currentIds;
          primed.current = true;
          return;
        }

        // Find new IDs
        const newOnes = items.filter((i) => !seen.current.has(String(i.id)));

        if (newOnes.length) {
          // Update seen first to avoid duplicates on fast updates
          newOnes.forEach((i) => seen.current.add(String(i.id)));

          // Coalesce many into one notice if there are lots
          if (newOnes.length > 3) {
            await presentNow({
              title: 'New assistance requests',
              body: `${newOnes.length} new pending requests in your inbox.`,
              data: { type: 'assist_list' },
            });
          } else {
            for (const r of newOnes) {
              const name =
                r.clientName ||
                r.customerName ||
                r.contactName ||
                'Customer';
              const loc =
                r?.location?.name ||
                r?.location?.address ||
                r?.vehicle?.model ||
                '';
              const body = loc ? `${name} • ${loc}` : `${name} sent a request`;
              await presentNow({
                title: 'New assistance request',
                body,
                data: { type: 'assist', requestId: r.id },
              });
            }
          }
        }
      } catch (e) {
        // silent fail; try again next tick
      }
    }

    (async () => {
      // Ask permission the first time user opens Activity tab
      await initNotifications();
      if (cancelled) return;
      // Do an immediate tick, then start polling
      await tick();
      if (cancelled) return;
      timer.current = setInterval(tick, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [enabled]);
}
