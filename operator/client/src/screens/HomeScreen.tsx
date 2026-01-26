import React, { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BLEDeviceCard from '../components/BLEDeviceCard';
import TemperatureDial from '../components/TemperatureDial';
import { useBleScanner } from '../features/useBLEscanner';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import OperateScreen from '../screens/OperateScreen';

// Inter font families (ensure these are loaded in your app)
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

export default function HomeScreen() {
  // Enable immersive mode
  useImmersiveMode();
  const {
    devices,
    scanning,
    startScan,
    stopScan,
    connectToDevice,
    connectedDeviceId,
    needsBluetooth,
  } = useBleScanner();

  const [showOperator, setShowOperator] = useState(false);

  // If the device disconnects, go back to scanner view automatically
  useEffect(() => {
    if (!connectedDeviceId) setShowOperator(false);
  }, [connectedDeviceId]);

  // Ask runtime permissions before scanning
  const handleScanPress = async () => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const allGranted =
        result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

      if (!allGranted) {
        Alert.alert('Permissions needed','Please grant Bluetooth & Location permissions to scan for devices.');
        return;
      }
    }
    startScan();
  };

  const handleStart = () => {
    if (!connectedDeviceId) {
      Alert.alert('Not connected', 'Connect to a device first.');
      return;
    }
    setShowOperator(true); // ← switch Home to show the Operator panel
  };

  // ── If we’re showing the operator panel, render it and keep the Home tab active
  if (connectedDeviceId && showOperator) {
    return <OperateScreen />; // same UI you showed on your separate operator route
  }

  // ── Otherwise show the scanner UI (original Home content)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* App Title */}
      <View style={{ width: '100%', alignItems: 'flex-start', paddingHorizontal: 24 }}>
        <Text style={styles.title}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
        </Text>
      </View>

      {/* Temperature Dial */}
      <View style={{ marginTop: 40 }}>
        <TemperatureDial value={connectedDeviceId ? undefined : 0} minValue={0} maxValue={120} />
      </View>

      {/* BLE Section */}
      <View style={styles.bleSection}>
        {devices.length === 0 && !scanning && (
          <View>
            <Text style={styles.bleLabel}>
              {needsBluetooth ? 'Please turn on Bluetooth to scan.' : 'No BLE device found.'}
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
              <Text style={styles.scanButtonText}>Scan for device</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanning && devices.length === 0 && (
          <Text style={styles.bleLabel}>Scanning...</Text>
        )}

        {devices.length > 0 && (
          <View>
            {devices.map((device) => (
              <BLEDeviceCard
                key={device.id}
                device={device}
                isConnected={connectedDeviceId === device.id}
                onConnect={() => connectToDevice(device)}
                showConnect={true}
              />
            ))}

            {/* Show START only when connected */}
            {connectedDeviceId && (
              <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                <Text style={styles.startButtonText}>START</Text>
              </TouchableOpacity>
            )}

            {/* Scan toggle */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={scanning ? stopScan : handleScanPress}
            >
              <Text style={styles.scanButtonText}>
                {scanning ? 'Stop Scanning' : 'Scan for device'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    paddingTop: 35, 
    paddingVertical: 32, 
    alignItems: 'center', 
    backgroundColor: '#101010', 
    flexGrow: 1, minHeight: '100%' 
  },

  title: { 
    fontSize: 28, 
    marginBottom: 14,
    letterSpacing: 1, 
    flexDirection: 'row' 
  },

  bleSection: {
     width: '92%', 
     marginTop: 30, 
     backgroundColor: '#101010', 
     borderRadius: 16, 
     padding: 28, 
     borderWidth: 2, 
     borderColor: '#473f3fff', 
     minHeight: 130, 
     alignSelf: 'center', 
     marginBottom: 40 
    },

  bleLabel: { 
    color: '#ff4444', 
    textAlign: 'center', 
    marginBottom: 18,
    fontFamily: INTER_BLACK,
    fontSize: 16,
  },

  bleButton: { 
    backgroundColor: '#44ff75', 
    paddingHorizontal: 22, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignSelf: 'center', 
    marginTop: 10,
    minWidth: 140,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },

  bleButtonText: { 
    color: '#181818', 
    fontWeight: 'bold', 
    fontSize: 15,
    textAlign: 'center',
    fontFamily: INTER_BLACK,
  },
  startButton: { 
    backgroundColor: '#44ff75', 
    paddingHorizontal: 22, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignSelf: 'center', 
    marginTop: 10,
    minWidth: 140,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  startButtonText: { 
    color: '#181818', 
    fontWeight: 'bold', 
    fontSize: 15,
    textAlign: 'center',
    fontFamily: INTER_BLACK,
  },
  scanButton: { 
    backgroundColor: '#352b2eff', 
    paddingHorizontal: 22, 
    paddingVertical: 10, 
    borderRadius: 8, 
    alignSelf: 'center', 
    marginTop: 10,
    minWidth: 140,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scanButtonText: { 
    color: '#ffffffff', 
    fontWeight: 'bold', 
    fontSize: 15,
    textAlign: 'center',
    fontFamily: INTER_BLACK,
  },
});
