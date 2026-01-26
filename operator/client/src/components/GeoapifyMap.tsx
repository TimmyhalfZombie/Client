// client/src/components/GeoapifyMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as ExpoLocation from 'expo-location';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { http } from '../lib/http';
import type { OrsRouteResponse } from '../lib/routing';
import { getRouteORS, toFeatureCollection } from '../lib/routing';
import UserPin from './ClientPin';
import OperatorPin from './OperatorPin';

type Props = {
  /** Client/customer latitude (blue dot) */
  lat?: number | null;
  /** Client/customer longitude (blue dot) */
  lng?: number | null;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  /** Show operator pin and route only once accepted */
  showOperator?: boolean;
  /** Skip auto-zoom if true */
  disableAutoZoom?: boolean;
  /** Use device GPS instead of fetching from the server */
  autoUseDeviceLocation?: boolean;
};

type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

MapLibreGL.setAccessToken(null);

export default function GeoapifyMap({
  lat,
  lng,
  zoom = 16,
  style,
  showOperator = true,
  disableAutoZoom = false,
  autoUseDeviceLocation,
}: Props) {
  const clientOk = isNum(lat) && isNum(lng);
  const clientCenter: [number, number] = [lng ?? 0, lat ?? 0];

  const [mapReady, setMapReady] = React.useState(false);
  const [op, setOp] = React.useState<OperatorLocation | null>(null);
  const [routeFC, setRouteFC] = React.useState<any | null>(null);

  const shouldUseDeviceGps = autoUseDeviceLocation ?? showOperator;

async function getOsrmFallback(from: [number, number], to: [number, number]): Promise<OrsRouteResponse | null> {
  try {
    const params = new URLSearchParams({
      from: `${from[0]},${from[1]}`,
      to: `${to[0]},${to[1]}`,
      mode: 'drive',
    });
    const data = await http.get(`/api/geo/route?${params.toString()}`);
    const coords: [number, number][] | undefined = data?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const fc: OrsRouteResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              source: 'osrm',
            },
          },
        ],
      };
      return fc;
    }
  } catch (e) {
    console.warn?.('OSRM fallback failed', e);
  }
  return null;
}

  const camRef = React.useRef<React.ComponentRef<typeof MapLibreGL.Camera>>(null);
  const userHasTakenControl = React.useRef(false);
  const lastAutoCentered = React.useRef<string | null>(null);
  const autoZoomRetryRef = React.useRef(0);

  const onRegionWillChange = React.useCallback((e: any) => {
    const p = e?.nativeEvent?.properties ?? e?.properties ?? {};
    const byUser = p?.gesture || p?.isUserInteraction || p?.manualGesture;
    if (byUser) userHasTakenControl.current = true;
  }, []);

  // Subscribe to device GPS when requested (operator device)
  React.useEffect(() => {
    let cancelled = false;
    let subscription: ExpoLocation.LocationSubscription | null = null;

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    async function start() {
      if (!showOperator || !shouldUseDeviceGps) {
        setOp(null);
        return;
      }

      try {
        const perm = await ExpoLocation.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setOp(null);
          return;
        }

        const seed = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        if (!cancelled) {
          setOp({
            lat: seed.coords.latitude,
            lng: seed.coords.longitude,
            updated_at: new Date(seed.timestamp).toISOString(),
          });
        }

        subscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.BestForNavigation,
            distanceInterval: 0,
            timeInterval: 250,
          },
          (position) => {
            if (cancelled) return;
            setOp({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              updated_at: new Date(position.timestamp).toISOString(),
            });
          }
        );
      } catch {
        if (!cancelled) setOp(null);
      }
    }

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [showOperator, shouldUseDeviceGps]);

  // Route overlay when both ends exist (operator -> client blue dot)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientOk || !op || !showOperator) {
        if (!cancelled) setRouteFC(null);
        return;
      }
      // ORS expects [lng,lat]
      const route = await getRouteORS(
        [
          [op.lng, op.lat],
          [clientCenter[0], clientCenter[1]],
        ],
        'driving-car'
      );
      if (cancelled) return;

      let fc = toFeatureCollection(route);

      if (!fc) {
        fc = await getOsrmFallback(
          [op.lng, op.lat],
          [clientCenter[0], clientCenter[1]]
        );
        if (cancelled) return;
      }

      if (!fc) {
        const straightLine: OrsRouteResponse = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [op.lng, op.lat],
                  [clientCenter[0], clientCenter[1]],
                ],
              },
              properties: {
                source: 'straight-line',
              },
            },
          ],
        };
        fc = straightLine;
      }

      if (!cancelled) setRouteFC(fc);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientOk, op?.lat, op?.lng, clientCenter[0], clientCenter[1]]);

  // One-time auto-zoom / fit-bounds
  React.useEffect(() => {
    if (disableAutoZoom) return;
    if (!mapReady || !clientOk) return;
    const key =
      showOperator && op && isNum(op.lat) && isNum(op.lng)
        ? `${clientCenter[0]},${clientCenter[1]}|${op.lng},${op.lat}`
        : `${clientCenter[0]},${clientCenter[1]}`;

    if (userHasTakenControl.current) return;
    if (lastAutoCentered.current === key) return;

    lastAutoCentered.current = key;

    const doZoom = () => {
      const cam = camRef.current as any;
      if (!cam) {
        if (autoZoomRetryRef.current < 10) {
          autoZoomRetryRef.current += 1;
          setTimeout(doZoom, 100);
        }
        return;
      }
      const hasOp = showOperator && op && isNum(op.lat) && isNum(op.lng);
      if (hasOp && cam.fitBounds) {
        const sw: [number, number] = [
          Math.min(clientCenter[0], (op as OperatorLocation).lng),
          Math.min(clientCenter[1], (op as OperatorLocation).lat),
        ];
        const ne: [number, number] = [
          Math.max(clientCenter[0], (op as OperatorLocation).lng),
          Math.max(clientCenter[1], (op as OperatorLocation).lat),
        ];
        cam.fitBounds(sw, ne, 60, 700);
      } else if (cam.setCamera) {
        cam.setCamera({
          centerCoordinate: clientCenter,
          zoomLevel: zoom,
          animationDuration: 500,
          animationMode: 'flyTo',
        } as any);
      }
    };
    autoZoomRetryRef.current = 0;
    setTimeout(doZoom, 100);
  }, [disableAutoZoom, mapReady, clientOk, clientCenter[0], clientCenter[1], zoom, showOperator, op?.lat, op?.lng]);

  if (!clientOk) {
    return (
      <View style={[styles.wrap, style ?? styles.defaultSize, styles.placeholder]}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  const osmTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

  return (
    <View style={[styles.wrap, style ?? styles.defaultSize]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFillObject}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionWillChange={onRegionWillChange}
        onDidFinishLoadingStyle={() => setMapReady(true)}
      >
        <MapLibreGL.Camera ref={camRef as any} />

        <MapLibreGL.RasterSource id="base" tileUrlTemplates={osmTiles} tileSize={256} minZoomLevel={0} maxZoomLevel={19}>
          <MapLibreGL.RasterLayer id="base-layer" />
        </MapLibreGL.RasterSource>

        {routeFC && (
          <MapLibreGL.ShapeSource id="route" shape={routeFC}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: '#8B5CF6', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.95 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client = blue dot location */}
        <MapLibreGL.MarkerView id="client-pin" coordinate={clientCenter} anchor={{ x: 0.5, y: 1.0 }}>
          <UserPin />
        </MapLibreGL.MarkerView>

        {/* Operator = your app device location */}
        {showOperator && op && isNum(op.lat) && isNum(op.lng) && (
          <MapLibreGL.MarkerView
            id="operator-pin"
            key={op.updated_at ?? `${op.lat},${op.lng}`}
            coordinate={[op.lng, op.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <OperatorPin />
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#000' },
  defaultSize: { flex: 1, width: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#aaa' },
});
