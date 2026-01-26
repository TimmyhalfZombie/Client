// app/(tabs)/activity.tsx
import { useIsFocused } from "@react-navigation/native";
import React from "react";
import { useInboxNotifications } from "../../src/features/useInboxNotifications";
import ActivityScreen from "../../src/screens/ActivityScreen";

export default function ActivityRoute() {
  const isFocused = useIsFocused();

  // Ask for permission and show a local notification when new pending
  // requests appear in the inbox; only while this tab is focused.
  useInboxNotifications(isFocused);

  return <ActivityScreen />;
}
