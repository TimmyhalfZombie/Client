// client/src/services/notificationService.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground behavior (show alert + sound)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let initialized = false;
let cachedToken: string | null = null;

function getProjectId(): string | undefined {
  return (
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function initNotifications(): Promise<string | null> {
  if (initialized) return cachedToken;
  initialized = true;

  await ensureAndroidChannel();

  // Ask permission (iOS & Android 13+)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null; // user declined
  }

  // Optional: get Expo Push Token (not required for local notifications)
  try {
    const projectId = getProjectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    cachedToken = tokenResp.data;
  } catch {
    // ignore; local notifications don't need a push token
  }

  return cachedToken;
}

export function getCachedToken() {
  return cachedToken;
}

/** Show a local notification immediately */
export async function presentNow(opts: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: 'default',
    },
    trigger: null, // show now
  });
}

// Listeners (optional if you want to handle taps)
type Unsub = () => void;

export function onForegroundNotification(
  cb: (n: Notifications.Notification) => void
): Unsub {
  const sub = Notifications.addNotificationReceivedListener(cb);
  return () => sub.remove();
}

export function onNotificationResponse(
  cb: (r: Notifications.NotificationResponse) => void
): Unsub {
  const sub = Notifications.addNotificationResponseReceivedListener(cb);
  return () => sub.remove();
}

// Present a local notification immediately
// removed duplicate presentNow
