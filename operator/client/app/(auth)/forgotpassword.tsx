import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ForgotPasswordView from '../../src/auth/views/Forgotpassword';
import { resetPassword } from '../../src/auth/views/functions/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const identifier = (params.identifier || '').toString();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  async function onSend() {
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError('Provide your identifier and a new password');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ identifier, newPassword: password });
      router.replace('/(auth)/login');
    } catch (e: any) {
      setError(e?.message || 'Reset failed');
      console.log('reset error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ForgotPasswordView
      password={password}
      onChangePassword={setPassword}
      onSend={onSend}
      onBack={() => router.back()}
      error={error}
      loading={loading}
    />
  );
}
