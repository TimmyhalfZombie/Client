// client/components/AssistSocketBridge.tsx
import { useEffect } from "react";
import { onAssistApproved, onAssistStatus } from "@/socket/socketEvents";
import { getActivity, setActivity } from "@/utils/activityStore";
import { ActivityItem } from "@/types";

/**
 * Mount once (RootLayout). Keeps Activity items in sync with server pushes:
 *  - assist:approved  -> status = accepted
 *  - assist:status    -> completed/cancelled/rejected mapping
 */
export default function AssistSocketBridge() {
  useEffect(() => {
    const handleApproved = async (evt: any) => {
      if (!evt?.success || !evt?.data?.id) return;

      const srvId = String(evt.data.id);
      const list = await getActivity();

      // Find by server id stored in meta.assistId
      const idx = list.findIndex(
        (i: ActivityItem) => String(i.meta?.assistId ?? "") === srvId
      );

      if (idx >= 0) {
        const current = list[idx];
        if (current) {
          list[idx] = { ...current, status: "accepted" };
          await setActivity(list);
        }
      } else {
        // Fallback: if no local item (e.g., app was restarted)
        const fallback: ActivityItem = {
          id: `assist_${srvId}`,
          title: "Request assistance",
          placeName: "—",
          createdAt: new Date().toISOString(),
          status: "accepted",
          meta: { assistId: srvId },
        };
        list.unshift(fallback);
        await setActivity(list);
      }
    };

    const handleStatus = async (evt: any) => {
      if (!evt?.success || !evt?.data?.id) return;

      const srvId = String(evt.data.id);
      const raw = String(evt.data.status || "").toLowerCase();

      const map: Record<string, ActivityItem["status"]> = {
        completed: "done",
        cancelled: "canceled",
        canceled: "canceled",
        rejected: "canceled",
        pending: "pending",
        accepted: "accepted",
      };
      const local: ActivityItem["status"] = map[raw] || "pending";

      const list = await getActivity();
      const idx = list.findIndex(
        (i: ActivityItem) => String(i.meta?.assistId ?? "") === srvId
      );

      if (idx >= 0) {
        const current = list[idx];
        if (current) {
          list[idx] = { ...current, status: local };
          await setActivity(list);
        }
      }
    };

    onAssistApproved(handleApproved);
    onAssistStatus(handleStatus);

    return () => {
      onAssistApproved(handleApproved, true);
      onAssistStatus(handleStatus, true);
    };
  }, []);

  return null;
}
