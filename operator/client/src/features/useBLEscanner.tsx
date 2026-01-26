import { Buffer } from 'buffer';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';

export function useBleScanner() {
  // Keep one manager instance per app runtime
  const bleManager = useRef(new BleManager()).current;

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [needsBluetooth, setNeedsBluetooth] = useState(false);
  
  // Universal scanning state
  const [universalScanning, setUniversalScanning] = useState(false);
  const [universalDevices, setUniversalDevices] = useState<Device[]>([]);

  // UUIDs (match your ESP32)
  const LED_SERVICE_UUID = 'c191e8aa-fb8a-4c7a-8750-5eb91c7c794a';
  const LED_CHAR_UUID    = 'c191e8ab-fb8a-4c7a-8750-5eb91c7c794a';

  // --- Notification monitor state
  const notifSubRef = useRef<Subscription | null>(null);
  const notifListenersRef = useRef<Set<(msg: string) => void>>(new Set());

  // Optional legacy helper (still available)
  const writeLed = async (device: Device, on: boolean) => {
    try {
      await device.writeCharacteristicWithResponseForService(
        LED_SERVICE_UUID,
        LED_CHAR_UUID,
        Buffer.from([on ? 0x01 : 0x00]).toString('base64')
      );
    } catch (e) {
      console.log('writeLed error:', e);
    }
  };

  // --- Resolver: always get the actual connected Device instance ---
  const getConnectedDevice = async (): Promise<Device> => {
    // 1) If we have an ID, fetch the Device by ID
    if (connectedDeviceId) {
      const [byId] = await bleManager.devices([connectedDeviceId]);
      if (byId) return byId;
    }
    // 2) Fallback: ask OS for devices connected that expose our service
    const list = await bleManager.connectedDevices([LED_SERVICE_UUID]);
    if (list.length > 0) {
      if (list[0].id !== connectedDeviceId) {
        setConnectedDeviceId(list[0].id);
      }
      return list[0];
    }
    throw new Error('No connected device');
  };

  // Send a single byte (e.g., 1) to ESP32
  const sendByte = async (value: number) => {
    const dev = await getConnectedDevice(); // resolves across screen changes
    await dev.writeCharacteristicWithResponseForService(
      LED_SERVICE_UUID,
      LED_CHAR_UUID,
      Buffer.from([value]).toString('base64')
    );
    console.log('Sent byte:', value);
  };

  // --- Notifications: subscribe / unsubscribe
  const startNotifications = async () => {
    // If already monitoring, do nothing
    if (notifSubRef.current) return;

    const dev = await getConnectedDevice();

    // Start monitor; react-native-ble-plx enables CCCD automatically
    const sub = dev.monitorCharacteristicForService(
      LED_SERVICE_UUID,
      LED_CHAR_UUID,
      (error, ch) => {
        if (error) {
          console.log('Notify error:', error.message);
          return;
        }
        if (!ch?.value) return;

        try {
          const msg = Buffer.from(ch.value, 'base64').toString('utf8').trim();
          // Fan out to all listeners
          notifListenersRef.current.forEach(fn => {
            try { fn(msg); } catch {}
          });
        } catch (e) {
          console.log('Notify decode error:', e);
        }
      }
    );

    notifSubRef.current = sub;
    console.log('Notifications started.');
  };

  const stopNotifications = () => {
    try {
      notifSubRef.current?.remove?.();
    } catch {}
    notifSubRef.current = null;
    console.log('Notifications stopped.');
  };

  /**
   * Public API: subscribe to status messages.
   * Returns an unsubscribe function for the caller.
   */
  const subscribeToNotifications = (cb: (msg: string) => void) => {
    notifListenersRef.current.add(cb);

    // Attempt to ensure a live monitor
    startNotifications().catch(e => console.log('startNotifications error:', e));

    return () => {
      notifListenersRef.current.delete(cb);
      // If no listeners remain, we can optionally stop monitoring to save battery
      if (notifListenersRef.current.size === 0) {
        stopNotifications();
      }
    };
  };

  // Listen for disconnects; DO NOT destroy the manager on unmount
  useEffect(() => {
    let sub: Subscription | undefined;

    if (connectedDeviceId) {
      sub = bleManager.onDeviceDisconnected(connectedDeviceId, () => {
        console.log('DEVICE DISCONNECTED');
        setConnectedDeviceId(null);
        // Tear down notification monitor on disconnect
        stopNotifications();
      });
    }
    return () => {
      sub?.remove?.();
    };
  }, [bleManager, connectedDeviceId]);

  async function requestPermissions() {
    if (Platform.OS === 'android') {
      const perms: string[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        // Android 12+
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];
      try {
        await PermissionsAndroid.requestMultiple(perms);
      } catch (e) {
        console.log('BLE permission error:', e);
      }
    }
  }

  const startScan = async () => {
    await requestPermissions();

    const state = await bleManager.state();
    if (state !== State.PoweredOn) {
      setNeedsBluetooth(true);
      return;
    }

    // Stop any existing scan first
    bleManager.stopDeviceScan();

    setDevices([]);
    // IMPORTANT: do NOT clear connectedDeviceId here (keeps connection state)
    setScanning(true);
    setNeedsBluetooth(false);
    console.log('Starting BLE scan...');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('Scan error:', error.message);
        setScanning(false);
        return;
      }
      if (device && device.name) {
        setDevices(prev => (prev.some(d => d.id === device.id) ? prev : [...prev, device]));
      }
    });

    // Auto-stop after 20s
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
      console.log('Scan stopped.');
    }, 20000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setScanning(false);
    console.log('Manual scan stop.');
  };

  // Universal scanning functions - scan for any BLE device
  const startUniversalScan = async () => {
    await requestPermissions();

    const state = await bleManager.state();
    if (state !== State.PoweredOn) {
      setNeedsBluetooth(true);
      return;
    }

    // Stop any existing scan first
    bleManager.stopDeviceScan();

    setUniversalDevices([]);
    setUniversalScanning(true);
    setNeedsBluetooth(false);
    console.log('Starting universal BLE scan for any device...');

    // Scan for any BLE device without UUID filter
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('Universal scan error:', error.message);
        setUniversalScanning(false);
        return;
      }
      if (device) {
        // Add any device found, regardless of name or UUID
        setUniversalDevices(prev => (prev.some(d => d.id === device.id) ? prev : [...prev, device]));
        console.log('Universal scan found device:', device.name || 'Unknown', device.id);
      }
    });

    // Auto-stop after 30s for universal scan
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setUniversalScanning(false);
      console.log('Universal scan stopped.');
    }, 30000);
  };

  const stopUniversalScan = () => {
    bleManager.stopDeviceScan();
    setUniversalScanning(false);
    console.log('Manual universal scan stop.');
  };

  // Universal connection - connect to any BLE device
  const connectToUniversalDevice = async (device: Device) => {
    try {
      stopUniversalScan();
      const connected = await bleManager.connectToDevice(device.id, { timeout: 10000 });
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDeviceId(connected.id);
      console.log('UNIVERSAL DEVICE CONNECTED:', connected.id, connected.name || 'Unknown');

      // Try to start notifications if the device has our expected service
      try {
        await startNotifications();
      } catch (e) {
        console.log('Could not start notifications - device may not support our service:', e);
      }
    } catch (e) {
      console.log('Universal connect error:', e);
      setConnectedDeviceId(null);
      stopNotifications();
    }
  };

  const connectToDevice = async (device: Device) => {
    try {
      stopScan();
      const connected = await bleManager.connectToDevice(device.id, { timeout: 10000 });
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDeviceId(connected.id);
      console.log('DEVICE CONNECTED:', connected.id);

      // (Re)start notifications on successful connect
      startNotifications().catch(e => console.log('startNotifications error:', e));
    } catch (e) {
      console.log('connect error:', e);
      setConnectedDeviceId(null);
      stopNotifications();
    }
  };

  return {
    // data
    devices,
    scanning,
    connectedDeviceId,
    isConnected: !!connectedDeviceId,

    // actions
    startScan,
    stopScan,
    connectToDevice,
    writeLed,
    sendByte,

    // notifications
    subscribeToNotifications,

    // UI state
    needsBluetooth,
    setNeedsBluetooth,

    // Universal scanning (new functionality)
    universalDevices,
    universalScanning,
    startUniversalScan,
    stopUniversalScan,
    connectToUniversalDevice,
  };
}
