import * as ExpoLocation from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AcceptedRequestCard from '../../../components/AcceptedRequestCard';
import MapLibreRouteMap from '../../navigation/RouteMap';
import { fetchRoute } from '../../navigation/api';


type Params = {
  clientLat?: string;
  clientLng?: string;
  clientName?: string;
  placeName?: string;
  address?: string;
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
};

type LatLng = { lat: number; lng: number };

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function RoutePreviewScreen() {
  const {
    clientLat, clientLng,
    clientName, placeName, address,
    vehicleType, plateNumber, phone, otherInfo,
  } = useLocalSearchParams<Params>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [from, setFrom] = useState<LatLng | null>(null);
  const [to,   setTo]   = useState<LatLng | null>(null);
  const [line, setLine] = useState<LatLng[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Operator = device GPS (never from server)
        const perm = await ExpoLocation.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') throw new Error('Location permission denied');
        const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const operator: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        const latParam = num(clientLat);
        const lngParam = num(clientLng);
        const client: LatLng =
          latParam !== null && lngParam !== null ? { lat: latParam, lng: lngParam } : operator;

        if (!mounted) return;
        setFrom(operator);
        setTo(client);

        try {
          const r = await fetchRoute(operator, client, 'drive');
          if (mounted && r?.points) setLine(r.points);
        } catch {}
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load route');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientLat, clientLng]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  if (err || !from || !to) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={{ color: '#fff' }}>{err || 'No route available'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapLibreRouteMap from={from} to={to} line={line} style={StyleSheet.absoluteFillObject} />
      <AcceptedRequestCard
        clientName={clientName || 'Customer'}
        placeName={placeName || 'Destination'}
        address={address || ''}
        vehicleType={vehicleType}
        plateNumber={plateNumber}
        phone={phone}
        otherInfo={otherInfo}
        onRepaired={() => {}}
        onCancelPress={() => {}}
        absolute
        bottomOffset={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loaderWrap: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
