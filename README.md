# 🛠️ PatchUp - Advanced Roadside Assistance Platform

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react)
![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=for-the-badge&logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?style=for-the-badge&logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socket.io)

**An IT Capstone Research Project**  
_A dual-application ecosystem orchestrating real-time roadside recovery and driver-operator synchronization._

</div>

---

## ✨ Features

### 🌟 Core Experience

- **Instant Assistance**: One-tap requests with comprehensive vehicle diagnostic data.
- **Dual-App Sync**: Precise coordination between User and Operator applications.
- **Real-time Tracking**: Live GPS movement of operators with high-fidelity ETA updates.
- **Live Communication**: Embedded real-time chat with push notifications for instant coordination.

### 🔧 Specialized Integration

- **Intelligent Routing**: Advanced route geometry calculation via OpenRouteService.
- **Mapping UI**: Premium MapLibre/MapTiler integration for precise vector mapping.
- **Hardware Bridge**: BLE (Bluetooth Low Energy) integration for specialized operator diagnostic tools.
- **Voice/Video**: Agora-powered communication (optional upgrade).

---

## 🛠️ Tech Stack

### 📱 Frontend (Mobile Ecosystem)

- **React Native 0.81 / Expo SDK 54**: Modern cross-platform framework.
- **Expo Router**: Type-safe, file-system based routing for deep linking.
- **MapLibre & MapTiler**: State-of-the-art vector map rendering and tile sets.
- **React Native Reanimated**: Fluid, high-performance micro-animations.
- **Socket.IO Client**: Persistent WebSocket connections for sub-second latency.

### 🏠 Backend (Shared Infrastructure)

- **Node.js & Express 5**: Scalable server-side architecture.
- **MongoDB & Mongoose 8**: Document-based storage with complex relationship modelling.
- **Socket.IO Server**: Advanced event broadcasting and room-based synchronization.
- **JWT Authentication**: Secure, stateless user authorization.
- **OpenRouteService**: Enterprise-grade routing engine for precise logistics.

---

## 📂 Project Architecture

```
patch-customer/
├── client/           # Customer-Facing Application
│   ├── app/          # Expo Router Navigation
│   ├── components/   # Rich UI/UX Components
│   ├── socket/       # Client-side Socket Handlers
│   └── contexts/     # Application State Management
├── server/           # Unified Backend API & WebSocket Engine
│   ├── routes/       # Express REST Controllers
│   ├── models/       # Mongoose Schemas (Shared)
│   └── socket/       # Real-time Event Orchestration
└── operator/         # Service Provider Ecosystem
    ├── client/       # Operator Mobile Application
    └── server/       # Specialized Operator Microservices
```

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js 18+** & **npm/yarn**
- **MongoDB** (Shared cluster recommended)
- **Expo Go** or **Development Build APK**

### ⚙️ Quick Setup

1.  **Clone the system** and enter the directories.
2.  **Server**: `cd server && npm install && npm run dev`
3.  **Customer**: `cd client && npm install && npx expo start`
4.  **Operator**: `cd operator/client && npm install && npx expo start`

> 💡 **CRITICAL**: For full synchronization, refer to the [APP_SYNC_GUIDE.md](./APP_SYNC_GUIDE.md) for database and environment variable configuration.

---

## 👥 Dual-App Synchronization (Logic Flow)

The **PatchUp** system operates on a "Handshake" logic:

1.  **Request Phase**: Customer broadcasts a request via `socket.io` to the global Operator room.
2.  **Acceptance Phase**: An available Operator captures the request; the server creates a private encrypted room for the duo.
3.  **Sync Phase**: Live location updates (`operator:locationUpdate`) begin streaming, and the Customer sees the operator's approach in real-time.
4.  **Completion Phase**: Post-service handshake and rating system.

---

## ⚠️ Academic Disclaimer

This project is an **IT Capstone Research** project. It is developed for academic purposes to demonstrate advanced full-stack development. It is **not** a production-ready commercial product and is not published on official app stores.

---

## 📄 License

MIT © **CJBLACK** | Advanced Agentic Coding Project
