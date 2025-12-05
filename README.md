# 🛠️ PatchUp

> Real-time roadside assistance platform connecting customers with operators.

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io)

</div>

---

## 📁 Project Structure

```
patch-customer/
├── client/          # React Native Expo app
│   ├── app/         # File-based routing (Expo Router)
│   ├── components/  # Reusable UI components
│   ├── services/    # API & location services
│   ├── socket/      # Socket.IO client handlers
│   └── contexts/    # React context providers
│
└── server/          # Node.js backend
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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Expo CLI (`npm install -g expo-cli`)

### Server

```bash
cd server
npm install
cp .env.example .env    # Configure your environment
npm run dev
```

### Client

```bash
cd client
npm install
npx expo start
```

---

## ⚙️ Environment Variables

**Server** (`server/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/patchup
JWT_SECRET=your_jwt_secret
PORT=3000
ORS_API_KEY=your_openrouteservice_key
```

**Client** (`client/app.json` → `extra`)

```json
{
  "MAPTILER_KEY": "your_maptiler_key",
  "EXPO_PUBLIC_AGORA_APP_ID": "your_agora_app_id"
}
```

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

## 📄 License

MIT © CJBLACK
