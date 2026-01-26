import * as Icons from 'phosphor-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Values = { username: string; email: string; phone: string; password: string };
type Props = {
  values: Values;
  onChange: (field: keyof Values, value: string) => void;
  onCreate: () => void;
  onGoToSignIn: () => void;
  error?: string;
  loading?: boolean;
};

/* ------------------------ validators */
const validatePassword = (p: string) => {
  if (!p) return false;
  const longEnough = p.length >= 8;
  const upper = /[A-Z]/.test(p);
  const lower = /[a-z]/.test(p);
  const digit = /\d/.test(p);
  const symbol = /[^A-Za-z0-9]/.test(p);
  return longEnough && upper && lower && digit && symbol;
};
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isUsername = (v: string) => v.trim().length >= 3;
const isPhone = (v: string) => v.replace(/\D/g, '').length >= 7;


function HighlightInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  testValid,            // true=valid, false=invalid, null=neutral
  validOnly = false,    // username/email/phone => true; passwords => false
  rightAdornment,
  textInputProps = {},
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  testValid: boolean | null;
  validOnly?: boolean;
  rightAdornment?: React.ReactNode;
  textInputProps?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  // target mapping
  // validOnly: 0 (neutral/invalid) -> 1 (valid)
  // tri-state : -1 (invalid) -> 0 (neutral) -> 1 (valid)
  const target = validOnly
    ? testValid === true ? 1 : 0
    : testValid === true ? 1 : testValid === false ? -1 : 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animating color
    }).start();
  }, [target, anim]);

  const NEUTRAL = '#1F2937';
  const borderColor = validOnly
    ? anim.interpolate({ inputRange: [0, 1], outputRange: [NEUTRAL, SUCCESS] })
    : anim.interpolate({ inputRange: [-1, 0, 1], outputRange: [ERROR, NEUTRAL, SUCCESS] });

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
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          {...textInputProps}
        />
        {rightAdornment ? <View style={styles.adornment}>{rightAdornment}</View> : null}
      </Animated.View>
    </View>
  );
}

/* ------------------------ animated requirement row */
function RequirementItem({ label, met }: { label: string; met: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: met ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [met, anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const color = met ? SUCCESS : MUTED;
  return (
    <Animated.View style={[styles.reqRow, { opacity, transform: [{ scale }] }]}>
      {met ? (
        <Icons.CheckSquare size={18} color={SUCCESS} weight="fill" />
      ) : (
        <Icons.Square size={18} color={MUTED} />
      )}
      <Text style={[styles.reqText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

function RequirementsBox({
  show,
  hasLen,
  hasUpper,
  hasLower,
  hasDigit,
  hasSymbol,
  pwdValid,
  matchValid,
  showEmailLine,
  emailValid,
}: {
  show: boolean;
  hasLen: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  pwdValid: boolean;
  matchValid: boolean;
  showEmailLine: boolean;
  emailValid: boolean;
}) {
  if (!show) return null;
  return (
    <View style={styles.reqBox}>
      <Text style={styles.reqTitle}>Password requirements</Text>
      <RequirementItem label="At least 8 characters" met={hasLen} />
      <RequirementItem label="Uppercase letter (A–Z)" met={hasUpper} />
      <RequirementItem label="Lowercase letter (a–z)" met={hasLower} />
      <RequirementItem label="Number (0–9)" met={hasDigit} />
      <RequirementItem label="Symbol (!@#$%^&*…)" met={hasSymbol} />
      <View style={styles.reqDivider} />
      <RequirementItem label="Passwords match" met={matchValid && pwdValid} />
      {showEmailLine && <RequirementItem label="Valid email format" met={emailValid} />}
    </View>
  );
}

/* ------------------------ main component */
export default function SignupView({
  values,
  onChange,
  onCreate,
  onGoToSignIn,
  error,
  loading,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // password pieces
  const hasLen = values.password.length >= 8;
  const hasUpper = /[A-Z]/.test(values.password);
  const hasLower = /[a-z]/.test(values.password);
  const hasDigit = /\d/.test(values.password);
  const hasSymbol = /[^A-Za-z0-9]/.test(values.password);

  const pwdValid = useMemo(() => validatePassword(values.password), [values.password]);
  const isMismatch = useMemo(() => {
    if (!values.password && !confirmPassword) return false;
    return values.password !== confirmPassword;
  }, [values.password, confirmPassword]);
  const confirmValid = useMemo(
    () => !!confirmPassword && pwdValid && !isMismatch,
    [confirmPassword, pwdValid, isMismatch]
  );

  // per-field validity (email optional)
  const usernameValid = isUsername(values.username);
  const phoneValid = isPhone(values.phone);
  const emailTouched = !!values.email.trim();
  const emailValid = emailTouched ? isEmail(values.email) : true;

  const handleCreate = () => {
    if (!pwdValid) {
      setLocalError(
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.'
      );
      return;
    }
    if (isMismatch) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (!usernameValid) {
      setLocalError('Username must be at least 3 characters.');
      return;
    }
    if (!phoneValid) {
      setLocalError('Please enter a valid phone number.');
      return;
    }
    if (emailTouched && !emailValid) {
      setLocalError('Please enter a valid email or leave it blank.');
      return;
    }
    setLocalError(null);
    onCreate();
  };

  const showReqBox =
    Boolean(values.password) || Boolean(confirmPassword) || Boolean(values.email?.trim());
  const showEmailLine = emailTouched;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 24, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false} // hide scrollbar
        >
          <View style={styles.header}>
            <Text style={styles.brandRow}>
              <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
              <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
            </Text>
            <Text style={styles.subTitle}>Create an Account</Text>
          </View>

          <View style={styles.form}>
            {!!(error || localError) && <Text style={styles.errorText}>{localError || error}</Text>}

            {/* Username (neutral→green only) */}
            <Text style={styles.label}>Real Name</Text>
            <HighlightInput
              value={values.username}
              onChangeText={(t) => onChange('username', t)}
              placeholder="Real name"
              testValid={values.username ? (usernameValid ? true : false) : null}
              validOnly
            />

            {/* Email (optional, neutral→green only) */}
            <Text style={[styles.label, { marginTop: 16 }]}>
              Email <Text style={{ color: MUTED }}>(optional)</Text>
            </Text>
            <HighlightInput
              value={values.email}
              onChangeText={(t) => onChange('email', t)}
              placeholder="Email (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              testValid={values.email ? (isEmail(values.email) ? true : false) : null}
              validOnly
            />

            {/* Phone (neutral→green only) */}
            <Text style={[styles.label, { marginTop: 16 }]}>Phone</Text>
            <HighlightInput
              value={values.phone}
              onChangeText={(t) => onChange('phone', t)}
              placeholder="Phone"
              keyboardType="phone-pad"
              testValid={values.phone ? (phoneValid ? true : false) : null}
              validOnly
            />

            {/* New Password (neutral→red→green) */}
            <Text style={[styles.label, { marginTop: 16 }]}>New Password</Text>
            <HighlightInput
              value={values.password}
              onChangeText={(t) => onChange('password', t)}
              placeholder="New Password"
              secureTextEntry={!showPassword}
              testValid={values.password ? (pwdValid ? true : false) : null}
              validOnly={false}
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

            {/* Confirm Password (neutral→red→green) */}
            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <HighlightInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              secureTextEntry={!showConfirm}
              testValid={confirmPassword ? (confirmValid ? true : false) : null}
              validOnly={false}
              rightAdornment={
                <Pressable
                  onPress={() => setShowConfirm((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  hitSlop={12}
                >
                  {showConfirm ? <Icons.Eye size={20} color={MUTED} /> : <Icons.EyeSlash size={20} color={MUTED} />}
                </Pressable>
              }
            />

            {/* Password checklist */}
            <RequirementsBox
              show={showReqBox}
              hasLen={hasLen}
              hasUpper={hasUpper}
              hasLower={hasLower}
              hasDigit={hasDigit}
              hasSymbol={hasSymbol}
              pwdValid={pwdValid}
              matchValid={!isMismatch && Boolean(confirmPassword)}
              showEmailLine={showEmailLine}
              emailValid={emailValid}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  opacity:
                    loading
                      ? 0.7
                      : pwdValid && !isMismatch && usernameValid && phoneValid && (!emailTouched || emailValid)
                      ? 1
                      : 0.6,
                },
              ]}
              onPress={handleCreate}
              activeOpacity={0.85}
              disabled={
                loading ||
                !pwdValid ||
                isMismatch ||
                !usernameValid ||
                !phoneValid ||
                (emailTouched && !emailValid)
              }
            >
              {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>Create</Text>}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerDim}>Already have an account? </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={onGoToSignIn}>
                <Text style={styles.linkBright}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------ theme */
const GREEN = '#44ff75';
const BG = '#0B0B0B';
const CARD = '#111214';
const TEXT = '#ffffffff';
const MUTED = '#9CA3AF';
const ERROR = '#ff4d4f';
const SUCCESS = '#10B981';

/* ------------------------ styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { marginTop: 100, alignItems: 'center' },
  brandRow: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  brandGreen: { color: GREEN },
  brandWhite: { color: TEXT },
  subTitle: { marginTop: 4, color: TEXT, fontSize: 15 },
  form: { marginTop: 28, paddingBottom: 24 },
  errorText: { color: ERROR, marginBottom: 10, fontSize: 14, fontWeight: '600' },
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
    borderColor: '#1F2937', // neutral (animated override)
    position: 'relative',
    overflow: 'hidden',
  },

  adornment: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  reqBox: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0E0F12',
    padding: 12,
  },
  reqTitle: { color: TEXT, fontSize: 13, marginBottom: 8, opacity: 0.9 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  reqText: { fontSize: 14 },
  reqDivider: { height: 1, backgroundColor: '#1F2937', marginVertical: 6 },

  primaryBtn: {
    marginTop: 18,
    backgroundColor: GREEN,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  footerRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerDim: { color: MUTED, fontSize: 15 },
  linkBright: { color: GREEN, fontSize: 15, fontWeight: '600' },
});
