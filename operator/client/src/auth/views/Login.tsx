import * as Icons from 'phosphor-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Values = { identifier: string; password: string; remember: boolean };
type Props = {
  values: Values;
  onChange: <K extends keyof Values>(field: K, value: Values[K]) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onForgot: () => void;
  error?: string;      // e.g. "Wrong password" | "Unknown email" | "Invalid credentials"
  loading?: boolean;
};

const GREEN = '#44ff75';
const BG = '#0B0B0B';
const CARD = '#111214';
const TEXT = '#ffffffff';
const MUTED = '#9CA3AF';
const NEUTRAL = '#1F2937';
const RED = '#ff4d4f';

/* ---------- helper: map backend error to a specific field */
function getCredErrorTarget(msg?: string): 'identifier' | 'password' | null {
  if (!msg) return null;
  const s = msg.toLowerCase();
  if (s.includes('password')) return 'password';
  if (
    s.includes('email') || s.includes('phone') || s.includes('identifier') ||
    s.includes('user not found') || s.includes('unknown user') ||
    s.includes('unknown email') || s.includes('unknown phone')
  ) return 'identifier';
  if (
    s.includes('invalid credential') || s.includes('incorrect') ||
    s.includes('mismatch') || s.includes('not match') ||
    s.includes('authentication failed') || s.includes('unauthorized') ||
    s.includes('invalid login')
  ) return 'identifier';
  return null;
}

/* ---------- Animated border-only input: -1 red, 0 neutral, 1 green */
function HighlightInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightAdornment,
  state, // -1 | 0 | 1
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightAdornment?: React.ReactNode;
  state: -1 | 0 | 1;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: state,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [state, anim]);

  const borderColor = anim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [RED, NEUTRAL, GREEN],
  });

  return (
    <View style={styles.inputWrap}>
      <Animated.View style={[styles.animatedBorder, { borderColor }]}>
        <TextInput
          style={[styles.input, { paddingRight: rightAdornment ? 44 : 14 }]}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          keyboardAppearance="dark"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {rightAdornment ? <View style={styles.eyeBtn}>{rightAdornment}</View> : null}
      </Animated.View>
    </View>
  );
}

export default function LoginView({ values, onChange, onSignIn, onSignUp, onForgot, error, loading }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  // focus flags
  const [idFocused, setIdFocused] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);

  // track server error target & whether user edited that field since error
  const [errorTarget, setErrorTarget] = useState<'identifier' | 'password' | null>(null);
  const [idEditedSinceError, setIdEditedSinceError] = useState(false);
  const [pwdEditedSinceError, setPwdEditedSinceError] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (error && error !== lastError) {
      setLastError(error);
      const t = getCredErrorTarget(error);
      setErrorTarget(t);
      setIdEditedSinceError(false);
      setPwdEditedSinceError(false);
    }
    if (!error) {
      setLastError(undefined);
      setErrorTarget(null);
    }
  }, [error, lastError]);

  // when inputs change, mark edited since error (to clear red once finished)
  useEffect(() => { if (errorTarget === 'identifier') setIdEditedSinceError(true); }, [values.identifier, errorTarget]);
  useEffect(() => { if (errorTarget === 'password') setPwdEditedSinceError(true); }, [values.password, errorTarget]);

  const idTrim = values.identifier.trim();
  const pwdTrim = values.password.trim();

  // GREEN only when not focused and non-empty
  const idShouldBeGreen = !idFocused && idTrim.length > 0;
  const pwdShouldBeGreen = !pwdFocused && pwdTrim.length > 0;

  // RED only for the one field the backend says is wrong, until user edits that field
  const idShouldBeRed = errorTarget === 'identifier' && !idEditedSinceError && idTrim.length > 0;
  const pwdShouldBeRed = errorTarget === 'password' && !pwdEditedSinceError && pwdTrim.length > 0;

  // compute final border states
  const idState: -1 | 0 | 1 = idTrim.length === 0 ? 0 : idShouldBeRed ? -1 : idShouldBeGreen ? 1 : 0;
  const pwdState: -1 | 0 | 1 = pwdTrim.length === 0 ? 0 : pwdShouldBeRed ? -1 : pwdShouldBeGreen ? 1 : 0;

  // button lights only when both fields are not focused and non-empty
  const canSubmit = idShouldBeGreen && pwdShouldBeGreen;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandRow}>
          <Text style={{ color: GREEN, fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
        </Text>
        <Text style={styles.subTitle}>Welcome Back!</Text>
      </View>

      <View style={styles.form}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.label}>Phone or Email</Text>
        <HighlightInput
          value={values.identifier}
          onChangeText={(t) => onChange('identifier', t)}
          placeholder="Phone or Email"
          keyboardType="email-address"
          autoCapitalize="none"
          state={idState}
          onFocus={() => setIdFocused(true)}
          onBlur={() => setIdFocused(false)}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <HighlightInput
          value={values.password}
          onChangeText={(t) => onChange('password', t)}
          placeholder="Password"
          secureTextEntry={!showPassword}
          state={pwdState}
          onFocus={() => setPwdFocused(true)}
          onBlur={() => setPwdFocused(false)}
          rightAdornment={
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={12}
            >
              {showPassword ? <Icons.Eye size={20} color={MUTED} /> : <Icons.EyeSlash size={20} color={MUTED} />}
            </Pressable>
          }
        />

        <View style={styles.rowBetween}>
          <Pressable style={styles.rememberWrap} onPress={() => onChange('remember', !values.remember)}>
            <View style={[styles.checkbox, values.remember && styles.checkboxChecked]}>
              {values.remember ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember Password</Text>
          </Pressable>

          <TouchableOpacity onPress={onForgot} activeOpacity={0.7}>
            <Text style={styles.linkDim}>Forget Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { opacity: loading ? 0.7 : canSubmit ? 1 : 0.6 }]}
          onPress={onSignIn}
          activeOpacity={0.85}
          disabled={loading || !canSubmit}
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>Sign in</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerDim}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
            <Text style={styles.linkBright}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- theme & styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { marginTop: 170, alignItems: 'center' },
  brandRow: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  subTitle: { marginTop: 4, color: TEXT, fontSize: 15 },
  form: { marginTop: 28 },
  errorText: { color: RED, marginBottom: 10, fontSize: 14, fontWeight: '600' },
  label: { color: TEXT, fontSize: 15, marginBottom: 6 },

  inputWrap: { position: 'relative' },
  input: {
    height: 48,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 0,
    paddingHorizontal: 14,
    color: TEXT,
  },
  animatedBorder: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: NEUTRAL,
    position: 'relative',
    overflow: 'hidden',
  },

  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },

  rowBetween: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rememberWrap: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#374151',
    marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  check: { color: BG, fontSize: 14, lineHeight: 14, fontWeight: '800' },
  rememberText: { color: MUTED, fontSize: 15 },
  linkDim: { color: TEXT, fontSize: 15, textDecorationLine: 'underline' },
  linkBright: { color: GREEN, fontSize: 15, fontWeight: '600' },
  primaryBtn: { marginTop: 16, backgroundColor: GREEN, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  footerRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'center' },
  footerDim: { color: MUTED, fontSize: 15 },
});
