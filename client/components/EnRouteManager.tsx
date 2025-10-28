// client/components/EnRouteManager.tsx
import React from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
import * as Icons from "phosphor-react-native";
import { OperatorStatusKind, OperatorInfo, OperatorStatusState } from "@/types";

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

// --------------------
// Props
// --------------------
type EnRouteManagerProps = {
  operatorStatus: OperatorStatusState;
  bottomInset: number;
};

// --------------------
// Component
// --------------------
const EnRouteManager: React.FC<EnRouteManagerProps> = ({
  operatorStatus,
  bottomInset,
}) => {
  // Don't render if not visible
  if (!operatorStatus.visible) return null;

  return (
    <View style={[styles.enRouteContainer, { bottom: bottomInset }]}>
      <LiquidGlassBackdrop opacity={0.4} />
      <View style={styles.enRouteInner}>
        {/* Header row */}
        <View style={styles.enRouteHeader}>
          <Text style={styles.enRouteTitle}>Operator en route</Text>
          <View style={styles.timePill}>
            <View style={styles.liveDot} />
            <Text style={styles.timePillText}>
              {operatorStatus.eta ?? "10:15 - 10:25 AM"}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineRow}>
          <Icons.UserCircle size={22} color={"#6EFF87"} weight="duotone" />
          <View style={styles.timelineBar} />
          <Icons.Wrench size={20} color={"#6EFF87"} weight="duotone" />
        </View>

        {/* Message */}
        <View style={styles.messageRow}>
          <Text style={styles.messageText}>
            {(operatorStatus.operator?.name ?? "Your operator")} is on the way
            there.
          </Text>
          <Icons.EnvelopeSimple size={18} color={"#6EFF87"} weight="duotone" />
        </View>
      </View>
    </View>
  );
};

export default EnRouteManager; 

const styles = StyleSheet.create({
  /* === En Route Card (replaces stepper) === */
  enRouteContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(110,255,135,0.12)",
    borderWidth: 1.5,
    borderColor: "#6EFF87",
  },
  enRouteInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(13,13,13,0.9)",
  },
  enRouteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  enRouteTitle: { color: "#6EFF87", fontSize: 16, fontWeight: "900" },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0F1115",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#3CE07B" },
  timePillText: { color: "#E8E8E8", fontSize: 12, fontWeight: "700" },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 6,
  },
  timelineBar: { flex: 1, height: 2, backgroundColor: "#6EFF87", opacity: 0.85 },
  messageRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  messageText: { color: "#E8E8E8", fontSize: 14, fontWeight: "700" },
});

