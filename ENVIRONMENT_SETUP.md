# Environment Setup for Dual-App Flow

## Required API Keys

### 1. MapTiler API Key
- **Client-side**: Already configured in `client/app.json`
- **Key**: `iNtS1QIPq27RGWxB2TSX`
- **Usage**: Map tiles and geocoding
- **Security**: Safe to keep client-side

### 2. HeiGIT OpenRouteService API Key
- **Server-side**: Needs to be added to server environment
- **Key**: `eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUwNDdmMzMxYzM2ZjQ4MGJiYmQzYzA3NTRkMzBiMzI0IiwiaCI6Im11cm11cjY0In0=`
- **Usage**: Routing and ETA calculations
- **Security**: Keep server-side only

## Server Environment Setup

Create a `.env` file in the `server/` directory with the following content:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/patch-customer

# JWT
JWT_SECRET=your_jwt_secret_here

# Server
PORT=3000

# OpenRouteService API Key
ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUwNDdmMzMxYzM2ZjQ4MGJiYmQzYzA3NTRkMzBiMzI0IiwiaCI6Im11cm11cjY0In0=
```

## Client Environment Setup

The client environment is already configured in `client/app.json`:

```json
{
  "expo": {
    "extra": {
      "MAPTILER_KEY": "iNtS1QIPq27RGWxB2TSX",
      "EXPO_PUBLIC_ORS_KEY": "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUwNDdmMzMxYzM2ZjQ4MGJiYmQzYzA3NTRkMzBiMzI0IiwiaCI6Im11cm11cjY0In0="
    }
  }
}
```

## Features Implemented

### 1. MapTiler Integration
- ✅ Replaced Geoapify with MapTiler for map tiles
- ✅ Updated geocoding to use MapTiler API
- ✅ Added MapTiler style configuration

### 2. OpenRouteService Integration
- ✅ Server-side routing service
- ✅ Directions API for route calculation
- ✅ Matrix API for ETA calculations
- ✅ RESTful endpoints for routing

### 3. Real-time Location Tracking
- ✅ Background location permissions
- ✅ High-accuracy location tracking
- ✅ Distance-based update throttling
- ✅ Socket.IO integration for real-time updates

### 4. Dual-App Flow
- ✅ Operator location tracking with background support
- ✅ Customer location updates
- ✅ Real-time ETA calculations
- ✅ Route visualization

## Usage

### For Operators
1. Start location tracking when accepting a request
2. Background tracking continues while en route
3. Location updates sent every 5 seconds or 10 meters
4. ETA automatically calculated and updated

### For Customers
1. See operator's real-time location
2. View route and ETA updates
3. Track progress of assistance

## Security Notes

- **MapTiler key**: Safe for client-side use
- **ORS key**: Keep server-side only, rotate before production
- **Location data**: Encrypted in transit via Socket.IO
- **API calls**: Rate-limited and authenticated

## Next Steps

1. Add the ORS_API_KEY to your server .env file
2. Test the routing endpoints
3. Implement the UI components for location tracking
4. Add error handling and retry logic
5. Rotate API keys before production release
