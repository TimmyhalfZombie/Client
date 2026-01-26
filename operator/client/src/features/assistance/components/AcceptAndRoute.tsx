// client/src/features/assistance/components/AcceptAndRoute.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import GeoapifyMap from '../../../components/GeoapifyMap';
import { acceptAssist, AssistanceRequest } from '../../api';
import RequestBottomCard from './RequestBottomCard';

type Props = {
  request: AssistanceRequest; // must include request.coords { lat, lng }
  onAccepted?: (conversationId?: string) => void;
  style?: any;
};

export default function AcceptAndRoute({ request, onAccepted, style }: Props) {
  const [accepted, setAccepted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const clientLat = toNum(request?.coords?.lat);
  const clientLng = toNum(request?.coords?.lng);

  const handleAccept = async () => {
    if (!request?.id || busy) return;
    setBusy(true);
    try {
      const { ok, conversationId } = await acceptAssist(String(request.id));
      if (ok) {
        setAccepted(true);
        onAccepted?.(conversationId);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.fill, style]}>
      {/* Map shows route only after Accept. We pass client lat/lng and showOperator=accepted */}
      <GeoapifyMap
        lat={clientLat ?? undefined}
        lng={clientLng ?? undefined}
        showOperator={accepted}
        disableAutoZoom={false}
      />

      <RequestBottomCard
        clientName={request.clientName || 'Customer'}
        placeName={request.placeName || request.address || 'Location'}
        address={request.address || ''}
        onAccept={handleAccept}
        onDecline={undefined}
        onMessage={undefined}
        absolute
        bottomOffset={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
