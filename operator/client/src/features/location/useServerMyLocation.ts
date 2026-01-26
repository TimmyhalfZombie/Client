// client/src/features/location/useServerMyLocation.ts
import { useEffect, useState } from 'react';
import * as ExpoLocation from 'expo-location';
import { fetchMyLocationFromServer, OperatorLocation, postMyLocationToServer } from '../../lib/operator.api';

export function useServerMyLocation(pollMs = 5000) {
  const [loc, setLoc] = useState<OperatorLocation | null>(null);

  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const data = await fetchMyLocationFromServer();
        setLoc(data || null);
      } catch {}
      t = setTimeout(tick, pollMs);
    };
    tick();
    return () => clearTimeout(t);
  }, [pollMs]);

  return loc;
}

/**
 * Posts device location to the server every `ms` while `enabled` is true.
 * Requests permission once (best-effort). Falls back silently if denied.
 */
export function usePostMyLocationOnInterval(enabled: boolean, ms = 5000) {
  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    let timer: any;

    async function start() {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const tick = async () => {
          try {
            const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
            if (!alive) return;
            await postMyLocationToServer({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          } catch {
            // ignore
          }
          if (alive) timer = setTimeout(tick, ms);
        };

        await tick();
      } catch {
        // ignore
      }
    }

    start();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled, ms]);
}
