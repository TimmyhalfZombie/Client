import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import { getActivity, ActivityItem } from "@/utils/activityStore";
import assistService from "@/services/assistService";
import * as Icons from "phosphor-react-native";

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Stars = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <View style={styles.stars}>
    {[1,2,3,4,5].map(n => (
      <Pressable key={n} onPress={() => onChange(n)} hitSlop={8} style={{ padding: 2 }}>
        {value >= n
          ? <Icons.Star size={20} color={colors.green} weight="fill" />
          : <Icons.Star size={20} color={colors.neutral500} />
        }
      </Pressable>
    ))}
  </View>
);

export default function RateActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ActivityItem | null>(null);
  const [rating, setRating] = useState(4);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const items = await getActivity();
      setItem(items.find(i => i.id === id) || null);
    })();
  }, [id]);

  const handleSaveRating = async () => {
    if (!item) return;
    
    setLoading(true);
    try {
      const success = await assistService.rateAssistRequest(item.id, rating);
      if (success) {
        Alert.alert("Success", "Rating saved successfully!", [
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        Alert.alert("Error", "Failed to save rating. Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save rating. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <ScreenWrapper>
      <View style={{ paddingHorizontal: spacingX._15 }}>
        <Typo size={12} color={colors.neutral400} fontFamily="InterLight">
          10:15 – 10:25 AM
        </Typo>
        <Typo size={14} color={colors.neutral200} style={{ marginBottom: spacingY._7 }}>Repaired</Typo>

        {/* Rating callout */}
        <Card>
          <Typo size={14} color={colors.neutral200} style={{ marginBottom: spacingY._5 }}>
            Help Us Improve — Rate the Operator
          </Typo>
          <Stars value={rating} onChange={setRating} />
        </Card>

        {/* Operator card */}
        <Card style={{ marginTop: spacingY._10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Typo size={14} color={colors.white} fontWeight="800">Christian John Duque</Typo>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.tinyDot, { backgroundColor: colors.green }]} />
                <Typo size={12} color={colors.neutral200}>5.0</Typo>
              </View>
            </View>
            <Pressable hitSlop={8}>
              <Icons.EnvelopeSimple size={18} color={colors.neutral300} />
            </Pressable>
          </View>
        </Card>

        {/* Route timeline */}
        <Card style={{ marginTop: spacingY._10 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center" }}>
              <View style={[styles.dotBig, { backgroundColor: "#3777FF" }]} />
              <View style={styles.rail} />
              <View style={[styles.dotBig, { backgroundColor: "#FF5454" }]} />
            </View>
            <View style={{ flex: 1, gap: 14 }}>
              <View>
                <Typo size={16} color={colors.white} fontWeight="900">Balabag, Pavia</Typo>
                <Typo size={12} color={colors.neutral400}>QG6Q+G26, Pavia, Iloilo City, 5001 Iloilo</Typo>
              </View>
              <View>
                <Typo size={16} color={colors.white} fontWeight="900">
                  {item.placeName || item.title || "Iloilo Merchant Marine School"}
                </Typo>
                <Typo size={12} color={colors.neutral400}>QGVM+MQ9, R-3 Rd., Cabugao Sur, Pavia, Iloilo City</Typo>
              </View>
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
          <Typo size={14} color="#0D0D0D" fontWeight="900">
            {loading ? "Saving..." : "Save Rating"}
          </Typo>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#121417",
    borderRadius: radius._15,
    padding: spacingY._10,
    borderWidth: 1,
    borderColor: "#23262B",
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#D9D9D9" },
  tinyDot: { width: 6, height: 6, borderRadius: 3 },
  dotBig: { width: 12, height: 12, borderRadius: 6 },
  rail: { width: 2, height: 64, backgroundColor: "#2A2F36", marginVertical: 4 },
  stars: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveBtn: {
    marginTop: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderRadius: radius._12 || 12,
    paddingVertical: spacingY._10,
  },
});
