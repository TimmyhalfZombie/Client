
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fromConfig = (Constants.expoConfig?.extra as any)?.API_URL;

const FALLBACK = Platform.select({
  ios: 'http://localhost:3000',
  android: 'http://10.0.2.2:3000',     // Android emulator
  default: 'http://192.168.1.23:3000', // real device on LAN
});

export const API_URL: string = fromConfig ?? FALLBACK!;

if (!fromConfig) {
  console.warn('[env] extra.API_URL missing; using fallback:', API_URL);
}
