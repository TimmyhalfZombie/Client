// app/_layout.tsx
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { tokens } from '../src/auth/tokenStore';
import { DeclinedRequestsProvider } from '../src/contexts/DeclinedRequestsContext';
import { useImmersiveMode } from '../src/hooks/useImmersiveMode';
import { onNotificationResponse } from '../src/services/notificationService';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require('../assets/fonts/Candal-Regular.ttf'),
    'Inter-Black': require('../assets/fonts/static/Inter_18pt-Black.ttf'),
    'Inter-Medium': require('../assets/fonts/static/Inter_18pt-Medium.ttf'),
    'Inter-Regular': require('../assets/fonts/static/Inter_18pt-Regular.ttf'),
  });

  const [authReady, setAuthReady] = useState(false);

  // Enable immersive mode
  useImmersiveMode();

  // Load persisted tokens once on app start
  useEffect(() => {
    (async () => {
      try {
        await tokens.initTokens();
        const uid = await tokens.getUserIdAsync();
        console.log('[auth] ready; userId =', uid);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // Route when a notification is tapped
  useEffect(() => {
    const unsub = onNotificationResponse((resp) => {
      const data: any = resp.notification.request.content.data || {};
      if (data?.type === 'chat' && data?.conversationId) {
        const params: Record<string, string> = { id: String(data.conversationId) };
        if (typeof data?.name === 'string' && data.name.trim()) {
          params.name = data.name.trim();
        }
        router.push({ pathname: '/(tabs)/chat/[id]', params });
      } else if (data?.type === 'assist' && data?.requestId) {
        router.push({ pathname: '/ongoing-detail', params: { id: String(data.requestId) } });
      }
    });
    return () => unsub();
  }, []);

  const ready = fontsLoaded && authReady;

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <DeclinedRequestsProvider>
      <StatusBar style="light" hidden={false} />
      <Stack screenOptions={{ headerShown: false }} onLayout={onLayoutRootView} />
    </DeclinedRequestsProvider>
  );
}
