import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: "#0B0B0B" }, // avoid white flashes on dark theme
      }}
    >
      {/* Auth screens */}
      <Stack.Screen name="login" options={{ animation: "fade" }} />
      <Stack.Screen name="signup" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="forgotpassword" options={{ animation: "slide_from_right" }} />

      {/* Loading screen shown after first create-account */}
      <Stack.Screen
        name="patchup"
        options={{
          headerShown: false,
          animation: "fade", // quick in/out, feels like a splash
          // If you ever want to block swipe-back here, uncomment:
          // gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
