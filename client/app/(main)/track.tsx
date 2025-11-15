import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import { getActivity } from "@/utils/activityStore";
import { ActivityItem } from "@/types";
import assistService from "@/services/assistService";
import * as Icons from "phosphor-react-native";
import { useCurrentAddress } from "@/hooks/useCurrentAddress";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants";

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
  const [operatorUsername, setOperatorUsername] = useState<string | null>(null);
  const [operatorInitialAddress, setOperatorInitialAddress] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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

  // Fetch operator data from appdb using acceptedBy
  useEffect(() => {
    if (!item || item.status !== "accepted") {
      setOperatorUsername(null);
      setOperatorInitialAddress(null);
      return;
    }

    const assistId = String(item.meta?.assistId || item.id);
    if (!assistId) return;

    (async () => {
      try {
        // Fetch assist request to get acceptedBy
        const assistRequest = await assistService.fetchAssistRequestById(assistId);
        if (!assistRequest) return;

        // Get operator ID from acceptedBy or assignedTo
        const acceptedBy = (assistRequest as any)?.acceptedBy;
        const assignedTo = (assistRequest as any)?.assignedTo;
        const operatorId = acceptedBy 
          ? (typeof acceptedBy === "string" ? acceptedBy : acceptedBy._id || acceptedBy.id)
          : (assignedTo ? (typeof assignedTo === "string" ? assignedTo : assignedTo._id || assignedTo.id) : null);
        
        if (!operatorId) {
          // Fallback: try to get from meta
          const op = (item?.meta as any)?.operator;
          if (op?.username) {
            const username = op.username.trim();
            if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
              setOperatorUsername(username);
            }
          }
          const loc = (item?.meta as any)?.operatorLocation;
          if (loc?.address) {
            setOperatorInitialAddress(loc.address.trim());
          }
          return;
        }

        // Fetch operator from appdb - try multiple endpoints
        const token = await AsyncStorage.getItem("token");
        const endpoints = [
          `/api/app/users/${operatorId}`,
          `/api/operators/${operatorId}`,
          `/api/users/${operatorId}`,
        ];

        let operatorData = null;
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(`${API_URL}${endpoint}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (response.ok) {
              operatorData = await response.json();
              break;
            }
          } catch (err) {
            // Try next endpoint
            continue;
          }
        }

        if (operatorData) {
          const data = operatorData.data || operatorData;
          
          if (data?.username) {
            const username = data.username.trim();
            if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
              setOperatorUsername(username);
            }
          }
          
          if (data?.initial_address) {
            const address = data.initial_address.trim();
            if (address) {
              setOperatorInitialAddress(address);
            }
          }
        } else {
          // Fallback: try to get from meta if API fails
          const op = (item?.meta as any)?.operator;
          if (op?.username) {
            const username = op.username.trim();
            if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
              setOperatorUsername(username);
            }
          }
          const loc = (item?.meta as any)?.operatorLocation;
          if (loc?.address) {
            setOperatorInitialAddress(loc.address.trim());
          }
        }
      } catch (error) {
        console.error("Error fetching operator from appdb:", error);
        // Fallback: try to get from meta
        const op = (item?.meta as any)?.operator;
        if (op?.username) {
          const username = op.username.trim();
          if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
            setOperatorUsername(username);
          }
        }
        const loc = (item?.meta as any)?.operatorLocation;
        if (loc?.address) {
          setOperatorInitialAddress(loc.address.trim());
        }
      }
    })();
  }, [item]);

  const operatorName = useMemo(() => {
    const name = (item?.meta as any)?.operator?.name;
    // Always return "Operator" if name is missing or is test data like "CJBLACK"
    if (!name || 
        name.trim() === "" || 
        name.trim().toUpperCase() === "CJBLACK" || 
        name.trim().toLowerCase() === "cjblack") {
      return "Operator";
    }
    return name.trim();
  }, [item]);

  const operatorAvatar = useMemo(
    () => ((item?.meta as any)?.operator?.avatar ?? null),
    [item]
  );

  // Get operator location from meta (stored when request was accepted)
  const operatorLocation = useMemo(() => {
    return (item?.meta as any)?.operatorLocation || null;
    
  }, [item]);
  
  // Get operator username/fullName for display
  const operatorDisplayName = useMemo(() => {
    const op = (item?.meta as any)?.operator;
    if (!op) return "Operator";
    // Prefer fullName, then name, then username
    const name = op.fullName || op.name || op.username;
    if (!name || name.trim().toUpperCase() === "CJBLACK" || name.trim().toLowerCase() === "cjblack") {
      return "Operator";
    }
    return name.trim();
  }, [item]);


  // Format destination address from item data
  const destinationAddress = useMemo(() => {
    if (item?.placeName) return item.placeName;
    if (item?.location) {
      const parts: string[] = [];
      if (item.location.street) parts.push(item.location.street);
      if (item.location.barangay) parts.push(item.location.barangay);
      if (item.location.city) parts.push(item.location.city);
      if (parts.length > 0) return parts.join(", ");
    }
    if (item?.title) return item.title;
    return "Destination";
  }, [item]);

  // Split destination address for display
  const destination = useMemo(() => splitAddress(destinationAddress), [destinationAddress]);

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
    <ScreenWrapper style={{ paddingTop: 0 }}>
      <View style={{ paddingHorizontal: spacingX._15 }}>
        {/* Back Button */}
        <View style={{ marginTop: Math.max(0, insets.top - 8), marginBottom: spacingY._5 }}>
          <BackButton />
        </View>

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
            ? `${operatorDisplayName} is on the way there.`
            : "Waiting for an operator to accept your request..."
          }
        </Typo>

        {/* Operator card - only show when accepted (not when completed) */}
        {item.status === "accepted" && (
          <Card style={{ marginTop: spacingY._10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar uri={operatorAvatar} size={36} />
              <View style={{ flex: 1 }}>
                <Typo size={14} color={colors.white} fontWeight="800">
                  {operatorDisplayName}
                </Typo>
                {operatorLocation?.address && (
                  <Typo size={11} color={colors.neutral400} style={{ marginTop: 2 }}>
                    {operatorLocation.address}
                  </Typo>
                )}
              </View>
              <Pressable hitSlop={8} onPress={() => router.push("/(main)/message")}>
                <Icons.EnvelopeSimple size={18} color={colors.neutral300} />
              </Pressable>
            </View>
          </Card>
        )}

        {/* Route timeline */}
        <Card style={{ marginTop: spacingY._20 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Timeline rail */}
            <View style={{ alignItems: "center" }}>
              <View style={[styles.dotBig, { backgroundColor: "#3777FF" }]} />
              <View style={styles.rail} />
              {/* Red dot for operator at the bottom */}
              {operatorUsername && operatorInitialAddress && item.status === "accepted" ? (
                <View style={[styles.dotBig, { backgroundColor: "#FF5454" }]} />
              ) : null}
            </View>

            {/* Stops */}
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
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

              {/* Operator location (red dot) - at the bottom, aligned with red dot */}
              {operatorUsername && operatorInitialAddress && item.status === "accepted" && (
                <View style={{ marginTop: spacingY._40, paddingTop: spacingY._20}}>
                  <Typo size={16} color={colors.white} fontWeight="900">
                    {operatorUsername}
                  </Typo>
                  <Typo size={12} color={colors.neutral400}>
                    {operatorInitialAddress}
                  </Typo>
                </View>
              )}
            </View>
          </View>
        </Card>

     
    
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
  rail: { width: 2, height: 120, backgroundColor: "#2A2F36", marginVertical: 10 },
 
});
