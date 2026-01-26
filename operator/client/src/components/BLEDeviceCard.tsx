import { Bluetooth } from 'phosphor-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Device } from 'react-native-ble-plx';

// Inter font families (ensure these are loaded in your app)
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

type Props = {
  device: Device;
  isConnected: boolean;
  onConnect: () => void;
  showConnect?: boolean;
};

export default function BLEDeviceCard({ device, isConnected, onConnect, showConnect = true }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Bluetooth color="#ffffffff" size={22} />
         <Text style={styles.bluetoothText}>Bluetooth</Text>
        {showConnect && !isConnected && (
          <TouchableOpacity style={styles.connectButton} onPress={onConnect}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.name}>{device.name || 'Unknown'}</Text>
      <Text style={styles.id}>{device.id}</Text>

      {/* Bonded / Not Bonded with colors */}
      <Text style={[styles.status, isConnected ? styles.bonded : styles.notBonded]}>
        {isConnected ? 'BONDED' : 'NOT BONDED'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderColor: '#444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bluetoothText: {
    color: '#ffffffff',
    fontWeight: 'normal',
    fontFamily: 'Candal',
    fontSize: 20,
    marginLeft: 8,
  },
  title: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: INTER_BLACK,
  },
  connectButton: {
    backgroundColor: '#322F36',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 'auto',
    marginRight: 0,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: INTER_MEDIUM,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    marginTop: 6,
    fontFamily: INTER_REGULAR,
  },
  id: {
    color: '#aaa',
    fontSize: 13,
    marginVertical: 2,
    fontFamily: INTER_REGULAR,
  },
  status: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: 'bold',
    fontFamily: INTER_BLACK,
  },
  bonded: {
    color: '#22c55e', // green
  },
  notBonded: {
    color: '#ef4444', // red
  },
});
