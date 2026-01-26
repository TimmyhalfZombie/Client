// client/app/(auth)/signup.tsx
import { router } from 'expo-router';
import React, { useState } from 'react';
import * as Location from 'expo-location';
import SignupView from '../../src/auth/views/Signup';
import { registerUser } from '../../src/auth/views/functions/auth';

export default function SignupScreen() {
  const [values, setValues] = useState({ username: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Try to always prompt for permission first; then attempt a single fix.
  async function getLocationOnce() {
    try {
      // 1) check/request permission (don’t short-circuit on services state)
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (!perm.granted) return null;

      // 2) try to read location (even if services are off this may throw; we swallow)
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('loc-timeout')), 7000)),
      ]);

      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  }

  async function onCreate() {
    setError('');
    const { username, email, phone, password } = values;

    if (!username.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill username, phone, and password.');
      return;
    }

    setLoading(true);
    try {
      // Prompt for permission & try one GPS read.
      const loc = await getLocationOnce(); // may be null

      const payload = {
        username: username.trim(),
        phone: phone.trim(),
        password,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(loc ? { lat: Number(loc.lat), lng: Number(loc.lng) } : {}),
      };

      await registerUser(payload as any);
      router.replace('/(auth)/patchup');
    } catch (e: any) {
      setError(e?.message || 'Sign up failed');
      console.log('signup error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignupView
      values={values}
      onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
      onCreate={onCreate}
      onGoToSignIn={() => router.replace('/(auth)/login')}
      error={error}
      loading={loading}
    />
  );
}
