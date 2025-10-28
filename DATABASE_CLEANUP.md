# Database Cleanup & Migration Guide

## 🎯 Goal
Clean up duplicate collections and prepare for real-time customer ↔ operator messaging with location tracking.

---

## ❌ **STEP 1: Delete Duplicate Collections**

### Delete from `appdb` database:
```javascript
// Connect to MongoDB Compass or shell
use appdb;

// Delete all duplicate collections
db.conversations.drop();
db.conversationmetas.drop();
db.messages.drop();
db.users.drop();

// Confirm deletion
show collections; // Should be empty now
```

### Delete `operators` collection from `customer` database:
```javascript
use customer;

// Delete operators collection
db.operators.drop();

// Confirm
show collections;
// Should show: assistrequests, conversations, conversationmetas, messages, users
```

---

## ✅ **STEP 2: Verify Correct Structure**

After cleanup, your `customer` database should have:

```
customer/
├── assistrequests      ✅ Assistance requests from customers
├── conversations       ✅ 1-on-1 chats (customer ↔ operator)
├── conversationmetas   ✅ Unread counts, read status
├── messages            ✅ Chat messages
└── users               ✅ Both customer & operator accounts
```

---

## 🔐 **STEP 3: Verify User Types**

Your `users` collection should contain both:
- **Customer users** (people requesting assistance)
- **Operator users** (people providing assistance)

You can add a `role` field if needed:

```javascript
// Optional: Add role field to distinguish users
db.users.updateMany(
  { /* your customer criteria */ },
  { $set: { role: "customer" } }
);

db.users.updateMany(
  { /* your operator criteria */ },
  { $set: { role: "operator" } }
);
```

---

## 📡 **STEP 4: Add Location Tracking Fields**

### Add to `assistrequests` collection:

```javascript
use customer;

// Add operator location fields
db.assistrequests.updateMany(
  {},
  {
    $set: {
      operatorCurrentLocation: null,
      customerCurrentLocation: null,
      lastLocationUpdate: null
    }
  }
);
```

### Sample document structure:
```json
{
  "_id": ObjectId("..."),
  "userId": ObjectId("customer_id"),
  "assignedTo": ObjectId("operator_id"),
  "status": "accepted",
  "vehicle": { ... },
  "location": {
    "type": "Point",
    "coordinates": [lng, lat],
    "address": "Initial request location"
  },
  "customerCurrentLocation": {
    "lat": 14.5995,
    "lng": 120.9842,
    "address": "Customer's live location",
    "timestamp": ISODate("2025-10-21T12:00:00Z")
  },
  "operatorCurrentLocation": {
    "lat": 14.6000,
    "lng": 120.9850,
    "address": "Operator's live location",
    "timestamp": ISODate("2025-10-21T12:01:00Z")
  },
  "lastLocationUpdate": ISODate("2025-10-21T12:01:00Z"),
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

---

## 🚀 **STEP 5: Update Both Apps**

### Customer App (`patch-customer`):
- ✅ Already connects to `customer` database
- ✅ No changes needed

### Operator App (`patch-operator` or similar):
- ❌ Change connection from `appdb` to `customer`
- Update `MONGO_URI` environment variable:
  ```
  MONGO_URI=mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/customer
  ```

---

## 📍 **STEP 6: Real-Time Location Updates**

### Add Socket Events for Location Tracking:

```typescript
// New socket events needed:

// Operator sends location update
socket.on("operator:locationUpdate", {
  assistRequestId: string,
  lat: number,
  lng: number,
  address: string
});

// Customer receives operator location
socket.on("operator:locationChanged", {
  assistRequestId: string,
  operatorLocation: { lat, lng, address, timestamp }
});

// Customer sends location update
socket.on("customer:locationUpdate", {
  assistRequestId: string,
  lat: number,
  lng: number,
  address: string
});

// Operator receives customer location
socket.on("customer:locationChanged", {
  assistRequestId: string,
  customerLocation: { lat, lng, address, timestamp }
});
```

---

## ✅ **Final Verification Checklist**

- [ ] `appdb` database is empty or deleted
- [ ] `customer/operators` collection is deleted
- [ ] `customer/users` contains both customer & operator accounts
- [ ] `customer/conversations` and `messages` are shared
- [ ] Both apps connect to `customer` database
- [ ] Location tracking fields added to `assistrequests`
- [ ] Real-time location socket events implemented

---

## 🎯 **Expected Data Flow After Cleanup**

```
Customer App (customer DB)           Operator App (customer DB)
        ↓                                      ↓
    ┌───────────────────────────────────────────────┐
    │         customer Database (SHARED)            │
    ├───────────────────────────────────────────────┤
    │ users              - Both types               │
    │ assistrequests     - Shared requests          │
    │ conversations      - Shared chats             │
    │ messages           - Shared messages          │
    │ conversationmetas  - Shared metadata          │
    └───────────────────────────────────────────────┘
```

---

## 🔧 **Need Help?**

If you encounter any issues during migration:
1. **Backup your database first!**
2. Test with a small subset of data
3. Verify socket connections after changes
4. Check server logs for connection errors

