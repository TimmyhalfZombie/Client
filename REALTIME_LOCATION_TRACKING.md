# 📍 Real-Time Location Tracking Implementation Guide

## ✅ **What's Been Implemented**

### 1. **Database Schema Updates** ✅
Added location tracking fields to `AssistRequest` model:

```typescript
customerCurrentLocation?: {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

operatorCurrentLocation?: {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

lastLocationUpdate?: Date;
```

### 2. **Real-Time Socket Events** ✅

#### **Operator → Customer Location Updates**
```typescript
// Operator sends location (from operator app)
socket.emit("operator:locationUpdate", {
  assistRequestId: "request_id",
  lat: 14.5995,
  lng: 120.9842,
  address: "Quezon City, Metro Manila"
});

// Customer receives location (in customer app)
socket.on("operator:locationChanged", (data) => {
  console.log("Operator location:", data.data.operatorLocation);
  // Update map marker, calculate ETA, show on track.tsx
});
```

#### **Customer → Operator Location Updates**
```typescript
// Customer sends location (from customer app)
socket.emit("customer:locationUpdate", {
  assistRequestId: "request_id",
  lat: 14.6000,
  lng: 120.9850,
  address: "Manila, Metro Manila"
});

// Operator receives location (in operator app)
socket.on("customer:locationChanged", (data) => {
  console.log("Customer location:", data.data.customerLocation);
  // Update map marker, navigate to customer
});
```

---

## 🎯 **Implementation in Client Apps**

### **Customer App (`track.tsx` and `rate.tsx`)**

```typescript
// client/app/(main)/track.tsx or rate.tsx

import { useEffect, useState } from 'react';
import { getSocket } from '@/socket/socket';
import * as Location from 'expo-location';

export default function TrackScreen() {
  const [operatorLocation, setOperatorLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
    timestamp: Date;
  } | null>(null);

  const [assistRequestId, setAssistRequestId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for operator location updates
    socket.on("operator:locationChanged", (response) => {
      if (response.success) {
        console.log("📍 Operator location updated:", response.data.operatorLocation);
        setOperatorLocation(response.data.operatorLocation);
      }
    });

    return () => {
      socket.off("operator:locationChanged");
    };
  }, []);

  // Send customer's location every 5 seconds
  useEffect(() => {
    if (!assistRequestId) return;

    const sendLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const socket = getSocket();
        if (!socket) return;

        socket.emit("customer:locationUpdate", {
          assistRequestId,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address: await reverseGeocode(location.coords.latitude, location.coords.longitude)
        });

        console.log("📤 Customer location sent");
      } catch (error) {
        console.error("Location update error:", error);
      }
    };

    // Send immediately
    sendLocation();

    // Then every 5 seconds
    const interval = setInterval(sendLocation, 5000);

    return () => clearInterval(interval);
  }, [assistRequestId]);

  return (
    <View>
      {/* Map showing both customer and operator locations */}
      <MapView
        initialRegion={{
          latitude: operatorLocation?.lat || 14.5995,
          longitude: operatorLocation?.lng || 120.9842,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Operator marker */}
        {operatorLocation && (
          <Marker
            coordinate={{
              latitude: operatorLocation.lat,
              longitude: operatorLocation.lng,
            }}
            title="Operator"
            description={operatorLocation.address}
            pinColor="green"
          />
        )}

        {/* Customer marker (your location) */}
        <Marker
          coordinate={{
            latitude: yourLocation.lat,
            longitude: yourLocation.lng,
          }}
          title="You"
          pinColor="blue"
        />
      </MapView>

      {/* Display operator location info */}
      {operatorLocation && (
        <View>
          <Text>Operator Location:</Text>
          <Text>{operatorLocation.address}</Text>
          <Text>
            Updated: {new Date(operatorLocation.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}
    </View>
  );
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (result[0]) {
      return `${result[0].street || ''}, ${result[0].city || ''}, ${result[0].region || ''}`.trim();
    }
  } catch (error) {
    console.error("Reverse geocode error:", error);
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
```

---

## 📱 **Operator App Implementation**

```typescript
// operator-app/screens/ActiveRequest.tsx

import { useEffect, useState } from 'react';
import { getSocket } from '@/socket/socket';
import * as Location from 'expo-location';

export default function ActiveRequestScreen() {
  const [customerLocation, setCustomerLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
    timestamp: Date;
  } | null>(null);

  const [assistRequestId, setAssistRequestId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for customer location updates
    socket.on("customer:locationChanged", (response) => {
      if (response.success) {
        console.log("📍 Customer location updated:", response.data.customerLocation);
        setCustomerLocation(response.data.customerLocation);
      }
    });

    return () => {
      socket.off("customer:locationChanged");
    };
  }, []);

  // Send operator's location every 5 seconds
  useEffect(() => {
    if (!assistRequestId) return;

    const sendLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const socket = getSocket();
        if (!socket) return;

        socket.emit("operator:locationUpdate", {
          assistRequestId,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address: await reverseGeocode(location.coords.latitude, location.coords.longitude)
        });

        console.log("📤 Operator location sent");
      } catch (error) {
        console.error("Location update error:", error);
      }
    };

    sendLocation();
    const interval = setInterval(sendLocation, 5000);

    return () => clearInterval(interval);
  }, [assistRequestId]);

  return (
    <View>
      <MapView
        initialRegion={{
          latitude: customerLocation?.lat || 14.5995,
          longitude: customerLocation?.lng || 120.9842,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Customer marker */}
        {customerLocation && (
          <Marker
            coordinate={{
              latitude: customerLocation.lat,
              longitude: customerLocation.lng,
            }}
            title="Customer"
            description={customerLocation.address}
            pinColor="blue"
          />
        )}

        {/* Operator marker (your location) */}
        <Marker
          coordinate={{
            latitude: yourLocation.lat,
            longitude: yourLocation.lng,
          }}
          title="You (Operator)"
          pinColor="green"
        />

        {/* Route/Directions */}
        <Polyline
          coordinates={[
            { latitude: yourLocation.lat, longitude: yourLocation.lng },
            { latitude: customerLocation?.lat || 0, longitude: customerLocation?.lng || 0 },
          ]}
          strokeColor="#6EFF87"
          strokeWidth={3}
        />
      </MapView>
    </View>
  );
}
```

---

## 🔄 **Location Update Flow**

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER APP                             │
│  • Gets GPS location every 5 seconds                        │
│  • Emits: customer:locationUpdate                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Socket.IO)                        │
│  • Updates assistrequests.customerCurrentLocation           │
│  • Broadcasts to assigned operator                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   OPERATOR APP                              │
│  • Receives: customer:locationChanged                       │
│  • Updates map marker                                       │
│  • Calculates route/ETA                                     │
└─────────────────────────────────────────────────────────────┘

                     ↑
                     │ (Same flow in reverse)
                     │
┌─────────────────────────────────────────────────────────────┐
│                   OPERATOR APP                              │
│  • Gets GPS location every 5 seconds                        │
│  • Emits: operator:locationUpdate                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Socket.IO)                        │
│  • Updates assistrequests.operatorCurrentLocation           │
│  • Broadcasts to customer                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER APP                             │
│  • Receives: operator:locationChanged                       │
│  • Updates map marker in track.tsx/rate.tsx                │
│  • Shows operator approaching                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ **Performance Optimization**

### **Battery Optimization**
```typescript
// Only send location when request is active
const [requestStatus, setRequestStatus] = useState<string | null>(null);

useEffect(() => {
  // Only track location when status is "accepted" or "en_route"
  if (!['accepted', 'en_route'].includes(requestStatus || '')) {
    return; // Don't track location
  }

  // ... location tracking code
}, [requestStatus]);
```

### **Throttling Location Updates**
```typescript
let lastUpdate = 0;
const MIN_UPDATE_INTERVAL = 5000; // 5 seconds minimum

const sendLocation = async () => {
  const now = Date.now();
  if (now - lastUpdate < MIN_UPDATE_INTERVAL) {
    return; // Skip if too soon
  }
  
  lastUpdate = now;
  // ... send location
};
```

---

## 📊 **Database Queries for Historical Tracking**

```typescript
// Get location history for a request
const request = await AssistRequest.findById(requestId)
  .select('customerCurrentLocation operatorCurrentLocation lastLocationUpdate')
  .lean();

console.log("Customer is at:", request.customerCurrentLocation);
console.log("Operator is at:", request.operatorCurrentLocation);
console.log("Last updated:", request.lastLocationUpdate);
```

---

## ✅ **Integration Checklist**

### **Customer App** (`patch-customer`)
- [ ] Add location permissions in `app.json`
- [ ] Install `expo-location` if not already installed
- [ ] Update `track.tsx` with location listener
- [ ] Update `rate.tsx` with location listener
- [ ] Add map component with both markers
- [ ] Emit customer location every 5 seconds
- [ ] Listen for operator location changes

### **Operator App** (your operator app)
- [ ] Add location permissions in `app.json`
- [ ] Install `expo-location` if not already installed
- [ ] Listen for customer location changes
- [ ] Emit operator location every 5 seconds
- [ ] Show navigation/route to customer
- [ ] Update status (en_route, arrived, etc.)

### **Server** (Already Done ✅)
- [x] Added location tracking fields to AssistRequest model
- [x] Created `operator:locationUpdate` socket event
- [x] Created `customer:locationUpdate` socket event
- [x] Created `operator:locationChanged` broadcast event
- [x] Created `customer:locationChanged` broadcast event
- [x] Auto-refresh (0.5s) includes location updates

---

## 🎯 **Next Steps**

1. **Clean up database** (see `DATABASE_CLEANUP.md`)
2. **Update operator app** to connect to `customer` database
3. **Implement location tracking** in `track.tsx` and `rate.tsx`
4. **Test real-time updates** between customer and operator apps
5. **Add map visualization** with routes/markers
6. **Calculate ETA** based on distance and traffic

Your backend is **100% ready** for real-time location tracking! 🚀

