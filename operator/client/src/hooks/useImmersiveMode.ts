import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export function useImmersiveMode() {
  useEffect(() => {
    const setupImmersiveMode = async () => {
      try {
        if (Platform.OS === 'android') {
          // Hide Android navigation bar
          await NavigationBar.setVisibilityAsync('hidden');
          // app.config.js sets edgeToEdgeEnabled: true; avoid extra setters to silence warnings
          // Guard these calls to minimize warnings on newer Android
          try { await NavigationBar.setBehaviorAsync('overlay-swipe'); } catch {}
          try { await NavigationBar.setBackgroundColorAsync('#000000'); } catch {}
        }
        
        if (Platform.OS === 'ios') {
          // Configure iOS system UI
          await SystemUI.setBackgroundColorAsync('#000000');
        }
      } catch (error) {
        console.log('Immersive mode setup error:', error);
      }
    };

    // Setup immersive mode when app becomes active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        setupImmersiveMode();
      }
    };

    // Initial setup
    setupImmersiveMode();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);
}
