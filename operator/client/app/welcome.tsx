import { router } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Welcome() {
  const insets = useSafeAreaInsets();

  // ⏱️ Auto-handoff to Home after 2s
  useEffect(() => {
    const t = setTimeout(() => router.replace("/(auth)/login"), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      {/* Brand */}
      <Text style={styles.brand}>
        <Text style={styles.brandGreen}>patch</Text>
        <Text style={styles.brandWhite}> up</Text>
      </Text>

      {/* Tagline pinned to safe bottom */}
      <View style={[styles.taglineWrap, { bottom: insets.bottom + 16 }]}>
        <Text style={styles.tagline}>Vulcanize Anytime, Anywhere</Text>
      </View>
    </View>
  );
}

// app/welcome.tsx (only the styles changed)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  brand: {
    fontSize: 44,
    textAlign: "center",
    fontFamily: "Candal",
  },
  brandGreen: { color: "#6EFF87", fontFamily: "Candal" },
  brandWhite: { color: "#FFFFFF", fontFamily: "Candal" },
  taglineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tagline: {
    color: "#B9B9B9",
    fontSize: 14,
    fontFamily: "Inter",      // ✅ Inter for the tagline
  },
});
