# TrailMix Web App

AI-powered trail mapping web application for detecting hazards, sharing them live on a spatial map, and getting safer routes.

## Features

- 📹 **Camera Detection**: Real-time hazard detection using TensorFlow.js
- 🗺️ **Live Map**: Mapbox integration with geolocation and hazard visualization  
- 🔄 **Smart Routing**: Hazard-aware route planning with Mapbox Directions
- 🤖 **AI Confirmation**: Google Gemini Vision API for hazard classification
- 🎯 **Demo Mode**: Simulated hazards for reliable offline demonstrations

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Maps**: Mapbox GL JS
- **ML**: TensorFlow.js (COCO-SSD) + Google Gemini Vision
- **Routing**: Mapbox Directions API

## Quick Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your tokens:
   - `VITE_API_URL` - Backend API URL (default: http://localhost:4000)
   - `VITE_MAPBOX_TOKEN` - Your Mapbox public token

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open app**: Visit http://localhost:5173

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API endpoint | `http://localhost:4000` |
| `VITE_MAPBOX_TOKEN` | Mapbox public access token | `pk.eyJ1...` |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Grant permissions**: Allow camera and location access when prompted
2. **Start detection**: Click "Start Detecting" to begin AI hazard detection
3. **View hazards**: See detected hazards appear as colored pins on the map
4. **Get routes**: Click "Reroute to Map Center" for hazard-aware navigation
5. **Demo mode**: Enable demo mode to add simulated hazards for testing

### Hazard Types

- 🪨 **Debris** (Orange): Trail obstacles like fallen branches, rocks
- 💧 **Water** (Blue): Puddles, flooding, water hazards
- 🚫 **Blocked** (Red): Completely blocked trails or paths

### Demo Mode

Enable demo mode for reliable demonstrations:
- Adds simulated hazards at your location
- Works offline or with poor connectivity  
- Perfect for hackathon presentations

## Browser Compatibility

- Chrome/Edge: Full support
- Safari: Requires HTTPS for camera access
- Firefox: Full support

## Performance Tips

- Use HTTPS in production for camera access
- Ensure stable internet for Mapbox and Gemini API
- Enable location services for accurate positioning

## Troubleshooting

### Camera not working
- Ensure HTTPS or localhost
- Grant camera permission in browser settings

### Map not loading  
- Verify Mapbox token is valid
- Check console for API errors

### Geolocation issues
- Enable location services
- Grant location permission when prompted

## Architecture

```
src/
  components/         # React components
    CameraView.tsx   # Camera + detection logic
    MapView.tsx      # Mapbox map integration
    DemoToggle.tsx   # Demo mode controls
  ml/               # Machine learning
    detector.ts     # TensorFlow.js hazard detection  
  api.ts           # Backend API client
  App.tsx          # Main application
  main.tsx         # Entry point
```

## API Integration

The app connects to the TrailMix backend API:

- `POST /hazards` - Create new hazard
- `GET /hazards` - Get hazards by bounding box
- `POST /classify` - Classify image with Gemini
- `GET /route` - Get hazard-aware route

## License

MIT