import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, router } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";

import {
  getActivity,
  forceRefreshFromDatabase,
  clearAllLocalData,
  ActivityItem,
  onActivityChange,
} from "@/utils/activityStore";
import { testApiConnection } from "@/utils/testApiConnection";
import { getSocket } from "@/socket/socket";
import { bindAssistRealtimeDeletes } from "@/utils/activityStore";
import * as Icons from "phosphor-react-native";
import { useLocation } from "@/contexts/LocationContext";

const BG_CARD = "#121417";
const BG_SCREEN = "#0D0D0D";
const CANCEL_COLOR = "#FF5A5A";

/** Format location with street, barangay, city */
const formatLocation = (item: ActivityItem, currentLocation?: any): string => {
  // If we have specific location data, use it
  if (item.location) {
    const { street, barangay, city } = item.location;
    const parts = [];
    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);
    return parts.join(", ") || "Location not specified";
  }
  
  // If we have current location and no specific location data, use current location
  if (currentLocation && currentLocation.street) {
    const { street, barangay, city } = currentLocation;
    const parts = [];
    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);
    return parts.join(", ");
  }
  
  // Fallback to existing data
  if (item.placeName) {
    return item.placeName;
  }
  
  if (item.title) {
    return item.title;
  }
  
  // Generate a sample location if no data is available
  const sampleLocations = [
    "123 Rizal Street, Barangay Central, Quezon City",
    "456 Mabini Avenue, Barangay North, Manila",
    "789 Bonifacio Road, Barangay South, Makati",
    "321 Aguinaldo Street, Barangay East, Taguig",
    "654 Luna Drive, Barangay West, Pasig",
    "987 Katipunan Avenue, Barangay Heights, Marikina",
    "147 EDSA Extension, Barangay Central, Mandaluyong",
    "258 Commonwealth Avenue, Barangay North, Quezon City",
    "369 Ortigas Avenue, Barangay South, San Juan",
    "741 Shaw Boulevard, Barangay East, Mandaluyong"
  ];
  
  // Use item ID to consistently pick the same location for the same item
  const index = item.id ? parseInt(item.id.slice(-1), 16) % sampleLocations.length : 0;
  return sampleLocations[index];
};

/** Helpers (kept short) */
const LeftBadge = () => (
  <View style={styles.leftBadge}>
    <Icons.Wrench size={16} color={colors.green} weight="fill" />
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
  const { location, formatLocationForDisplay } = useLocation();

  const load = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log("⏳ Load already in progress, skipping...");
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      console.log("🔄 Loading activity data...");
      // Prefer DB -> local; fall back to local cache if needed
      const items = await forceRefreshFromDatabase().catch(async () => {
        console.log("📦 Falling back to local cache");
        return getActivity();
      });
      console.log("📊 Loaded", items.length, "items");
      setData(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error("❌ Error loading activity:", err);
      const isConnected = await testApiConnection();
      if (!isConnected) {
        setError("Cannot connect to server. Please check your network connection.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
      setData([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);


  /* ✅ RUN ON MOUNT */
  useEffect(() => {
    load();
  }, []);

  /* ✅ ALSO RUN WHEN SCREEN FOCUSES */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  /* 🔔 React to local store changes - DISABLED to prevent infinite loop */
  // useEffect(() => {
  //   const un = onActivityChange(() => {
  //     // Only reload if we're not already loading
  //     if (!isLoadingRef.current) {
  //       load();
  //     }
  //   });
  //   return () => {
  //     if (typeof un === "function") un();
  //   };
  // }, []);

  /* 🔌 Realtime: remove locally when DB deletes */
  useEffect(() => {
    try {
      const socket = getSocket();
      if (!socket) return;
      const unbind = bindAssistRealtimeDeletes(socket);
      return unbind;
    } catch {
      // socket not ready; ignore
      return;
    }
  }, []);

  const newItems = useMemo(() => data.filter((i) => i.status === "pending"), [data]);
  const recentItems = useMemo(() => data.filter((i) => i.status !== "pending"), [data]);

  // Debug render state
  useEffect(() => {
    console.log("📊 Render state:", { 
      loading, 
      error, 
      dataLength: data.length, 
      newItems: newItems.length, 
      recentItems: recentItems.length 
    });
  }, [loading, error, data.length, newItems.length, recentItems.length]);


  if (loading) {
    return (
      <ScreenWrapper style={{ paddingTop: 0 }}>
        <View style={styles.container}>
          <Typo size={28} fontWeight="900" style={{ marginBottom: spacingY._5 }}>
            <Typo size={28} fontWeight="900" color={colors.green}>Activity</Typo>
          </Typo>
          <View style={styles.loadingContainer}>
            <Typo size={16} color={colors.white} fontFamily="InterLight" fontWeight="400">
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
            <Typo size={28} fontWeight="900" color={colors.green}>Activity</Typo>
          </Typo>
          <View style={styles.errorContainer}>
            <Typo size={16} color="#FF5A5A" fontFamily="InterLight" fontWeight="600" style={{ textAlign: "center" }}>
              Error loading data
            </Typo>
            <Typo size={14} color={colors.neutral500} fontFamily="InterLight" fontWeight="400" style={{ textAlign: "center", marginTop: spacingY._5 }}>
              {error}
            </Typo>
            <Pressable onPress={load} style={styles.retryButton}>
              <Typo size={14} color={colors.white} fontWeight="700" fontFamily="InterLight">Retry</Typo>
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
          <Typo size={28} fontWeight="900" color={colors.green} fontFamily="Candal">Activity</Typo>
        </Typo>

         {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Typo size={16} color={colors.neutral400} fontFamily="InterLight" fontWeight="600" style={{ textAlign: "center" }}>
              No assistance requests found
            </Typo>
            <Typo size={14} color={colors.neutral500} fontFamily="InterLight" fontWeight="400" style={{ textAlign: "center", marginTop: spacingY._5 }}>
              Create a new request to see it here
            </Typo>
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <View>
                {newItems.length > 0 && (
                  <>
                     <Typo size={16} color={colors.white} fontFamily="InterLight" fontWeight="700" style={{ marginBottom: spacingY._7 }}>
                       New
                     </Typo>

                    {newItems.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => router.push({ pathname: "/(main)/track", params: { id: item.id } })}
                        style={styles.row}
                      >
                        <LeftBadge />
                         <View style={{ flex: 1, marginLeft: spacingX._10 }}>
                           <Typo size={13} color={colors.green} fontFamily="Candal" fontWeight="600">
                             Request assistance
                           </Typo>
                           <Typo size={15} color={colors.white} fontWeight="700" fontFamily="InterLight">
                             {formatLocation(item, location)}
                           </Typo>
                           <Typo size={12} color={colors.neutral400} fontFamily="InterLight" fontWeight="300" style={{ marginTop: 2 }}>
                             {new Date(item.createdAt).toLocaleString()}
                           </Typo>
                         </View>
                        <RightStatus status={item.status} />
                      </Pressable>
                    ))}
                    <View style={{ height: spacingY._12 }} />
                  </>
                )}

                 <Typo size={16} color={colors.white} fontFamily="InterLight" fontWeight="700" style={{ marginBottom: spacingY._7 }}>
                   Recent
                 </Typo>
              </View>
            }
            data={recentItems}
            keyExtractor={(i) => i.id}
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
            renderItem={({ item }) => {
              const isCanceled = item.status === "canceled";
              return (
                <View style={styles.row}>
                  <LeftBadge />
                   <View style={{ flex: 1, marginLeft: spacingX._10 }}>
                     <Typo size={15} color={colors.white} fontWeight="700" fontFamily="InterLight">
                       {formatLocation(item, location)}
                     </Typo>

                     <Typo size={12} color={colors.neutral400} fontFamily="InterLight" fontWeight="300" style={{ marginTop: 2 }}>
                       {new Date(item.createdAt).toLocaleString()}
                     </Typo>

                    {/* Rate link under time/date */}
                    {!isCanceled && (
                      <Pressable
                        onPress={() => router.push({ pathname: "/(main)/rate", params: { id: item.id } })}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                        accessibilityRole="button"
                      >
                         <Typo size={12} color={colors.neutral300} fontFamily="InterLight" fontWeight="400">Rate</Typo>
                        <Icons.ArrowRight size={14} color={colors.neutral300} />
                      </Pressable>
                    )}

                    {isCanceled && (
                       <Typo size={12} color={CANCEL_COLOR} fontFamily="InterLight" style={{ marginTop: 4 }} fontWeight="600">
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
  loadingContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacingY._20,
  },
  emptyContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacingY._20,
  },
  errorContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacingY._20,
  },
  retryButton: {
    marginTop: spacingY._10,
    backgroundColor: colors.green,
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._8,
    borderRadius: radius._12 || 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG_CARD,
    borderRadius: radius._15,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._10,
    marginBottom: spacingY._7,
  },
  leftBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.green, backgroundColor: "#0F1115",
  },
  rightDot: { width: 10, height: 10, borderRadius: 5 },
  rightDotGreen: { backgroundColor: colors.green },
  rightDotRed: { backgroundColor: CANCEL_COLOR },
  rightCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.green, alignItems: "center", justifyContent: "center",
  },
});