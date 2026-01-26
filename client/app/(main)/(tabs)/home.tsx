/* eslint-disable @typescript-eslint/array-type */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Platform,
  ToastAndroid,
  Alert,
  LogBox,
  TouchableOpacity,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Icons from "phosphor-react-native";
import { useAuth } from "@/contexts/authContext";
import * as Clipboard from "expo-clipboard";
import Logger from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import {
  MapView,
  Camera,
  type CameraRef,
  ShapeSource,
  FillLayer,
  LineLayer,
  SymbolLayer,
  MarkerView,
} from "@maplibre/maplibre-react-native";
import {
  DEFAULT_ZOOM,
  ILOILO_CENTER,
  MAPTILER_STYLE,
  PANAY_MAX_BOUNDS,
  AOI_GEOJSON_URL,
  MAPTILER_KEY,
} from "@/constants/map";
import LocationHeader from "@/components/LocationHeader";
import RequestStepper from "@/components/RequestStepper";
import { useCurrentAddress } from "@/hooks/useCurrentAddress";
import { LinearGradient } from "expo-linear-gradient";
import RequestStatusOverlay from "@/components/RequestStatusOverlay";
import { addActivityItem, updateActivityItem } from "@/utils/activityStore";
import { getSocket } from "@/socket/socket";
import {
  assistCreate,
  onAssistApproved,
  onAssistStatus,
} from "@/socket/socketEvents";
import Avatar from "@/components/Avatar";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toast } from "@/components/Toast";
import Typo from "@/components/Typo";
import { colors } from "@/constants/theme";
import {
  type OperatorStatusState,
  type OperatorInfo,
  type OperatorStatusKind,
} from "@/types";

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
          a.includes("{TextureViewRend}[Style]")),
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
    kind: "requesting" | "accepted" | "completed";
    caption?: string;
    operatorName?: string;
    operatorAvatar?: string | null;
  }>({
    visible: false,
    kind: "requesting",
    caption: undefined,
  });

  // Request status for RequestStepper (kept for compatibility/hooks)
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "requesting" | "accepted"
  >("idle");
  const [isRequesting, setIsRequesting] = useState(false);

  // local refs to correlate ack/approval
  const pendingLocalIdRef = useRef<string | null>(null);
  const [serverAssistId, setServerAssistId] = useState<string | null>(null);

  const getPHTimeWindow = (minutesToAdd = 15) => {
    const now = new Date();
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
    };
    const start = formatTime(new Date(now.getTime() + 2 * 60 * 1000));
    const end = formatTime(
      new Date(now.getTime() + (minutesToAdd + 2) * 60 * 1000),
    );
    return `${start} - ${end}`;
  };

  // Try to disable MapLibre bridge logs as well
  useEffect(() => {
    try {
      (Logger as any).setLogLevel?.("off");
      (Logger as any).setLogLevel?.("none");
      (Logger as any).setLogLevel?.(0);
    } catch {}
  }, []);

  // ---- Reachability probe ----
  const verifyMapTilerReachable = useCallback(async () => {
    try {
      const testUrl = `https://api.maptiler.com/maps/streets-v2/1/1/1.png?key=${MAPTILER_KEY}`;
      const res = await fetch(testUrl, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await verifyMapTilerReachable();
      setMapStyle(ok ? MAPTILER_STYLE : OSM_FALLBACK_RASTER_STYLE);
      if (!ok) {
        if (Platform.OS === "android")
          ToastAndroid.show(
            "MapTiler unreachable — using OSM fallback",
            ToastAndroid.LONG,
          );
        else
          Alert.alert("Map tiles", "MapTiler unreachable — using OSM fallback");
      }
    })();
  }, [verifyMapTilerReachable]);

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
   *  `REQUEST A`SSIST FLOW
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
      vehicle: {
        model: vehicleModel.trim(),
        plate: plateNumber.trim(),
        notes: otherInfo.trim(),
      },
      location: { lat: fix[1], lng: fix[0], address: address || "" },
      requestDate: new Date().toISOString(),
      customerName: currentUser?.name || "",
      customerPhone: currentUser?.phone || "",
    };

    // 4) Send and capture ack
    assistCreate(payload, async (ack) => {
      if (ack?.success && ack?.data?.id && pendingLocalIdRef.current) {
        const srvId = String(ack.data.id);
        setServerAssistId(srvId);
        await updateActivityItem(pendingLocalIdRef.current, {
          meta: {
            vehicleModel,
            plateNumber,
            otherInfo,
            assistId: srvId,
          },
        });
      }
    });

    // 5) Listen for server events (scoped for this request, then auto-unsub)
    const onApproved = async (evt: any) => {
      const srvId = String(evt?.data?.id || "");
      if (!evt?.success || !srvId) return;
      if (serverAssistId && srvId !== serverAssistId) return;

      const targetLocalId = pendingLocalIdRef.current;
      if (targetLocalId)
        await updateActivityItem(targetLocalId, { status: "accepted" });

      // operator details from approval payload (if present)
      const operator: OperatorInfo | undefined = evt?.data?.operator
        ? {
            id: String(evt.data.operator.id ?? evt.data.operator._id ?? ""),
            name: evt.data.operator.name,
            avatar: evt.data.operator.avatar ?? null,
            phone: evt.data.operator.phone,
          }
        : undefined;

      setRequestStatus("accepted");
      setIsRequesting(false);

      setOverlay({
        visible: true,
        kind: "accepted",
        caption:
          "Please check your Inbox to communicate with your service provider",
      });
      setTimeout(() => {
        setOverlay((o) => ({ ...o, visible: false }));
        // Redirect to activity screen after approval
        router.push("/(main)/(tabs)/activity");
      }, 1600);

      // Unsubscribe these scoped listeners after acceptance
      onAssistApproved(onApproved, true);
      onAssistStatus(onStatus, true);
    };

    const onStatus = async (evt: any) => {
      const srvId = String(evt?.data?.id || "");
      if (!evt?.success || !srvId) return;
      const raw = String(evt?.data?.status || "").toLowerCase();
      const map: Record<string, "pending" | "accepted" | "completed"> = {
        completed: "completed",
        pending: "pending",
        accepted: "accepted",
      };
      const localStatus = map[raw] || "pending";
      const targetLocalId = pendingLocalIdRef.current;
      if (targetLocalId)
        await updateActivityItem(targetLocalId, { status: localStatus });

      // handle completion - show banner and navigate
      if (raw === "completed") {
        setRequestStatus("idle");

        // Show completed banner
        setOverlay({
          visible: true,
          kind: "completed",
          caption: "Your assistance request has been completed!",
        });

        // Auto-navigate to activity after 4 seconds
        setTimeout(() => {
          setOverlay((o) => ({ ...o, visible: false }));
          router.push({
            pathname: "/(main)/rate",
            params: { id: srvId },
          });
        }, 4000);
      }
    };

    onAssistApproved(onApproved);
    onAssistStatus(onStatus);
  };

  // 🔔 GLOBAL listener for assist approval (always active, not scoped to request)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleGlobalAssistApproved = async (evt: any) => {
      console.log("🔔 GLOBAL: assist:approved event received", evt);

      const srvId = String(evt?.data?.id || "");
      if (!evt?.success || !srvId) return;

      // Check if this is for our current request
      if (serverAssistId && srvId !== serverAssistId) {
        console.log("⚠️ Event for different request, ignoring");
        return;
      }

      console.log("✅ Processing approval for request:", srvId);

      // Update activity item (will be updated with operator data below)
      const targetLocalId = pendingLocalIdRef.current;

      // Extract operator details from socket event (includes location, username, fullName)
      const operator: OperatorInfo | undefined = evt?.data?.operator
        ? {
            id: String(evt.data.operator.id ?? evt.data.operator._id ?? ""),
            name:
              evt.data.operator.name ||
              evt.data.operator.username ||
              "Operator",
            username:
              evt.data.operator.username || evt.data.operator.name || null,
            fullName:
              evt.data.operator.fullName ||
              evt.data.operator.name ||
              evt.data.operator.username ||
              null,
            avatar: evt.data.operator.avatar ?? null,
            phone: evt.data.operator.phone || null,
            email: evt.data.operator.email || null,
            location: evt.data.operator.location || null,
          }
        : undefined;

      // Update activity item with full operator data including location
      if (targetLocalId && operator) {
        await updateActivityItem(targetLocalId, {
          status: "accepted",
          meta: {
            assistId: srvId,
            operator: {
              id: operator.id,
              name: operator.name,
              username: operator.username,
              fullName: operator.fullName,
              avatar: operator.avatar,
              phone: operator.phone,
              email: operator.email,
            },
            operatorLocation: operator.location,
          },
        });
      }

      // Show en route card
      setRequestStatus("accepted");
      setIsRequesting(false);

      // Trigger success haptic
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Show toast notification
      if (operator) {
        toast.success(`Request accepted by ${operator.name}!`, {
          duration: 5000,
          onPress: () => router.push("/(main)/(tabs)/activity"),
        });
      }

      setOverlay({
        visible: true,
        kind: "accepted",
        operatorName: operator?.name,
        operatorAvatar: operator?.avatar,
        caption:
          "Please check your Inbox to communicate with your service provider",
      });

      setTimeout(() => {
        setOverlay((o) => ({ ...o, visible: false }));
        // Logic change: Redirect to activity screen after approval
        router.push("/(main)/(tabs)/activity");
      }, 1600);
    };

    socket.on("assist:approved", handleGlobalAssistApproved);
    console.log("✅ Global assist:approved listener registered");

    return () => {
      socket.off("assist:approved", handleGlobalAssistApproved);
      console.log("🛑 Global assist:approved listener removed");
    };
  }, [serverAssistId]);

  // 🔔 Global listener for assist status updates (including completed)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleGlobalAssistStatus = async (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const srvId = String(evt?.data?.id || "");
      if (!srvId) return;

      const raw = String(evt?.data?.status || "").toLowerCase();

      // Update activity item if we have a match
      const targetLocalId = pendingLocalIdRef.current;
      if (targetLocalId) {
        await updateActivityItem(targetLocalId, { status: raw as any });
      }

      if (raw === "completed") {
        setRequestStatus("idle");

        // Show completed banner
        setOverlay({
          visible: true,
          kind: "completed",
          caption: "Your assistance request has been completed!",
        });

        // Auto-navigate to activity after 4 seconds
        setTimeout(() => {
          setOverlay((o) => ({ ...o, visible: false }));
          router.push({
            pathname: "/(main)/rate",
            params: { id: srvId },
          });
        }, 4000);
      }
    };

    socket.on("assist:status", handleGlobalAssistStatus);
    console.log("✅ Global assist:status listener registered");

    return () => {
      socket.off("assist:status", handleGlobalAssistStatus);
      console.log("🛑 Global assist:status listener removed");
    };
  }, [serverAssistId]);

  // 🔔 Global listener for operator realtime status updates
  useEffect(() => {
    const socket = getSocket();
    const handleOperatorStatus = (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const assistId = String(evt.data.assistId || evt.data.id || "");
      if (!assistId) return;
      if (serverAssistId && assistId !== serverAssistId) return;

      const raw = String(
        evt.data.status || "",
      ).toLowerCase() as OperatorStatusKind;
      const nextStatus: OperatorStatusKind =
        raw === "arrived" || raw === "working" || raw === "completed"
          ? (raw as OperatorStatusKind)
          : "en_route";

      if (nextStatus === "completed") {
        setOverlay((o) => ({ ...o, visible: false }));
        setRequestStatus("idle");
      }
    };

    if (socket) {
      socket.on("operator:statusUpdate", handleOperatorStatus);
    }
    return () => {
      if (socket) {
        socket.off("operator:statusUpdate", handleOperatorStatus);
      }
    };
  }, [serverAssistId]);

  // 🔔 Global listener for operator realtime location updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleLocationUpdate = (evt: any) => {
      if (!evt?.success || !evt?.data?.operatorLocation) return;
      console.log(
        "📍 Operator location received (Home will not display):",
        evt.data.operatorLocation,
      );
    };

    socket.on("operator:locationChanged", handleLocationUpdate);
    return () => {
      socket.off("operator:locationChanged", handleLocationUpdate);
    };
  }, [serverAssistId]);

  // �🔄 POLLING: Check database every 3 seconds while request is pending
  useEffect(() => {
    if (requestStatus !== "requesting" || !serverAssistId) return;

    console.log(
      `🔄 Starting polling for request ${serverAssistId} acceptance...`,
    );

    const startTime = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    const checkStatus = async () => {
      // Check for timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log("⏱️ Request timeout reached");
        setIsRequesting(false);
        setRequestStatus("idle");
        setOverlay({ visible: false, kind: "requesting" });
        toast.error(
          "No operators accepted your request within 5 minutes. Please try again.",
          {
            duration: 10000,
          },
        );
        return;
      }

      try {
        const token = await AsyncStorage.getItem("token");
        const response = await fetch(
          `${API_URL}/api/assist/${serverAssistId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.status === "accepted") {
            console.log("✅ Polling detected acceptance!");

            const operatorData = data.data.assignedTo || data.data.acceptedBy;
            const operator: OperatorInfo | undefined = operatorData
              ? {
                  id: String(operatorData._id || operatorData),
                  name: operatorData.name || "Operator",
                  avatar: operatorData.avatar || null,
                  phone: operatorData.phone || null,
                }
              : undefined;

            setRequestStatus("accepted");
            setIsRequesting(false);

            // Notify user with toast
            const msg = operator?.name
              ? `Request accepted by ${operator.name}!`
              : "Your request has been approved!";

            toast.success(msg);

            setOverlay({
              visible: true,
              kind: "accepted",
              operatorName: operator?.name,
              operatorAvatar: operator?.avatar,
              caption:
                "Please check your Inbox to communicate with your service provider",
            });

            setTimeout(() => {
              setOverlay((o) => ({ ...o, visible: false }));
              // Logic change: Redirect to activity screen after approval
              router.push("/(main)/(tabs)/activity");
            }, 1600);
          }
        }
      } catch (error) {
        console.error("❌ Polling error:", error);
      }
    };

    const interval = setInterval(checkStatus, 3000); // Poll every 3 seconds
    checkStatus(); // Check immediately

    return () => {
      console.log(`🛑 Stopping polling for ${serverAssistId}`);
      clearInterval(interval);
    };
  }, [requestStatus, serverAssistId]);

  // Don’t render MapView until tile host decision is made
  if (!mapStyle) {
    return (
      <View style={[styles.fullScreenContainer, { marginBottom: 0 }]}>
        <View style={styles.container} />
      </View>
    );
  }

  // Dynamic heights so content goes BEHIND the navbar,
  // while the sheet/card sits ABOVE it.
  const stepperInset = tabBarHeight + insets.bottom + 8;

  return (
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
          defaultSettings={{
            centerCoordinate: ILOILO_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
          maxBounds={PANAY_MAX_BOUNDS}
          followUserLocation={hasLocation}
          followZoomLevel={DEFAULT_ZOOM}
        />

        {/* Custom user marker with the account avatar (MarkerView) */}
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
            <FillLayer
              id="aoi-fill"
              style={{ fillOpacity: 0.08, fillColor: "#000000" }}
            />
            <LineLayer
              id="aoi-line"
              style={{ lineColor: "#000000", lineWidth: 1.5 }}
            />
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

      {/* Top-to-bottom dark gradient overlay */}
      <View style={styles.mapGradientOverlay}>
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header */}
      <LocationHeader
        username={currentUser?.name}
        address={address}
        locating={locating}
        onCopy={handleCopyAddress}
      />

      {/* ===== Bottom area: Stepper ===== */}

      {/* Show stepper even when operator is requesting/accepted */}
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
        requestStatus={requestStatus}
      />

      {/* Status overlays */}
      <RequestStatusOverlay
        visible={overlay.visible}
        kind={overlay.kind}
        caption={overlay.caption}
        operatorName={overlay.operatorName}
        operatorAvatar={overlay.operatorAvatar}
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

  mapGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%", // Gradient covers the top half
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
    overflow: "hidden",
  },
  operatorMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6EFF87",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#000",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
  },

  enRouteWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 10,
  },
  requestAgainBtn: {
    backgroundColor: "#6EFF87",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
