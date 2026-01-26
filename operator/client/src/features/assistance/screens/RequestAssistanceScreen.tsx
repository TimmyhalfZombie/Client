import * as Location from 'expo-location';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import DeclineConfirmationModal from '../../../components/DeclineConfirmationModal';
import GeoapifyMap from '../../../components/GeoapifyMap';
import { useDeclinedRequests } from '../../../contexts/DeclinedRequestsContext';
import { updateMyLocationOnServer } from '../../../lib/operator.api';
import { acceptAssist } from '../../assistance/api'; // 🔹 use the updated accept
import useAcceptedJobUI from '../../useAcceptedJobUI';
import { useNextAssist } from '../../useNextRequest';
import RequestBottomCard from '../components/RequestBottomCard';

type LatLng = { lat: number; lng: number };

export default function RequestAssistanceScreen() {
  const { data, loading, error, reload } = useNextAssist();
  const { markAsDeclined } = useDeclinedRequests();
  const acceptedUI = useAcceptedJobUI();
  const [accepted, setAccepted] = React.useState(false);
  const [acceptedCoords, setAcceptedCoords] = React.useState<LatLng | undefined>(undefined);
  const [showDeclineModal, setShowDeclineModal] = React.useState(false);

  const completingRef = React.useRef(false);

  if (loading && !data && !accepted) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (error && !accepted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 8 }}>{error}</Text>
        <Text onPress={reload} style={{ color: '#9EF29E' }}>Retry</Text>
      </View>
    );
  }
  if (!data && !accepted) {
    return <View style={styles.center}><Text style={{ color: 'white' }}>No pending requests.</Text></View>;
  }

  const onAccept = async () => {
    if (!data) return;

    // optimistic local UI
    acceptedUI.openFromRequest(data, {
      onRepaired: async () => {
        if (completingRef.current) return;
        completingRef.current = true;
        try {
          // your existing repaired flow
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Failed to complete.');
        } finally {
          completingRef.current = false;
        }
      },
      onCancel: () => Alert.alert('Ended', 'Job ended.'),
      bottomOffset: 12,
    });
    setAccepted(true);
    setAcceptedCoords(data.coords);

    try {
      // Try to capture current coordinates and post to server before accept (await once)
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('loc-timeout')), 7000)),
          ]);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          // Await once to reduce race with first map poll
          await updateMyLocationOnServer({ lat, lng });
        }
      } catch {}

      // 🔹 Call accept and get the shared conversationId from the server
      const res = await acceptAssist(data.id);
      if (res?.ok && res?.conversationId) {
        // 🔹 Navigate operator into the shared chat room immediately
        const displayName = data.clientName || 'Client';
        router.push({ pathname: '/(tabs)/chat/[id]', params: { id: String(res.conversationId), name: displayName } });
      } else {
        // no conv id yet; UI remains accepted (can still Message via ensure endpoint)
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('no longer pending') && !msg.includes('already handled')) {
        Alert.alert('Error', e?.message ?? 'Failed');
        setAccepted(false);
      }
    }
  };

  const onDecline = async () => {
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = () => {
    setShowDeclineModal(false);
    if (data) markAsDeclined(data.id); // local-only
    router.back();
  };

  const handleDeclineCancel = () => setShowDeclineModal(false);

  const lat = data?.coords?.lat ?? acceptedCoords?.lat;
  const lng = data?.coords?.lng ?? acceptedCoords?.lng;

  return (
    <View style={styles.container}>
      <GeoapifyMap lat={lat} lng={lng} showOperator={accepted} />

      {!accepted && data && (
        <RequestBottomCard
          clientName={data.clientName}
          placeName={data.placeName}
          address={data.address}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      )}

      {acceptedUI.element}

      <DeclineConfirmationModal
        visible={showDeclineModal}
        onConfirm={handleDeclineConfirm}
        onCancel={handleDeclineCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' },
});
