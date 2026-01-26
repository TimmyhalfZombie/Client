import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import ClientPin from '../../components/ClientPin';
import { MAPTILER_RASTER_TILES_512, OSM_RASTER_TILES_256 } from '../../constants/geo';
import { fetchClientLocation, LatLng } from './api';

type Props = {
  from: LatLng;
  to?: LatLng;
  clientId?: string;
  line?: LatLng[];
  style?: StyleProp<ViewStyle>;
};

MapLibreGL.setAccessToken(null);

// Toggle later if your network allows vector tiles/sprites/glyphs
const USE_VECTOR = false;
const VECTOR_STYLE_URL =
  'https://api.maptiler.com/maps/streets-v4/style.json?key=2qSQ9pofebFXsJIh7Nog';

const EMPTY_STYLE_JSON = JSON.stringify({ version: 8, sources: {}, layers: [] });

export default function MapLibreRouteMap({ from, to, clientId, line = [], style }: Props) {
  // Force raster unless you enable vector above
  const [mode, setMode] = useState<'vector' | 'raster-mt' | 'raster-osm'>(USE_VECTOR ? 'vector' : 'raster-mt');
  const [mapReady, setMapReady] = useState(mode !== 'vector'); // raster ready now

  const [client, setClient] = useState<LatLng | null>(to ?? null);
  const [loadingClient, setLoadingClient] = useState(!to && !!clientId);
  const [clientErr, setClientErr] = useState<string | null>(null);

  const effectiveClient = client ?? to ?? from;
  const maybeClient = client ?? to ?? null;

  // Camera + guards
  const camRef = useRef<MapLibreGL.Camera>(null);
  const didInitView = useRef(false);
  const didFitTwoPoints = useRef(false);
  const userHasTakenControl = useRef(false);

  const onRegionWillChange = (e: any) => {
    const p = e?.nativeEvent?.properties ?? e?.properties ?? {};
    const byUser = p?.gesture === true || p?.isUserInteraction === true || p?.manualGesture === true;
    if (byUser) userHasTakenControl.current = true;
  };

  const onStyleLoaded = () => setMapReady(true);

  const onMapError = (e: any) => {
    const msg = String(e?.nativeEvent?.message || '');
    const shouldFallback =
      /401|403|404|429|5\d\d|Unauthorized|Forbidden|Not Found|Too Many/i.test(msg);
    if (!shouldFallback) {
      console.log('Map error (ignored):', msg);
      return;
    }
    console.log('Map error (fallback to raster):', msg);
    setMapReady(true);
    setMode('raster-mt');
  };

  // fetch client location if not provided
  useEffect(() => {
    let m = true;
    if (!to && clientId) {
      setLoadingClient(true);
      setClientErr(null);
      fetchClientLocation(clientId)
        .then((loc) => { if (m) setClient(loc); })
        .catch((e) => { if (m) setClientErr(e?.message || 'Failed to load client'); })
        .finally(() => { if (m) setLoadingClient(false); });
    }
    return () => { m = false; };
  }, [clientId, to]);

  // Auto-zoom once (or fit both once) before user interaction
  useEffect(() => {
    if (!mapReady || userHasTakenControl.current) return;

    if (!didInitView.current) {
      didInitView.current = true;
      setTimeout(() => {
        camRef.current?.setCamera?.({
          centerCoordinate: [(from.lng + effectiveClient.lng) / 2, (from.lat + effectiveClient.lat) / 2],
          zoomLevel: 13,
          animationDuration: 400,
          animationMode: 'flyTo',
        } as any);
      }, 50);
    }

    if (!didFitTwoPoints.current) {
      const same =
        Math.abs(from.lng - effectiveClient.lng) < 1e-6 &&
        Math.abs(from.lat - effectiveClient.lat) < 1e-6;
      if (!same) {
        const sw: [number, number] = [Math.min(from.lng, effectiveClient.lng), Math.min(from.lat, effectiveClient.lat)];
        const ne: [number, number] = [Math.max(from.lng, effectiveClient.lng), Math.max(from.lat, effectiveClient.lat)];
        setTimeout(() => {
          camRef.current?.fitBounds?.(sw, ne, 60, 800);
        }, 50);
      }
      didFitTwoPoints.current = true;
    }
  }, [mapReady, from.lng, from.lat, effectiveClient.lng, effectiveClient.lat]);

  const routeFeature = useMemo(() => {
    if (!line.length) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: line.map((p) => [p.lng, p.lat]) },
      properties: {},
    };
  }, [line]);

  return (
    <View style={[styles.fill, style]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionWillChange={onRegionWillChange}
        onDidFinishLoadingStyle={onStyleLoaded}
        onMapError={onMapError}
        {...(mode === 'vector'
          ? { styleURL: VECTOR_STYLE_URL }
          : { styleJSON: EMPTY_STYLE_JSON })}
      >
        <MapLibreGL.Camera ref={camRef as any} />

        {mode !== 'vector' && (
          <MapLibreGL.RasterSource
            id="mt-fallback"
            tileUrlTemplates={mode === 'raster-mt' ? MAPTILER_RASTER_TILES_512 : OSM_RASTER_TILES_256}
            tileSize={mode === 'raster-mt' ? 512 : 256}
            maxZoomLevel={19}
          >
            <MapLibreGL.RasterLayer id="mt-fallback-layer" />
          </MapLibreGL.RasterSource>
        )}

        {routeFeature && (
          <MapLibreGL.ShapeSource id="custom-route" shape={routeFeature}>
            <MapLibreGL.LineLayer
              id="custom-route-line"
              style={{ lineWidth: 5, lineOpacity: 0.9, lineColor: '#00B3FF', lineCap: 'round', lineJoin: 'round' }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {maybeClient && (
          <MapLibreGL.MarkerView id="client-pin" coordinate={[maybeClient.lng, maybeClient.lat]} anchor={{ x: 0.5, y: 0.5 }}>
            <ClientPin />
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>

      {(loadingClient || clientErr) && (
        <View style={styles.hud}>
          {loadingClient ? <ActivityIndicator size="small" /> : null}
          <Text style={[styles.hudText, clientErr ? { color: '#ff6b6b' } : null]}>
            {clientErr ? 'Client location error' : 'Loading client…'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  hud: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hudText: { marginLeft: 6, color: '#eee', fontSize: 12 },
});
