/* eslint-disable @typescript-eslint/array-type */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Platform,
  ToastAndroid,
  Alert,
  LogBox,
} from "react-native";
import { useAuth } from "@/contexts/authContext";
import * as Clipboard from "expo-clipboard";
import Logger from "@maplibre/maplibre-react-native";
import {
  MapView,
  Camera,
  type CameraRef,
  ShapeSource,
  FillLayer,
  LineLayer,
  SymbolLayer,
  MarkerView, // ✅ use MarkerView for reliable RN views over the map
} from "@maplibre/maplibre-react-native";
import {
  DEFAULT_ZOOM,
  ILOILO_CENTER,
  GEOAPIFY_RASTER_STYLE,
  PANAY_MAX_BOUNDS,
  AOI_GEOJSON_URL,
  GEOAPIFY_KEY,
} from "@/constants/map";
import LocationHeader from "@/components/LocationHeader";
import RequestStepper from "@/components/RequestStepper";
import { useCurrentAddress } from "@/hooks/useCurrentAddress";
import { BlurView } from "expo-blur";
import RequestStatusOverlay from "@/components/RequestStatusOverlay";
import { addActivityItem, updateActivityItem } from "@/utils/activityStore";
import { getSocket } from "@/socket/socket";
import {
  assistCreate,
  onAssistApproved,
  onAssistStatus,
} from "@/socket/socketEvents";
import Avatar from "@/components/Avatar";

// NEW: get tab bar height & safe-area to render behind the navbar but keep overlays above it
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------- DEV: silence MapLibre spam EARLY (before first render) ---------- */
if (__DEV__) {
  LogBox.ignoreLogs([
    "Mbgl-HttpRequest",
    "Request failed due to a permanent error: Canceled",
    "MapLibre error",
    "Failed to load tile",
    "{TextureViewRend}[Style]",
  ]);
  const shouldSkip = (args: any[]) =>
    args?.some(
      (a: any) =>
        typeof a === "string" &&
        (a.includes("Mbgl-HttpRequest") ||
          a.includes("Request failed due to a permanent error: Canceled") ||
          a.includes("MapLibre error") ||
          a.includes("Failed to load tile") ||
          a.includes("{TextureViewRend}[Style]"))
    );
  const __orig = {
    log: console.log,
    warn: console.warn,
    info: console.info,
    error: console.error,
  };
  // eslint-disable-next-line no-console
  console.log = (...a: any[]) => (shouldSkip(a) ? undefined : __orig.log(...a));
  // eslint-disable-next-line no-console
  console.warn = (...a: any[]) =>
    shouldSkip(a) ? undefined : __orig.warn(...a);
  // eslint-disable-next-line no-console
  console.info = (...a: any[]) =>
    shouldSkip(a) ? undefined : __orig.info(...a);
  // eslint-disable-next-line no-console
  console.error = (...a: any[]) =>
    shouldSkip(a) ? undefined : __orig.error(...a);
}
/* -------------------------------------------------------------------------- */

// ---------- Dev-only raster fallback (if Geoapify host is unreachable) ----------
const OSM_FALLBACK_RASTER_STYLE: any = {
  version: 8,
  name: "osm-fallback",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: 22 },
  ],
};
// -----------------------------------------------------------------------------

// Liquid Glass (SDK 54+). Safe import & fallback.
let GlassView: any, isLiquidGlassAvailable: (() => boolean) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require("expo-glass-effect");
  GlassView = m.GlassView;
  isLiquidGlassAvailable = m.isLiquidGlassAvailable;
} catch {}

const LiquidGlassBackdrop: React.FC<{ opacity?: number }> = ({
  opacity = 0.55,
}) => {
  const canLiquid =
    Platform.OS === "ios" && GlassView && (isLiquidGlassAvailable?.() ?? true);
  if (canLiquid) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        style={[StyleSheet.absoluteFill, { opacity }]}
      />
    );
  }
  return (
    <BlurView
      pointerEvents="none"
      tint="dark"
      intensity={20}
      style={[StyleSheet.absoluteFill, { opacity }]}
    />
  );
};

const Home = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const { user: currentUser } = useAuth();
  const cameraRef = useRef<CameraRef | null>(null);
  const movedOnceRef = useRef(false);

  const { locating, hasLocation, address, fix, recenter } = useCurrentAddress();

  const [showAoi, setShowAoi] = useState(false);

  // Vehicle inputs
  const [vehicleModel, setVehicleModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [otherInfo, setOtherInfo] = useState("");

  // Map style after reachability probe
  const [mapStyle, setMapStyle] = useState<any | null>(null);

  // Request status overlay
  const [overlay, setOverlay] = useState<{
    visible: boolean;
    kind: "requesting" | "accepted";
    caption?: string;
  }>({
    visible: false,
    kind: "requesting",
    caption: undefined,
  });

  // Request status for RequestStepper
  const [requestStatus, setRequestStatus] = useState<"idle" | "requesting" | "accepted">("idle");
  const [isRequesting, setIsRequesting] = useState(false);

  // local refs to correlate ack/approval
  const pendingLocalIdRef = useRef<string | null>(null);
  const serverAssistIdRef = useRef<string | null>(null);

  // Try to disable MapLibre bridge logs as well
  useEffect(() => {
    try {
      (Logger as any).setLogLevel?.("off");
      (Logger as any).setLogLevel?.("none");
      (Logger as any).setLogLevel?.(0);
    } catch {}
  }, []);

  // ---- Reachability probe ----
  const verifyGeoapifyReachable = useCallback(async () => {
    try {
      const testUrl = `https://maps.geoapify.com/v1/tile/osm-bright/1/1/1.png?apiKey=${GEOAPIFY_KEY}`;
      const res = await fetch(testUrl, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await verifyGeoapifyReachable();
      setMapStyle(ok ? GEOAPIFY_RASTER_STYLE : OSM_FALLBACK_RASTER_STYLE);
      if (!ok) {
        if (Platform.OS === "android")
          ToastAndroid.show(
            "Geoapify unreachable — using OSM fallback",
            ToastAndroid.LONG
          );
        else
          Alert.alert("Map tiles", "Geoapify unreachable — using OSM fallback");
      }
    })();
  }, [verifyGeoapifyReachable]);

  // Initial camera (once)
  useEffect(() => {
    if (!locating && fix && cameraRef.current && !movedOnceRef.current) {
      // @ts-ignore
      cameraRef.current.moveTo(fix, 0);
      setTimeout(() => {
        // @ts-ignore
        cameraRef.current?.zoomTo(DEFAULT_ZOOM, 0);
      }, 0);
      movedOnceRef.current = true;
      setTimeout(() => setShowAoi(true), 300);
    }
  }, [locating, fix]);

  const handleCopyAddress = async () => {
    try {
      await Clipboard.setStringAsync(locating ? "Locating…" : address || "");
      if (Platform.OS === "android")
        ToastAndroid.show("Location copied", ToastAndroid.SHORT);
      else Alert.alert("Copied", "Location copied to clipboard");
    } catch {}
  };

  /** =======================
   *  REQUEST ASSIST FLOW
   *  ======================= */
  const onRequestAssist = async () => {
    if (!currentUser) {
      Alert.alert("Login required", "Please sign in first.");
      return;
    }
    if (!fix) {
      Alert.alert("Location", "Waiting for GPS fix. Please try again.");
      return;
    }

    // 1) Create a local activity entry
    const localId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingLocalIdRef.current = localId;

    await addActivityItem({
      id: localId,
      title: "Request assistance",
      placeName: address || "Unknown location",
      createdAt: new Date().toISOString(),
      status: "pending",
      meta: {
        vehicleModel,
        plateNumber,
        otherInfo,
        assistId: null as unknown as string | null,
      },
    });

    // 2) Show "requesting…"
    setOverlay({ visible: true, kind: "requesting" });
    setRequestStatus("requesting");
    setIsRequesting(true);

    // 3) Emit enhanced payload with all customer data
    const payload = {
      vehicle: { model: vehicleModel.trim(), plate: plateNumber.trim(), notes: otherInfo.trim() },
      location: { lat: fix[1], lng: fix[0], address: address || "" },
      requestDate: new Date().toISOString(),
      customerName: currentUser?.name || "",
      customerPhone: currentUser?.phone || "",
    };

    // 4) Send and capture ack
    assistCreate(payload, async (ack) => {
      if (ack?.success && ack?.data?.id && pendingLocalIdRef.current) {
        serverAssistIdRef.current = String(ack.data.id);
        await updateActivityItem(pendingLocalIdRef.current, {
          meta: {
            vehicleModel,
            plateNumber,
            otherInfo,
            assistId: serverAssistIdRef.current,
          },
        });
      }
    });

    // 5) Listen for server events
    const onApproved = async (evt: any) => {
      const srvId = String(evt?.data?.id || "");
      if (!evt?.success || !srvId) return;
      if (serverAssistIdRef.current && srvId !== serverAssistIdRef.current) return;

      const targetLocalId = pendingLocalIdRef.current;
      if (targetLocalId) await updateActivityItem(targetLocalId, { status: "accepted" });

      setOverlay({
        visible: true,
        kind: "accepted",
        caption: "Please check your Inbox to communicate with your service provider",
      });
      setRequestStatus("accepted");
      setIsRequesting(false);
      setTimeout(() => setOverlay((o) => ({ ...o, visible: false })), 1600);

      onAssistApproved(onApproved, true);
      onAssistStatus(onStatus, true);
    };

    const onStatus = async (evt: any) => {
      const srvId = String(evt?.data?.id || "");
      if (!evt?.success || !srvId) return;
      const raw = String(evt?.data?.status || "").toLowerCase();
      const map: Record<string, "done" | "canceled" | "pending" | "accepted"> = {
        completed: "done",
        cancelled: "canceled",
        canceled: "canceled",
        rejected: "canceled",
        pending: "pending",
        accepted: "accepted",
      };
      const localStatus = map[raw] || "pending";
      const targetLocalId = pendingLocalIdRef.current;
      if (targetLocalId) await updateActivityItem(targetLocalId, { status: localStatus });
    };

    onAssistApproved(onApproved);
    onAssistStatus(onStatus);
  };

  // Don’t render MapView until tile host decision is made
  if (!mapStyle) {
    return (
      <View style={[styles.fullScreenContainer, { marginBottom: 0 }]}>
        <View style={styles.container} />
      </View>
    );
  }

  // Dynamic heights so content goes BEHIND the navbar,
  // while the sheet & overlay sit ABOVE it.
  const bottomOverlayHeight = tabBarHeight + 300;
  const stepperInset = tabBarHeight + insets.bottom + 8;

  return (
    // ⬇️ negative margin puts the screen behind the tab bar
    <View style={[styles.fullScreenContainer, { marginBottom: -tabBarHeight }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        attributionEnabled
        compassEnabled
        logoEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: ILOILO_CENTER, zoomLevel: DEFAULT_ZOOM }}
          maxBounds={PANAY_MAX_BOUNDS}
          followUserLocation={hasLocation}
          followZoomLevel={DEFAULT_ZOOM}
        />

        {/* Custom user marker with the account avatar (MarkerView > PointAnnotation for RN views) */}
        {!!fix && (
          <MarkerView
            key={String((currentUser as any)?.avatar ?? "no-avatar")}
            id="me"
            coordinate={fix}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.avatarMarker}>
              <Avatar uri={(currentUser as any)?.avatar ?? null} size={42} />
            </View>
          </MarkerView>
        )}

        {/* AOI overlay (only if you set a URL) */}
        {showAoi && !!AOI_GEOJSON_URL && (
          <ShapeSource id="aoi-geojson" url={AOI_GEOJSON_URL}>
            <FillLayer id="aoi-fill" style={{ fillOpacity: 0.08, fillColor: "#000000" }} />
            <LineLayer id="aoi-line" style={{ lineColor: "#000000", lineWidth: 1.5 }} />
            <SymbolLayer
              id="aoi-labels"
              style={{
                textField: ["get", "name"] as any,
                textSize: 12,
                textColor: "#111111",
                textHaloColor: "#FFFFFF",
                textHaloWidth: 1,
                textAllowOverlap: false,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Dark overlay for bottom sheet area (also extends under navbar) */}
      <View style={[styles.darkOverlay, { height: bottomOverlayHeight }]} />

      {/* Header */}
      <LocationHeader
        username={currentUser?.name}
        address={address}
        locating={locating}
        onCopy={handleCopyAddress}
      />

      {/* Bottom request sheet (kept above the navbar) */}
      <RequestStepper
        vehicleModel={vehicleModel}
        setVehicleModel={setVehicleModel}
        plateNumber={plateNumber}
        setPlateNumber={setPlateNumber}
        otherInfo={otherInfo}
        setOtherInfo={setOtherInfo}
        onRecenter={recenter}
        bottomInset={stepperInset}
        onRequest={onRequestAssist}
        isRequesting={isRequesting}
      />

      {/* Status overlays */}
      <RequestStatusOverlay
        visible={overlay.visible}
        kind={overlay.kind}
        caption={overlay.caption}
        onClose={() => {
          setOverlay((prev) => ({ ...prev, visible: false }));
          if (overlay.kind === "requesting") {
            setIsRequesting(false);
            setRequestStatus("idle");
          }
        }}
      />
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  container: { flex: 1 },

  darkOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    // height set dynamically so it also extends behind the navbar
    pointerEvents: "none",
  },

  avatarMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden", // helps clip the Avatar nicely
  },
});
