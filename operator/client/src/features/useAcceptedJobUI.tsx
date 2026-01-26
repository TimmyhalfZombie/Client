// client/src/features/useAcceptedJobUI.tsx
import { router } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';
import AcceptedRequestCard from '../components/AcceptedRequestCard';
import { completeAssist, getAssistById } from '../features/assistance/api';
import type { AssistanceRequest } from '../features/assistance/types';
import { saveCompleted } from '../lib/completedCache';
import { usePostMyLocationOnInterval } from './location/useServerMyLocation';

export type AcceptedJob = {
  id: string;
  clientName: string;
  placeName: string;
  address: string;
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
  onRepaired?: () => void;
  onCancel?: () => void;
  bottomOffset?: number;
};

type State = { visible: boolean; job: AcceptedJob | null };

export default function useAcceptedJobUI(defaultBottomOffset = 12) {
  const [state, setState] = React.useState<State>({ visible: false, job: null });

  const open = React.useCallback((job: AcceptedJob) => {
    setState({ visible: true, job });
  }, []);

  const openFromRequest = React.useCallback(
    (
      req: AssistanceRequest,
      extras?: Pick<AcceptedJob, 'onRepaired' | 'onCancel' | 'bottomOffset'>
    ) => {
      if (!req) return;
      open({
        id: req.id,
        clientName: req.clientName,
        placeName: req.placeName,
        address: req.address,
        vehicleType: req.vehicleType ?? undefined,
        plateNumber: req.plateNumber ?? undefined,
        phone: req.phone ?? undefined,
        otherInfo: req.otherInfo ?? undefined,
        onRepaired: extras?.onRepaired,
        onCancel: extras?.onCancel,
        bottomOffset: extras?.bottomOffset,
      });
    },
    [open]
  );

  const close = React.useCallback(() => setState({ visible: false, job: null }), []);

  // 🔴 Start posting my GPS while the accepted job UI is visible
  usePostMyLocationOnInterval(state.visible, 5000);

  async function handleRepaired() {
    try {
      if (!state.job) return;
      const j = state.job;
      close();

      const completed = await completeAssist(j.id);
      const detailId = completed?.id || j.id;

      try {
        const fresh = await getAssistById(detailId);
        await saveCompleted({
          id: fresh.id,
          status: fresh.status,
          clientName: fresh.clientName,
          customerName: (fresh as any)?.customerName,
          customerPhone: (fresh as any)?.customerPhone,
          phone: fresh.phone,
          placeName: fresh.placeName,
          address: fresh.address,
          vehicle: fresh.vehicle ?? (fresh.vehicleType ? { model: fresh.vehicleType, plate: fresh.plateNumber } : undefined),
          vehicleType: fresh.vehicleType,
          plateNumber: fresh.plateNumber,
          otherInfo: fresh.otherInfo,
          location: (fresh as any)?.location,
          createdAt: fresh.createdAt,
          updatedAt: fresh.updatedAt,
          completedAt: (fresh as any)?.completedAt,
          operator: (fresh as any)?.operator,
          rating: (fresh as any)?.rating ?? (fresh as any)?._raw?.rating ?? null,
          _raw: (fresh as any)?._raw,
        });
      } catch {}

      router.push(`/activity-detail?id=${encodeURIComponent(String(detailId))}`);
      j.onRepaired?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to complete request');
    }
  }

  const element =
    state.visible && state.job ? (
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
        <AcceptedRequestCard
          clientName={state.job.clientName}
          placeName={state.job.placeName}
          address={state.job.address}
          vehicleType={state.job.vehicleType}
          plateNumber={state.job.plateNumber}
          phone={state.job.phone}
          otherInfo={state.job.otherInfo}
          onMessage={() => {}}
          onRepaired={handleRepaired}
          onCancelPress={() => {
            state.job?.onCancel?.();
            close();
          }}
          absolute
          bottomOffset={state.job.bottomOffset ?? defaultBottomOffset}
        />
      </View>
    ) : null;

  return { element, open, openFromRequest, close, visible: state.visible };
}
