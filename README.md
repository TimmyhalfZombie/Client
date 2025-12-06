# 🛠️ PatchUp - Roadside Assistance Platform

> **IT Capstone Research Project**  
> A dual mobile application system for real-time roadside assistance, connecting customers with service operators.

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=flat-square&logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?style=flat-square&logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io)

**📚 Academic Project • Not for Production Use**

</div>

---

## 📋 About This Project

This is an **IT Capstone Research Project** developed as part of our academic requirements. The system consists of two separate mobile applications:

| App                 | Purpose                                               | Repository                                              |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| 🚗 **Customer App** | For users requesting roadside assistance              | This repository                                         |
| 🔧 **Operator App** | For service providers accepting & fulfilling requests | [Operator](https://github.com/TimmyhalfZombie/Operator) |

### 🎓 Academic Context

- **Course**: IT Capstone Research
- **Purpose**: Educational demonstration of full-stack mobile development
- **Deployment**: Development builds via Expo Application Services (EAS)
- **Platform**: Android (development APK via `eas build --profile development`)

> ⚠️ **Note**: This application is not published on Google Play Store or Apple App Store. It is built and distributed as development APKs for academic demonstration purposes only.

---

## 📁 Project Structure

```
patch-customer/
├── client/          # React Native Expo app (Customer)
│   ├── app/         # File-based routing (Expo Router)
│   ├── components/  # Reusable UI components
│   ├── services/    # API & location services
│   ├── socket/      # Socket.IO client handlers
│   └── contexts/    # React context providers
│
└── server/          # Node.js backend (shared)
    ├── routes/      # Express API endpoints
    ├── modals/      # Mongoose schemas
    ├── socket/      # Socket.IO event handlers
    └── config/      # Database configuration
```

---

## ✨ Features

| Feature                   | Description                                       |
| ------------------------- | ------------------------------------------------- |
| 🔐 **Authentication**     | Email/password with JWT, password reset flow      |
| 📍 **Real-time Location** | Background GPS tracking with MapTiler integration |
| 🚗 **Assist Requests**    | Create, accept, and track roadside assistance     |
| 💬 **Live Chat**          | Real-time messaging between customer & operator   |
| 🗺️ **Route Tracking**     | ETA calculation via OpenRouteService              |
| 🔔 **Push Notifications** | Expo push notifications for request updates       |
| ⭐ **Ratings**            | Post-service rating system                        |

---

## 🛠️ Tech Stack

### Frontend (Mobile)

- **React Native** 0.81 with **Expo SDK 54**
- **Expo Router** for file-based navigation
- **MapLibre** with MapTiler for mapping
- **Socket.IO Client** for real-time communication
- **Agora SDK** for voice/video calls

### Backend

- **Node.js** with **Express 5**
- **MongoDB** with **Mongoose 8**
- **Socket.IO** for WebSocket connections
- **JWT** for authentication

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Expo CLI
- EAS CLI (`npm install -g eas-cli`)
- Expo Go app (for development) or development build APK

### Server Setup

```bash
cd server
npm install

# Create .env file with your configuration
# See Environment Variables section below

npm run dev
```

### Client Setup

```bash
cd client
npm install

# Start development server
npx expo start

# Or create a development build for Android
eas build --platform android --profile development
```

---

## ⚙️ Environment Variables

### Server (`server/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/patchup
JWT_SECRET=your_jwt_secret
PORT=3000
ORS_API_KEY=your_openrouteservice_key
```

### Client (`client/app.json` → `extra`)

```json
{
  "MAPTILER_KEY": "your_maptiler_key",
  "EXPO_PUBLIC_AGORA_APP_ID": "your_agora_app_id"
}
```

---

## 📱 Building the App

This project uses **Expo Application Services (EAS)** for building:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build development APK for Android
eas build --platform android --profile development

# Build preview APK (internal testing)
eas build --platform android --profile preview
```

> The built APK can be downloaded from your [Expo dashboard](https://expo.dev) and installed on Android devices for testing.

---

## 🔌 API Endpoints

| Route                         | Description           |
| ----------------------------- | --------------------- |
| `POST /auth/register`         | User registration     |
| `POST /auth/login`            | User authentication   |
| `GET /api/assist`             | List assist requests  |
| `POST /api/assist`            | Create assist request |
| `GET /api/routing/directions` | Get route directions  |

---

## 🔄 Socket Events

| Event                    | Direction       | Description              |
| ------------------------ | --------------- | ------------------------ |
| `assist:create`          | Client → Server | New assistance request   |
| `assist:accept`          | Client → Server | Operator accepts request |
| `assist:location_update` | Bidirectional   | Real-time location sync  |
| `message:send`           | Client → Server | Send chat message        |
| `message:new`            | Server → Client | New message notification |

---

## 📱 App Screens

- **Auth**: Welcome → Login → Register → Verify Email
- **Main**: Home → Track Request → Chat → Rate Service
- **Tabs**: Home, Activity, Messages, Profile

---

## 👥 Team

Developed as part of our IT Capstone Research project.

---

## ⚠️ Disclaimer

This is an **academic project** developed for educational purposes as part of an IT Capstone Research course. It is:

- ❌ Not intended for production use
- ❌ Not published on any app store
- ❌ Not a commercial product
- ✅ A demonstration of full-stack mobile development skills
- ✅ Built for academic evaluation and learning

---

## 📄 License

MIT © CJBLACK

_This project is submitted as partial fulfillment of academic requirements._
