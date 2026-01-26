import { Tabs, useSegments } from 'expo-router';
import React from 'react';
import CurvedTabBar from '../../src/components/CurvedTabBar';
import { ActivityBadgeProvider, useActivityBadge } from '../../src/contexts/ActivityBadgeContext';
import { SocketProvider, useSocket } from '../../src/contexts/SocketProvider';

function TabsInner() {
  const { activityHasNew, markActivityNew, clearActivityNew } = useActivityBadge();
  const segments = useSegments();
  const isOnActivity =
    Array.isArray(segments) &&
    segments[0] === '(tabs)' &&
    segments[1] === 'activity';

  // Clear badge whenever Activity is focused
  React.useEffect(() => {
    if (isOnActivity) clearActivityNew();
  }, [isOnActivity, clearActivityNew]);

  // Optional: listen to socket events here (pure UI—no backend changes needed)
  const { socket } = useSocket?.() ?? { socket: null };
  React.useEffect(() => {
    if (!socket) return;
    const onCreated = () => {
      if (!isOnActivity) markActivityNew();
    };
    socket.on('assist:created', onCreated);
    socket.on('assist:create', onCreated);
    return () => {
      socket.off('assist:created', onCreated);
      socket.off('assist:create', onCreated);
    };
  }, [socket, isOnActivity, markActivityNew]);

  return (
    <Tabs
      tabBar={(p) => <CurvedTabBar {...p} badges={{ activity: activityHasNew }} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <SocketProvider>
      <ActivityBadgeProvider>
        <TabsInner />
      </ActivityBadgeProvider>
    </SocketProvider>
  );
}
