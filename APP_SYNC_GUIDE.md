# 🔄 Dual-App Synchronization & Setup Guide

This document preserves the critical logic and setup requirements for the **Customer** and **Operator** dual-application system.

---

## 🛠️ Database Setup (Crucial)

To ensure seamless communication between apps, both **MUST** connect to the same single database.

### **The Single Source of Truth**

- **Database Name:** `customer`
- **Collections:**
  - `users`: Contains both `customer` and `operator` accounts (distinguished by `role` field).
  - `assistrequests`: Shared requests, status, and live locations.
  - `conversations`: Shared 1-on-1 chat rooms.
  - `messages`: Shared chat history.
  - `conversationmetas`: Shared unread counts and read status.

### **Connection String Rule**

Both apps and the server must use:
`mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/customer`

---

## 🔑 Environment Secrets

### 1. MapTiler (Client-side)

- **Key:** `iNtS1QIPq27RGWxB2TSX`
- **Purpose:** Vector tiles, markers, and reverse geocoding.

### 2. OpenRouteService (Server-side)

- **Key:** `eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUwNDdmMzMxYzM2ZjQ4MGJiYmQzYzA3NTRkMzBiMzI0IiwiaCI6Im11cm11cjY0In0=`
- **Purpose:** Routing geometry, distances, and ETA calculation.

---

## 📡 Essential Socket.io Flow

### **1. Request Lifecycle**

1.  **Customer** emits `assist:create` with location & vehicle info.
2.  **Server** saves to `assistrequests` and broadcasts `assist:created` to all Operators.
3.  **Operator** emits `assist:accept`.
4.  **Server** updates request status, creates a `Conversation`, and notifies both parties.

### **2. Real-Time Location Tracking**

Once a request is `accepted` or `en_route`:

- **Operator** emits `operator:locationUpdate` every 5-10 seconds.
- **Customer** receives `operator:locationChanged` to update their tracking map.
- **Customer** emits `customer:locationUpdate` (foreground).
- **Operator** receives `customer:locationChanged` to update navigation.

---

## 📝 Important Notes

### **Dual Android Configuration**

- **Customer App:** Focused on requesting and monitoring.
  - Requires: `ACCESS_FINE_LOCATION`.
- **Operator App:** Focused on accepting and navigating.
  - Requires: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (for en-route tracking), and Bluetooth permissions for device interaction.

### **Communication Sync**

- Chat messaging is bidirectional using `message:send` and `message:new`.
- Both apps must listen for `assist:status` to handle completions/cancellations globally.

### **Cleanup Reminder**

- Legacy `appdb` collections (conversations, messages, users) should be **deleted** to prevent accidental writes to the wrong source.
- Ensure the `users` collection contains both account types.
