// app/(main)/rate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import { getActivity } from "@/utils/activityStore";
import { ActivityItem } from "@/types";
import assistService from "@/services/assistService";
import * as Icons from "phosphor-react-native";
import BackButton from "@/components/BackButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCurrentAddress } from "@/hooks/useCurrentAddress";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants";

import { useOperatorForAssist } from "@/hooks/useOperatorForAssist";

const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Stars = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <View style={styles.stars}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Pressable key={n} onPress={() => onChange(n)} hitSlop={8} style={{ padding: 2 }}>
        {value >= n ? (
          <Icons.Star size={20} color={colors.green} weight="fill" />
        ) : (
          <Icons.Star size={20} color={colors.neutral500} />
        )}
      </Pressable>
    ))}
  </View>
);

/* ---------------- helpers ---------------- */
async function authGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json().catch(() => ({}));
  return json?.data ?? json;
}


function splitAddress(a?: string | null) {
  const txt = (a || "").trim();
  if (!txt) return { title: "", sub: "" };
  const parts = txt.split(",");
  return { title: (parts[0] || "").trim(), sub: parts.slice(1).join(", ").trim() };
}
/* ------------------------------------------ */

export default function RateActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { address: customerAddress } = useCurrentAddress();

  const [item, setItem] = useState<ActivityItem | null>(null);
  const [rating, setRating] = useState(4);
  const [loading, setLoading] = useState(false);

  // Resolve the activity first
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

  // AssistId to drive operator lookup/socket
  const assistId = useMemo(
    () => (item ? String(item.meta?.assistId || item.id) : undefined),
    [item]
  );

  // Live operator (socket + details) from your provided hook
  const { name: nameFromHook, location: locFromHook } = useOperatorForAssist(assistId);

  // Local state we’ll fill from hook -> REST fallbacks
  const [opName, setOpName] = useState<string | null>(null);
  const [opAddr, setOpAddr] = useState<string | null>(null);

  // Helper to filter out test data like CJBLACK
  const normalizeOperatorName = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const trimmed = name.trim();
    if (trimmed === "" || 
        trimmed.toUpperCase() === "CJBLACK" || 
        trimmed.toLowerCase() === "cjblack") {
      return "Operator";
    }
    return trimmed;
  };

  // 1) Adopt socket/hook data immediately (fastest path)
  useEffect(() => {
    if (nameFromHook) setOpName(normalizeOperatorName(nameFromHook));
    if (locFromHook?.address) setOpAddr(locFromHook.address);
  }, [nameFromHook, locFromHook?.address]);

  // 2) REST fallbacks (covers cases when socket didn’t provide name/address)
  useEffect(() => {
    if (!assistId) return;

    (async () => {
      try {
        // fetch assist to discover operator id (string or populated object)
        const a = await assistService.fetchAssistRequestById(assistId);
        const rawOp = (a as any)?.assignedTo || (a as any)?.operator;
        const operatorId =
          typeof rawOp === "string" ? rawOp : rawOp?._id || rawOp?.id;

        // try to use populated name if available
        const populatedName =
          typeof rawOp === "object" && (rawOp?.name || rawOp?.username || rawOp?.fullName);
        if (populatedName && !opName) setOpName(normalizeOperatorName(String(populatedName)));

        if (!operatorId) return;

        // profile — try several likely endpoints
        if (!opName) {
          const profilePaths = [
            `/api/users/${operatorId}`,
            `/api/operators/${operatorId}`,
            `/operators/${operatorId}`,
            `/api/app/users/${operatorId}`,
          ];
          for (const p of profilePaths) {
            try {
              const prof = await authGet(p);
              const nm =
                prof?.name || prof?.username || prof?.fullName || prof?.displayName;
              if (nm) {
                setOpName(normalizeOperatorName(String(nm)));
                break;
              }
            } catch {}
          }
        }

        // location — try several endpoints, then reverse-geocode
        if (!opAddr) {
          const locPaths = [
            `/api/users/${operatorId}/location`,
            `/api/operators/${operatorId}/location`,
            `/operators/${operatorId}/location`,
          ];
          let lat: number | null = null;
          let lng: number | null = null;
          let addr: string | null = null;

          for (const p of locPaths) {
            try {
              const loc = await authGet(p);
              lat = Number(loc?.lat ?? loc?.latitude);
              lng = Number(loc?.lng ?? loc?.longitude);
              addr = (loc?.address as string) || null;
              if ((addr && addr.length) || (Number.isFinite(lat) && Number.isFinite(lng))) break;
            } catch {}
          }

          if (addr) {
            setOpAddr(addr);
          }
        }
      } catch {}
    })();
  }, [assistId, opName, opAddr]);

  // Fallback: try to get operator name from item.meta if not loaded yet
  useEffect(() => {
    if (!opName && item?.meta?.operator?.name) {
      setOpName(normalizeOperatorName((item.meta as any).operator.name));
    }
  }, [item, opName]);

  // Get operator username and initial_address from appdb (using acceptedBy)
  const [operatorUsername, setOperatorUsernameFromAppdb] = useState<string | null>(null);
  const [operatorInitialAddress, setOperatorInitialAddressFromAppdb] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !assistId) {
      setOperatorUsernameFromAppdb(null);
      setOperatorInitialAddressFromAppdb(null);
      return;
    }

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
              setOperatorUsernameFromAppdb(username);
            }
          }
          const loc = (item?.meta as any)?.operatorLocation;
          if (loc?.address) {
            setOperatorInitialAddressFromAppdb(loc.address.trim());
          }
          return;
        }

        // Fetch operator from appdb
        const token = await AsyncStorage.getItem("token");
        const response = await fetch(`${API_URL}/api/app/users/${operatorId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (response.ok) {
          const operatorData = await response.json();
          const data = operatorData.data || operatorData;
          
          if (data?.username) {
            const username = data.username.trim();
            if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
              setOperatorUsernameFromAppdb(username);
            }
          }
          
          if (data?.initial_address) {
            const address = data.initial_address.trim();
            if (address) {
              setOperatorInitialAddressFromAppdb(address);
            }
          }
        } else {
          // Fallback: try to get from meta if API fails
          const op = (item?.meta as any)?.operator;
          if (op?.username) {
            const username = op.username.trim();
            if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
              setOperatorUsernameFromAppdb(username);
            }
          }
          const loc = (item?.meta as any)?.operatorLocation;
          if (loc?.address) {
            setOperatorInitialAddressFromAppdb(loc.address.trim());
          }
        }
      } catch (error) {
        console.error("Error fetching operator from appdb:", error);
        // Fallback: try to get from meta
        const op = (item?.meta as any)?.operator;
        if (op?.username) {
          const username = op.username.trim();
          if (username && username.toUpperCase() !== "CJBLACK" && username.toLowerCase() !== "cjblack") {
            setOperatorUsernameFromAppdb(username);
          }
        }
        const loc = (item?.meta as any)?.operatorLocation;
        if (loc?.address) {
          setOperatorInitialAddressFromAppdb(loc.address.trim());
        }
      }
    })();
  }, [item, assistId]);

  const handleSaveRating = async () => {
    if (!item) return;
    const aId = String(item.meta?.assistId || item.id);
    setLoading(true);
    try {
      const ok = await assistService.rateAssistRequest(aId, rating);
      if (ok) {
        Alert.alert("Success", "Rating saved successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", "Failed to save rating. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Failed to save rating. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  // Customer current address (top / blue)
  const { title: custTitle, sub: custSub } = splitAddress(customerAddress);

  // Operator current address (bottom / red) — we accept either name or address being present
  const { title: opTitle, sub: opSub } = splitAddress(opAddr || "");

  return (
    <ScreenWrapper style={{ paddingTop: 0 }}>
      <View style={styles.screenPad}>
        {/* Back */}
        <View style={{ marginTop: Math.max(0, insets.top - 8), marginBottom: spacingY._5 }}>
          <BackButton />
        </View>

        {/* Time + status */}
        <View style={styles.sectionTight}>
          <Typo size={12} color={colors.neutral400} fontFamily="InterLight">
            10:15 – 10:25 AM
          </Typo>
          <Typo size={20} color={colors.neutral200} fontWeight="900" style={{ marginTop: 4 }}>
            Repaired
          </Typo>
        </View>

        {/* Rating */}
        <Card style={styles.section}>
          <Typo size={16} color={colors.neutral200} fontWeight="900" style={{ marginBottom: spacingY._5 }}>
            Help Us Improve — Rate the Operator
          </Typo>
          <Stars value={rating} onChange={setRating} />
        </Card>

        {/* Operator card — only when we have a real name */}
        {opName ? (
          <Card style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Typo size={16} color={colors.white} fontWeight="900">
                  {opName}
                </Typo>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.tinyDot, { backgroundColor: colors.green }]} />
                  <Typo size={12} color={colors.neutral200}>5.0</Typo>
                </View>
              </View>
              <Pressable hitSlop={8} onPress={() => router.push("/(main)/message")}>
                <Icons.EnvelopeSimple size={20} color={colors.neutral300} />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Timeline: CUSTOMER (blue) → OPERATOR (red) */}
        <Card style={styles.section}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Rail */}
            <View style={{ alignItems: "center" }}>
              <View style={[styles.dotBig, { backgroundColor: "#3777FF" }]} />
              <View style={styles.rail} />
              {/* Red dot for operator at the bottom */}
              {operatorUsername && operatorInitialAddress ? (
                <View style={[styles.dotBig, { backgroundColor: "#FF5454" }]} />
              ) : null}
            </View>

            {/* Stops */}
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              {/* Customer current location */}
              <View>
                <Typo size={16} color={colors.white} fontWeight="900">
                  {custTitle || "Current location"}
                </Typo>
                {!!custSub && <Typo size={12} color={colors.neutral400}>{custSub}</Typo>}
              </View>

              {/* Operator username and initial_address from appdb (red dot) - at the bottom */}
              {operatorUsername && operatorInitialAddress && (
                <View style={{ marginTop: spacingY._40, paddingTop: spacingY._20 }}>
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

        {/* Save */}
        <Pressable
          onPress={handleSaveRating}
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          accessibilityRole="button"
          disabled={loading}
        >
          <Typo size={16} color="#0D0D0D" fontWeight="900">
            {loading ? "Saving..." : "Save Rating"}
          </Typo>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: spacingX._15,
    paddingBottom: spacingY._20,
  },
  sectionTight: { marginTop: spacingY._5 },
  section: { marginTop: spacingY._10 },
  card: {
    backgroundColor: "#121417",
    borderRadius: (radius as any)?._15 ?? 15,
    padding: spacingY._10,
    borderWidth: 1,
    borderColor: "#23262B",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#D9D9D9" },
  tinyDot: { width: 6, height: 6, borderRadius: 3 },
  dotBig: { width: 12, height: 12, borderRadius: 6 },
  rail: { width: 2, height: 150, backgroundColor: "#2A2F36", marginVertical: 4 },
  stars: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveBtn: {
    marginTop: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderRadius: (radius as any)?._12 ?? 12,
    paddingVertical: spacingY._10,
  },
});
