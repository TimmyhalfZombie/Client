import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TemperatureDial from '../components/TemperatureDial';
import { useBleScanner } from '../features/useBLEscanner';

const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

type Phase = 'idle' | 'extending' | 'heating' | 'coolingdown' | 'retracting';

export default function OperateScreen() {
  const { sendByte, subscribeToNotifications, isConnected } = useBleScanner();
  const pressRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [tempC, setTempC] = useState<number>(0);
  const [labelPhase, setLabelPhase] = useState<Phase>('idle');
  const [phaseDeadlineAt, setPhaseDeadlineAt] = useState<number | null>(null);
  const [, setNow] = useState<number>(Date.now());

  const busy = phase !== 'idle';

  const label =
    labelPhase === 'idle' ? 'START' :
    labelPhase === 'extending' ? 'EXTENDING…' :
    labelPhase === 'heating' ? 'HEATING…' :
    labelPhase === 'coolingdown' ? 'COOLING…' :
    'RETRACTING…';

  // Delay visible label for retracting by 1s
  useEffect(() => {
    if (phase === 'retracting') {
      const t = setTimeout(() => setLabelPhase('retracting'), 1000);
      return () => clearTimeout(t);
    }
    setLabelPhase(phase);
  }, [phase]);

  // Set countdown deadline per phase: heating=15min, coolingdown=15min
  useEffect(() => {
    const now = Date.now();
    if (phase === 'heating') {
      setPhaseDeadlineAt(now + 15 * 60 * 1000);
    } else if (phase === 'coolingdown') {
      setPhaseDeadlineAt(now + 15 * 60 * 1000);
    } else {
      setPhaseDeadlineAt(null);
    }
  }, [phase]);

  // Ticker to update displayed timer every 500ms while active
  useEffect(() => {
    if (!phaseDeadlineAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phaseDeadlineAt]);

  const timerText = (() => {
    if (!phaseDeadlineAt) return undefined;
    const remainingMs = Math.max(0, phaseDeadlineAt - Date.now());
    const secs = Math.floor(remainingMs / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  })();

  const handleStart = async () => {
    if (busy) return;
    try {
      if (!isConnected) {
        Alert.alert('Not connected', 'Please connect to a device first.');
        return;
      }
      pressRef.current = (pressRef.current % 100) + 1;
      await sendByte(pressRef.current);
      setPhase('extending'); // optimistic; ESP32 confirms via notify
    } catch (e) {
      console.log('sendByte error:', e);
      Alert.alert('Error', 'Failed to send START. Check connection.');
    }
  };

  const handleStop = async () => {
    try {
      if (!isConnected) {
        Alert.alert('Not connected', 'Please connect to a device first.');
        return;
      }
      setPhase('retracting');
      await sendByte(0);
    } catch (e) {
      console.log('sendByte STOP error:', e);
      Alert.alert('Error', 'Failed to send STOP. Check connection.');
    }
  };

  // Parse BLE notifications for temperature + state
  useEffect(() => {
    const unsub = subscribeToNotifications?.((raw: string) => {
      const msg = raw.trim();

      // Match "temperature: 288", "temp: 28.6", "t=30", "T:30C", "28.5 C"
      const tempMatch =
        /(?:temp(?:erature)?|^t)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i.exec(msg) ||
        /\b(-?\d+(?:\.\d+)?)\s*°?\s*c\b/i.exec(msg);

      if (tempMatch) {
        const v = parseFloat(tempMatch[1]);
        if (!Number.isNaN(v)) setTempC(v);
      }

      // State machine (unchanged + COOLING)
      const m = msg.toUpperCase();
      if (m.startsWith('EXTEND')) {
        setPhase('extending');
      } else if (m.startsWith('HOLD') || m.includes('HEAT')) {
        setPhase('heating');
      } else if (m.includes('COOL') || m.includes('COOLING') || m.includes('COOL-DOWN') || m.includes('COOL DOWN')) {
        setPhase('coolingdown');
      } else if (m.startsWith('RETRACT')) {
        setPhase('retracting');
      } else if (m.includes('COMPLETE') || m.includes('READY') || m.includes('SAFE:DONE')) {
        setPhase('idle');
      } else if (m.startsWith('SAFE') || m.startsWith('ERROR')) {
        // keep current phase
      }
    });

    return () => { try { unsub && unsub(); } catch {} };
  }, [subscribeToNotifications]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        <Text style={{ color: '#44ff75', fontFamily: 'Candal' }}>patch</Text>
        <Text style={{ color: '#fff', fontFamily: 'Candal' }}> up</Text>
      </Text>

      {/* Dial */}
      <View style={{ marginTop: 90, justifyContent: 'center', alignItems: 'center' }}>
        <TemperatureDial
          value={tempC}
          minValue={0}
          maxValue={120}
          isHeating={phase === 'heating'}
          isCooling={phase === 'coolingdown'}
          isRetracting={phase === 'retracting'}
          timerText={timerText}
        />
      </View>

      <TouchableOpacity
        style={[styles.startBtn, busy && styles.startBtnDisabled, busy && styles.phaseBtn]}
        onPress={handleStart}
        disabled={busy}
        activeOpacity={0.8}
      >
        <Text style={[styles.startTxt, busy && styles.phaseTxt]}>{label}</Text>
      </TouchableOpacity>

      {busy && (
        <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.85}>
          <Text style={styles.stopTxt}>STOP</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', paddingTop: 60 },
  brand: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, fontFamily: INTER_BLACK },
  startBtn: {
    marginTop: 100,
    backgroundColor: '#0F0F0F',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9C9C9C',
    width: '90%',
    alignSelf: 'center',
  },
  startBtnDisabled: { opacity: 0.55 },
  startTxt: {
    color: '#ffffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: INTER_BLACK,
    textAlign: 'center',
  },
  phaseBtn: { backgroundColor: '#6E686A', borderColor: '#8C8386' },
  phaseTxt: { color: '#ffffff', fontWeight: 'bold', fontFamily: INTER_BLACK },
  stopBtn: {
    marginTop: 16,
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#C83333',
    paddingVertical: 18,
    borderRadius: 14,
  },
  stopTxt: { textAlign: 'center', color: '#111', fontFamily: INTER_BLACK, fontSize: 18, letterSpacing: 2 },
});
