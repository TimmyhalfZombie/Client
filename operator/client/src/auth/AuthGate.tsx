// AuthGate.tsx
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { tokens } from '../auth/tokenStore';
import { fetchMe, loginWithIdentifier, registerUser } from '../lib/api';
import LoginView from './views/Login';
import SignupView from './views/Signup';

type Mode = 'login' | 'signup';

export default function AuthGate() {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [authed, setAuthed] = useState(false);

  // Controlled state for each view
  const [loginVals, setLoginVals] = useState({ identifier: '', password: '', remember: true });
  const [signupVals, setSignupVals] = useState({ username: '', email: '', phone: '', password: '' });

  // Try to restore session on mount
  useEffect(() => {
    (async () => {
      await tokens.waitUntilReady(); // in case _layout didn’t run/finish yet
      const t = tokens.getAccess();
      if (!t) return;
      try {
        await fetchMe();
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  const handleSignIn = async () => {
    setError('');
    if (!loginVals.identifier.trim() || !loginVals.password.trim()) {
      setError('Please sign in');
      return;
    }
    setLoading(true);
    try {
      // The login function already handles token persistence
      await loginWithIdentifier({
        identifier: loginVals.identifier.trim(),
        password: loginVals.password,
      });

      // Validate session
      await fetchMe();
      setAuthed(true);
    } catch {
      setError('Please sign in');
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    const { username, email, phone, password } = signupVals;
    if (!username.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError('Please sign in');
      return;
    }
    setLoading(true);
    try {
      // The register function already handles token persistence
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      await fetchMe();
      setAuthed(true); // registered users are immediately signed in (token returned)
    } catch {
      setError('Please sign in');
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  if (authed) {
    // ⬇️ Replace with your real Home/navigation
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#44ff75', fontSize: 18, fontWeight: '700' }}>
          You’re signed in. Replace &lt;AuthGate /&gt; return with your Home screen.
        </Text>
      </View>
    );
  }

  return mode === 'login' ? (
    <LoginView
      values={loginVals}
      onChange={(k, v) => setLoginVals((s) => ({ ...s, [k]: v }))}
      onSignIn={handleSignIn}
      onSignUp={() => {
        setError('');
        setMode('signup');
      }}
      onForgot={() => {}}
      error={error}
      loading={loading}
    />
  ) : (
    <SignupView
      values={signupVals}
      onChange={(k, v) => setSignupVals((s) => ({ ...s, [k]: v }))}
      onCreate={handleCreate}
      onGoToSignIn={() => {
        setError('');
        setMode('login');
      }}
      error={error}
      loading={loading}
    />
  );
}
