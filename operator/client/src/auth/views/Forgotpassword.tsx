import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  password: string;
  onChangePassword: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  error?: string;     // show "Please sign in" or validation text
  loading?: boolean;
};

export default function ForgotPasswordView({ password, onChangePassword, onSend, onBack, error, loading }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandRow}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
        </Text>
        <Text style={styles.subTitle}>Create a New Password</Text>
      </View>

      <View style={styles.card}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.cardLead}>
          Please enter a new password.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor="#6B7280"
          keyboardAppearance="dark"
          secureTextEntry
          value={password}
          onChangeText={onChangePassword}
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={onSend} activeOpacity={0.85} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>Send</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const GREEN = '#44ff75';
const BG = '#0B0B0B';
const CARD_BG = 'rgba(17,18,20,0.6)';
const TEXT = '#E5E7EB';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { marginTop: 130, alignItems: 'center' },
  brandRow: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  subTitle: { marginTop: 4, color: '#ffffffff', fontSize: 15 },
  card: { marginTop: 24, borderWidth: 1, borderColor: GREEN, borderRadius: 12, padding: 14, backgroundColor: CARD_BG },
  errorText: { color: '#ff4d4f', marginBottom: 10, fontSize: 14, fontWeight: '600' },
  cardLead: { color: TEXT, fontSize: 14, lineHeight: 18, marginBottom: 10 },
  divider: { height: 1, backgroundColor: GREEN, opacity: 0.4, marginBottom: 14 },
  label: { color: TEXT, fontSize: 14, marginBottom: 6 },
  input: {
    height: 48, borderRadius: 10, backgroundColor: '#111214',
    borderWidth: 1, borderColor: '#1F2937', paddingHorizontal: 14, color: TEXT,
  },
  primaryBtn: { marginTop: 14, backgroundColor: GREEN, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 12, backgroundColor: '#6B6466', height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
});
