// hooks/useOperatorForAssist.ts
import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/socket/socket";
import assistService from "@/services/assistService";
import { updateActivityItem } from "@/utils/activityStore";

type OpLocation = { lat: number; lng: number; address?: string | null };
type Operator = { id?: string; name?: string; avatar?: string | null; phone?: string | null };

type OpState = {
  loading: boolean;
  operator?: Operator;
  location?: OpLocation;
};

export function useOperatorForAssist(assistId?: string | null) {
  const [state, setState] = useState<OpState>({ loading: true });

  // Fetch once (details) + bind socket updates
  useEffect(() => {
    let mounted = true;
    if (!assistId) {
      setState({ loading: false });
      return;
    }

    (async () => {
      try {
        // Try a details endpoint; otherwise fall back to a generic fetch-by-id.
        // Shape tolerated: { assignedTo, operator, lastKnownLocation }
        const details: any =
          (await (assistService as any).getAssistDetails?.(assistId)) ??
          (await (assistService as any).fetchAssistRequestById?.(assistId)) ??
          null;

        const operator: Operator =
          details?.assignedTo ?? details?.operator ?? undefined;

        const location: OpLocation | undefined =
          details?.lastKnownLocation ??
          (details?.operator && details.operator.lastKnownLocation) ??
          undefined;

        if (!mounted) return;
        setState((s) => ({ ...s, operator, location, loading: false }));

        // Seed activityStore meta (so Activity screens can read it too)
        await updateActivityItem(assistId, {
          meta: { operator, operatorLocation: location },
        });
      } catch {
        if (mounted) setState({ loading: false });
      }
    })();

    const socket = getSocket();
    const onOpLoc = (evt: any) => {
      // Expect: { success, data: { assistId, operator, location:{ lat,lng,address? } } }
      if (!evt?.success || !evt?.data) return;
      const aId = String(evt.data.assistId || evt.data.id || "");
      if (!aId || aId !== String(assistId)) return;

      const operator: Operator | undefined = evt.data.operator ?? undefined;
      const location: OpLocation | undefined = evt.data.location ?? undefined;

      setState((s) => ({
        loading: false,
        operator: operator ?? s.operator,
        location: location ?? s.location,
      }));

      // Keep store in sync
      updateActivityItem(aId, {
        meta: { operator: operator ?? undefined, operatorLocation: location ?? undefined },
      }).catch(() => {});
    };

    // Some backends push location on a generic status event as well
    const onAssistStatus = (evt: any) => {
      // Expect: { data:{ id/status, operator?, location? } }
      if (!evt?.success || !evt?.data) return;
      const aId = String(evt.data.assistId || evt.data.id || "");
      if (!aId || aId !== String(assistId)) return;

      const operator: Operator | undefined = evt.data.operator ?? undefined;
      const location: OpLocation | undefined = evt.data.location ?? undefined;
      if (!operator && !location) return;

      setState((s) => ({
        loading: false,
        operator: operator ?? s.operator,
        location: location ?? s.location,
      }));

      updateActivityItem(aId, {
        meta: { operator: operator ?? undefined, operatorLocation: location ?? undefined },
      }).catch(() => {});
    };

    socket?.on?.("operator:location", onOpLoc);
    socket?.on?.("assist:status", onAssistStatus);

    return () => {
      mounted = false;
      socket?.off?.("operator:location", onOpLoc);
      socket?.off?.("assist:status", onAssistStatus);
    };
  }, [assistId]);

  const name = useMemo(() => state.operator?.name ?? "Operator", [state.operator]);
  const address = useMemo(() => state.location?.address ?? null, [state.location]);

  return {
    loading: state.loading,
    operator: state.operator,
    location: state.location,
    name,
    address,
  };
}
