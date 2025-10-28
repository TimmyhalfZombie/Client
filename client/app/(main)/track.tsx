import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import { getActivity, ActivityItem } from "@/utils/activityStore";
import assistService from "@/services/assistService";
import * as Icons from "phosphor-react-native";
import { useCurrentAddress } from "@/hooks/useCurrentAddress";

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ALWAYS return a string for `title`
function splitAddress(full?: string): { title: string; sub?: string } {
  const safe = (full ?? "").trim();
  if (!safe) return { title: "Your location" };
  const parts = safe.split(",").map((s) => s.trim()).filter(Boolean);
  const title = parts[0] ?? "Your location";
  const sub = parts.length > 1 ? parts.slice(1).join(", ") : undefined;
  return { title, sub };
}

export default function TrackActivity() {
  // id can be string | string[] | undefined in expo-router
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [item, setItem] = useState<ActivityItem | null>(null);
  const [loading, setLoading] = useState(false);

  const { locating, address } = useCurrentAddress();
  // Call with a string and guarantee return shape
  const origin = useMemo(() => splitAddress(address ?? ""), [address]);

  useEffect(() => {
    (async () => {
      const items = await getActivity();
      setItem(
        items.find(
          (i) => i.id === id || String(i.meta?.assistId ?? "") === String(id)
        ) || null
      );
    })();
  }, [id]);

  const operatorName = useMemo(
    () => ((item?.meta as any)?.operator?.name ?? "Operator"),
    [item]
  );

  const handleCancelRequest = async () => {
    if (!item) return;
    const assistId = String(item.meta?.assistId || item.id);
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this assistance request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const success = await assistService.cancelAssistRequest(assistId);
              if (success) {
                Alert.alert("Success", "Request canceled successfully!", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert("Error", "Failed to cancel request. Please try again.");
              }
            } catch {
              Alert.alert("Error", "Failed to cancel request. Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!item) return null;

  return (
    <ScreenWrapper>
      <View style={{ paddingHorizontal: spacingX._15 }}>
        {/* Time block */}
        <Typo size={12} color={colors.neutral400} fontFamily="InterLight">
          10:15 – 10:25 AM
        </Typo>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.status === "accepted" ? (
            <>
              <Typo size={14} color={colors.green} fontWeight="900">
                On time
              </Typo>
              <Typo size={14} color={colors.neutral300}>• Operator on route</Typo>
            </>
          ) : (
            <Typo size={14} color={colors.neutral400}>Waiting for operator to accept</Typo>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <Icons.Wrench size={16} color={colors.green} weight="bold" />
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
          <Icons.Wrench size={16} color={colors.green} weight="bold" />
        </View>

        <Typo size={13} color={colors.neutral200} style={{ marginTop: spacingY._5 }}>
          {item.status === "accepted" 
            ? `${operatorName} is on the way there.`
            : "Waiting for an operator to accept your request..."
          }
        </Typo>

        {/* Operator card - only show when accepted */}
        {item.status === "accepted" && (
          <Card style={{ marginTop: spacingY._10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Typo size={14} color={colors.white} fontWeight="800">
                  {operatorName}
                </Typo>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icons.Star size={12} color={colors.green} weight="fill" />
                  <Typo size={12} color={colors.neutral200}>5.0</Typo>
                </View>
              </View>
              <Pressable hitSlop={8} onPress={() => router.push("/(main)/message")}>
                <Icons.EnvelopeSimple size={18} color={colors.neutral300} />
              </Pressable>
            </View>
          </Card>
        )}

        {/* Route timeline */}
        <Card style={{ marginTop: spacingY._10 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Timeline rail */}
            <View style={{ alignItems: "center" }}>
              <View style={[styles.dotBig, { backgroundColor: "#3777FF" }]} />
              <View style={styles.rail} />
              <View style={[styles.dotBig, { backgroundColor: "#FF5454" }]} />
            </View>

            {/* Stops */}
            <View style={{ flex: 1, gap: 14 }}>
              {/* Current location (blue dot) */}
              <View>
                <Typo size={16} color={colors.white} fontWeight="900">
                  {locating ? "Locating…" : origin.title}
                </Typo>
                {!!origin.sub && (
                  <Typo size={12} color={colors.neutral400}>
                    {origin.sub}
                  </Typo>
                )}
              </View>

              {/* Destination */}
              <View>
                <Typo size={16} color={colors.white} fontWeight="900">
                  {item.placeName || item.title || "Iloilo Merchant Marine School"}
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  QGVM+MQ9, R-3 Rd., Cabugao Sur, Pavia, Iloilo City, 5001 Iloilo
                </Typo>
              </View>
            </View>
          </View>
        </Card>

        {/* Cancel button for pending requests */}
        {item.status === "pending" && (
          <Pressable
            onPress={handleCancelRequest}
            style={[styles.cancelBtn, loading && { opacity: 0.6 }]}
            accessibilityRole="button"
            disabled={loading}
          >
            <Typo size={14} color="#FF5A5A" fontWeight="900">
              {loading ? "Canceling..." : "Cancel Request"}
            </Typo>
          </Pressable>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#121417",
    borderRadius: (radius as any)?._15 ?? 15,
    padding: spacingY._10,
    borderWidth: 1,
    borderColor: "#23262B",
    gap: spacingY._50,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D9D9D9",
  },
  progressWrap: {
    marginTop: spacingY._7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1E2620",
    overflow: "hidden",
  },
  progressFill: {
    width: "70%",
    height: "100%",
    backgroundColor: colors.green,
  },
  dotBig: { width: 12, height: 12, borderRadius: 6 },
  rail: { width: 2, height: 64, backgroundColor: "#2A2F36", marginVertical: 7 },
  cancelBtn: {
    marginTop: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FF5A5A",
    borderRadius: (radius as any)?._12 ?? 12,
    paddingVertical: spacingY._10,
  },
});
