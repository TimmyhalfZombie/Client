import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, router } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import {
  getActivity,
  forceRefreshFromDatabase,
  bindAssistRealtimeDeletes,
} from "@/utils/activityStore";
import { ActivityItem } from "@/types";
import { getSocket } from "@/socket/socket";
import * as Icons from "phosphor-react-native";
import { useLocation } from "@/contexts/LocationContext";

const BG_CARD = "#121417";
const BG_SCREEN = "#0D0D0D";
const CANCEL_COLOR = "#FF5A5A";

// Normalize colors to plain strings
const COLOR = {
  green: colors?.green ?? "#6EFF87",
  white: colors?.white ?? "#FFFFFF",
  neutral300: colors?.neutral300 ?? "#D1D5DB",
  neutral400: colors?.neutral400 ?? "#9CA3AF",
  neutral500: colors?.neutral500 ?? "#6B7280",
};

// Minimal, stable id generator
const getItemId = (item: ActivityItem, ix?: number): string => {
  if (item.id) return item.id;
  if (typeof ix === "number") return `idx_${ix}`;
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

// Format location -> always a string (now accepts null)
const formatLocation = (
  item: ActivityItem,
  currentLocation?: { street?: string; barangay?: string; city?: string } | null
): string => {
  const parts: string[] = [];

  if (item.location) {
    const { street, barangay, city } = item.location;
    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);
  }

  if (parts.length === 0 && currentLocation) {
    const { street, barangay, city } = currentLocation;
    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);
  }

  if (parts.length > 0) return parts.join(", ");
  if (item.placeName) return item.placeName;
  if (item.title) return item.title;

  return "Location not specified";
};

// UI bits
const LeftBadge = () => (
  <View style={styles.leftBadge}>
    <Icons.Wrench size={16} color={COLOR.green} weight="fill" />
  </View>
);

const RightStatus = ({ status }: { status: ActivityItem["status"] }) => {
  if (status === "pending") return <View style={[styles.rightDot, styles.rightDotGreen]} />;
  if (status === "canceled") return <View style={[styles.rightDot, styles.rightDotRed]} />;
  return (
    <View style={styles.rightCheck}>
      <Icons.Check size={12} color={BG_SCREEN} weight="bold" />
    </View>
  );
};

export default function ActivityList() {
  const [data, setData] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const { location } = useLocation(); // type: LocationData | null

  const load = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const items = await forceRefreshFromDatabase().catch(getActivity);
      setData(Array.isArray(items) ? items : []);
    } catch {
      setError("Failed to load data");
      setData([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Silent refresh (doesn't show loading indicator)
  const silentRefresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const items = await forceRefreshFromDatabase().catch(getActivity);
      setData(Array.isArray(items) ? items : []);
      setError(null);
    } catch {
      // Silent fail for background refresh
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // Load on focus (covers initial mount + returning to screen)
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      load();
      
      return () => {
        isFocusedRef.current = false;
      };
    }, [load])
  );

  // Auto-refresh every 0.5 seconds when focused
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isFocusedRef.current) {
        silentRefresh();
      }
    }, 500); // 0.5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [silentRefresh]);

  // Bind realtime server deletes/status changes
  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const unbind = bindAssistRealtimeDeletes(socket);
    return unbind;
  }, []);

  // Show only the latest request for each status
  const newItems = useMemo(() => {
    const pendingItems = data.filter((i) => i.status === "pending");
    // Return only the most recent pending request
    return pendingItems.length > 0 ? [pendingItems[0]] : [];
  }, [data]);
  
  const recentItems = useMemo(() => {
    const nonPendingItems = data.filter((i) => i.status !== "pending");
    // Return only the most recent non-pending request
    return nonPendingItems.length > 0 ? [nonPendingItems[0]] : [];
  }, [data]);

  if (loading) {
    return (
      <ScreenWrapper style={{ paddingTop: 0 }}>
        <View style={styles.container}>
          <Typo size={28} fontWeight="900" style={{ marginBottom: spacingY._5 }}>
            <Typo size={28} fontWeight="900" color={COLOR.green}>
              Activity
            </Typo>
          </Typo>
          <View style={styles.centered}>
            <Typo size={16} color={COLOR.white} fontFamily="InterLight" fontWeight="400">
              Loading...
            </Typo>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper style={{ paddingTop: 0 }}>
        <View style={styles.container}>
          <Typo size={28} fontWeight="900" style={{ marginBottom: spacingY._5 }}>
            <Typo size={28} fontWeight="900" color={COLOR.green}>
              Activity
            </Typo>
          </Typo>
          <View style={styles.centered}>
            <Typo
              size={16}
              color={CANCEL_COLOR}
              fontFamily="InterLight"
              fontWeight="600"
              style={{ textAlign: "center" }}
            >
              Error loading data
            </Typo>
            <Typo
              size={14}
              color={COLOR.neutral500}
              fontFamily="InterLight"
              fontWeight="400"
              style={{ textAlign: "center", marginTop: spacingY._5 }}
            >
              {error}
            </Typo>
            <Pressable onPress={load} style={styles.retryButton}>
              <Typo size={14} color={COLOR.white} fontWeight="700" fontFamily="InterLight">
                Retry
              </Typo>
            </Pressable>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ paddingTop: 0 }}>
      <View style={styles.container}>
        <Typo size={28} fontWeight="900" fontFamily="Candal" style={{ marginBottom: spacingY._5 }}>
          <Typo size={28} fontWeight="900" color={COLOR.green} fontFamily="Candal">
            Activity
          </Typo>
        </Typo>

        {data.length === 0 ? (
          <View style={styles.centered}>
            <Typo
              size={16}
              color={COLOR.neutral400}
              fontFamily="InterLight"
              fontWeight="600"
              style={{ textAlign: "center" }}
            >
              No assistance requests found
            </Typo>
            <Typo
              size={14}
              color={COLOR.neutral500}
              fontFamily="InterLight"
              fontWeight="400"
              style={{ textAlign: "center", marginTop: spacingY._5 }}
            >
              Create a new request to see it here
            </Typo>
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <View>
                {newItems.length > 0 && (
                  <>
                    <Typo
                      size={16}
                      color={COLOR.white}
                      fontFamily="InterLight"
                      fontWeight="700"
                      style={{ marginBottom: spacingY._7 }}
                    >
                      Waiting...
                    </Typo>

                    {newItems.map((item, ix) => {
                      if (!item) return null;
                      const id = getItemId(item, ix);
                      return (
                        <Pressable
                          key={id}
                          onPress={() => {
                            // Only allow navigation to track screen if request is accepted
                            if (item.status === "accepted") {
                              router.push({ pathname: "/(main)/track", params: { id } });
                            }
                          }}
                          style={[
                            styles.row,
                            item.status === "pending" && styles.disabledRow
                          ]}
                          disabled={item.status === "pending"}
                        >
                          <LeftBadge />
                          <View style={{ flex: 1, marginLeft: spacingX._10 }}>
                            <Typo size={13} color={COLOR.green} fontFamily="Candal" fontWeight="600">
                              Request assistance
                            </Typo>
                            <Typo size={15} color={COLOR.white} fontWeight="700" fontFamily="InterLight">
                              {formatLocation(item, location)}
                            </Typo>
                            <Typo
                              size={12}
                              color={COLOR.neutral400}
                              fontFamily="InterLight"
                              fontWeight="300"
                              style={{ marginTop: 2 }}
                            >
                              {new Date(item.createdAt).toLocaleString()}
                            </Typo>
                          </View>
                          <RightStatus status={item.status} />
                        </Pressable>
                      );
                    })}
                    <View style={{ height: spacingY._12 }} />
                  </>
                )}

                <Typo
                  size={16}
                  color={COLOR.white}
                  fontFamily="InterLight"
                  fontWeight="700"
                  style={{ marginBottom: spacingY._7 }}
                >
                  Recent
                </Typo>
              </View>
            }
            data={recentItems}
            keyExtractor={(i, ix) => i ? getItemId(i, ix) : `undefined_${ix}`}
            contentContainerStyle={{ paddingBottom: spacingY._20 }}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={load}
                tintColor="black"
                colors={["black"]}
                progressBackgroundColor="white"
                progressViewOffset={0}
              />
            }
            renderItem={({ item, index }) => {
              if (!item) return null;
              const id = getItemId(item, index);
              const isCanceled = item.status === "canceled";
              return (
                <View style={styles.row}>
                  <LeftBadge />
                  <View style={{ flex: 1, marginLeft: spacingX._10 }}>
                    <Typo size={15} color={COLOR.white} fontWeight="700" fontFamily="InterLight">
                      {formatLocation(item, location)}
                    </Typo>

                    <Typo
                      size={12}
                      color={COLOR.neutral400}
                      fontFamily="InterLight"
                      fontWeight="300"
                      style={{ marginTop: 2 }}
                    >
                      {new Date(item.createdAt).toLocaleString()}
                    </Typo>

                    {!isCanceled && (
                      <Pressable
                        onPress={() => router.push({ pathname: "/(main)/rate", params: { id } })}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                        accessibilityRole="button"
                      >
                        <Typo size={12} color={COLOR.neutral300} fontFamily="InterLight" fontWeight="400">
                          Rate
                        </Typo>
                        <Icons.ArrowRight size={14} color={COLOR.neutral300} />
                      </Pressable>
                    )}

                    {isCanceled && (
                      <Typo
                        size={12}
                        color={CANCEL_COLOR}
                        fontFamily="InterLight"
                        style={{ marginTop: 4 }}
                        fontWeight="600"
                      >
                        Request canceled
                      </Typo>
                    )}
                  </View>
                  <RightStatus status={item.status} />
                </View>
              );
            }}
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_SCREEN, paddingHorizontal: spacingX._15 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacingY._20,
  },
  retryButton: {
    marginTop: spacingY._10,
    backgroundColor: COLOR.green,
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._8,
    borderRadius: (radius as any)._12 ?? 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG_CARD,
    borderRadius: (radius as any)._15 ?? 15,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._10,
    marginBottom: spacingY._7,
  },
  leftBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLOR.green,
    backgroundColor: "#0F1115",
  },
  rightDot: { width: 10, height: 10, borderRadius: 5 },
  rightDotGreen: { backgroundColor: COLOR.green },
  rightDotRed: { backgroundColor: CANCEL_COLOR },
  rightCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLOR.green,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledRow: {
    opacity: 0.6,
  },
});
