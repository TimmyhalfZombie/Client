import { router } from 'expo-router';
import React, { useState } from 'react';
import LoginView from '../../src/auth/views/Login';
import { loginWithIdentifier } from '../../src/auth/views/functions/auth';

export default function LoginScreen() {
  const [values, setValues] = useState({ identifier: '', password: '', remember: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSignIn() {
    setError('');
    if (!values.identifier.trim() || !values.password.trim()) {
      setError('Please enter your phone or email and password');
      return;
    }
    setLoading(true);
    try {
      await loginWithIdentifier({
        identifier: values.identifier.trim(),
        password: values.password,
      });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || 'Sign in failed');
      console.log('login error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginView
      values={values}
      onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
      onSignIn={onSignIn}
      onSignUp={() => router.push('/(auth)/signup')}
      onForgot={() =>
        router.push({ pathname: '/(auth)/forgotpassword', params: { identifier: values.identifier } })
      }
      error={error}
      loading={loading}
    />
  );
}
