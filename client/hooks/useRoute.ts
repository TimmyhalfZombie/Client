import { useState, useCallback } from "react";
import { Step } from "@/types";
import { useAuth } from "@/contexts/authContext";
import { API_URL } from "@/constants";

export function useRoute() {
  const { token } = useAuth();
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(
    async (origin: [number, number], dest: [number, number]) => {
      try {
        setLoading(true);
        setError(null);

        const body = {
          origin: { lat: origin[1], lng: origin[0] },
          destination: { lat: dest[1], lng: dest[0] },
        };

        const res = await fetch(`${API_URL}/api/routing/route`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add auth token if available
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
          },
          body: JSON.stringify(body),
        });

        const json = await res.json();

        if (json.success && json.data) {
          // Convert server response to GeoJSON format
          const geoJSON = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: json.data.geometry,
                properties: json.data.properties,
              },
            ],
          };

          setRouteGeoJSON(geoJSON);

          // Extract steps from the response
          const s: Step[] =
            json.data.properties.segments[0]?.steps?.map((st: any) => ({
              instruction: st.instruction,
              distance: st.distance,
              duration: st.duration,
            })) || [];
          setSteps(s);
        } else {
          setError(json.error || "Failed to fetch route");
        }
      } catch (err) {
        console.warn("[useRoute] fetch error", err);
        setError("Network error while fetching route");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchETA = useCallback(
    async (
      operatorLocation: { lat: number; lng: number },
      customerLocation: { lat: number; lng: number },
    ) => {
      try {
        setLoading(true);
        setError(null);

        const body = {
          operatorLocation,
          customerLocation,
        };

        const res = await fetch(`${API_URL}/api/routing/eta`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
          },
          body: JSON.stringify(body),
        });

        const json = await res.json();

        if (json.success && json.data) {
          return json.data;
        } else {
          setError(json.error || "Failed to fetch ETA");
          return null;
        }
      } catch (err) {
        console.warn("[useRoute] ETA fetch error", err);
        setError("Network error while fetching ETA");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearRoute = useCallback(() => {
    setRouteGeoJSON(null);
    setSteps([]);
    setError(null);
  }, []);

  return {
    routeGeoJSON,
    steps,
    loading,
    error,
    fetchRoute,
    fetchETA,
    clearRoute,
  };
}
