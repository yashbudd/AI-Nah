## 🥾 TrailMix — AI-powered Trail Safety & Adaptive Routing

TrailMix is an AI-driven trail safety platform that combines on-device computer vision for
reliable hazard detection, hazard-aware adaptive routing, a conversational trail assistant,
and a community-synced hazard database to deliver real-time trail intelligence. 🌲🤖

TrailMix is designed to support safer navigation for hikers, park services,
and outdoor operators through actionable alerts and adaptive routing. 🚀

## ⚡ Quick Start

Install and run the app locally:

```bash
npm install
npm run dev
```

The development server runs on port 3001 by default. Open http://localhost:3001 in your browser. 🌐

You may also use: www.tmix.tech

## 🔍 What this prototype includes

- 🗺️ Interactive Map (Mapbox) with hazard pins and route visualization
- 📸 On-device camera detection using a Web Worker + TensorFlow.js (coco-ssd)
- 🧭 Hazard-aware routing API (cost-grid + A* pathfinder) that weights cells by hazard penalty
- 💬 Azure (Microsoft) powered chat assistant for trail safety advice and risk assessments for hazards
- � Text-to-speech functionality using ElevenLabs AI for voice responses
- �🗄️ MongoDB-backed hazard store with offline-first ideas in mind
- 📱 Mobile-first, touch-optimized UI components for quick demos + automatic messaging for emergency situations

## 🧩 Pages / UI

- `/` — Landing / overview ✨
- `/map` — Map interface with hazards, two-click routing and manual hazard reporting 🧭
- `/detect` — Camera / detection UI (runs model in a Worker) 📷
- `/chat` — AI chat assistant backed by Gemini with voice playback 💬🔊

## 🔧 Architecture & Key Implementation Notes

- 📡 On-device detection: `src/ml/detector.ts` spawns `detector.worker.ts` which loads `@tensorflow-models/coco-ssd`
  into a WebGL backend for image-based detections in the browser.
- 🤖 AI chat: `src/lib/gemini.ts` wraps `@google/genai` to produce trail-safety responses. Add a Gemini API key
  to enable live chat.
- � Text-to-speech: `src/app/api/tts/route.ts` uses ElevenLabs API to convert AI responses to natural speech.
  Users can click the speaker button next to assistant messages to hear them spoken aloud.
- �🗺️ Hazard database: MongoDB is used via `src/lib/mongodb.ts`. Hazard documents include `latitude`, `longitude`,
  `type`, `confidence`, `source`, and `description`.
- 🛣️ Adaptive routing: `src/app/api/routes/route.ts` builds a cost grid (cells ~8 m by default) and runs an
  A* search on an 8-connected grid. Hazards are smeared into the grid as additive penalties (based on type,
  radius and confidence) so the route prefers lower-risk cells — effectively a hazard-weighted A*.

## 🧭 How routing handles hazards (brief)

- 📍 Hazards from MongoDB are fetched within an expanded bbox for routing.
- ⚖️ Each hazard type maps to a radius and weight (e.g., `blocked` has a high weight and radius).
- ➕ A cost grid is built where base traversal cost is 1 and hazard proximity increases the cell cost
  using a simple falloff (closer cells get larger penalties). Confidence values scale the penalty.
- 🧠 A* is executed on this grid (8-connected neighbors) using the grid cell costs. The returned path
  is smoothed before being returned to the client as a GeoJSON LineString.

## 🛠️ Tech stack

- Next.js 14 + TypeScript
- React (client-side UI components)
- Mapbox GL JS for interactive maps
- TensorFlow.js + coco-ssd in a Web Worker for browser-based detection
- Azure and OpenAI for Gemini-powered chat (server / serverless API)
- @elevenlabs/elevenlabs-js for AI-powered text-to-speech
- MongoDB for hazards and persistence

## 🗂️ Files & locations (high level)

- `src/app/` — Next.js app routes and API endpoints
  - `src/app/api/routes/route.ts` — routing API (cost grid + A*)
  - `src/app/api/chat/route.ts` — chat API surface
  - `src/app/api/tts/route.ts` — text-to-speech API using ElevenLabs
  - `src/app/api/hazards/route.ts` — hazards CRUD
- `src/components/` — UI components (MapView, ChatInterface, etc.)
- `src/ml/` — client detector and worker (`detector.ts`, `detector.worker.ts`)
- `src/lib/` — helpers (Gemini wrapper, Mongo client, routing helpers)

## 🧪 Developer notes & tips

- ⚙️ The detector runs only in the browser (it spawns a Worker). On the server the detector is a no-op.
- 🏃 Development server uses `next dev -p 3001` as configured in `package.json`.
- 🎯 To see routing behavior locally, use `/map` and click to place start/end points (first click = start,
  second click = end). The map will call `/api/routes` to compute the hazard-aware route.

## 🚀 TrailMix Overview (Pitch Deck Summary)

## 👥 Founding Team

**Yash Buddhdeo — Founder & CEO**  
- 🎓 Computer Science + Business  
- 💼 Software Engineering Intern @ Adversarial Risk Management  
- 📣 Director @ Startup Exchange  
- 🏆 CEO of PlannerRank — Klaus Startup Challenge Finalist  
- 💻 6 years programming experience; 1 year AI experience  

**Victoria Lu — Founder & CTO**  
- 🎓 Computer Science  
- 🖥️ Frontend Developer @ JuniGo  
- 🤖 Software @ RoboJackets RoboWrestling  
- 📱 iOS Club Bootcamp graduate  
- 💻 7 years programming experience; 1 year AI experience  

**Coleman Pearson — Founder & COO**  
- 🚀 Aerospace Engineering + Computer Science  
- 🔧 Propulsion Engineer @ GT Propulsive Landers  
- 🏅 Klaus Aerospace Entrepreneurship Challenge  
- 💻 2 years programming experience; 1 year AI experience  

The team combines ML experience, full-stack engineering, problem-solving, and technical product leadership. 🤝

---

## 📌 Product Positioning

TrailMix positioning

TrailMix is an AI-first trail safety product that combines three capabilities in one experience:

- On-device vision that detects trail hazards in real time (blockages, debris, water). 📷
- Hazard-aware route planning that prefers lower-risk segments using a weighted A* planner. 🧭
- Community-syncing hazard database so insights persist and improve over time. 🌐

At a glance

- Audience: hikers, trail maintainers, park services and outdoor-first teams.
- Primary value: reduce surprise on the trail by detecting hazards early and suggesting safer routes.
- Offline-first goal: record locally and sync when connectivity returns.

Competitive snapshot (short)

- AllTrails / Komoot / Trailforks
  - Focus: route discovery and user-shared tracks.
  - Gap: static routes with no live hazard detection or adaptive rerouting.
  - TrailMix edge: real-time ML detection + hazard-weighted routing.

- CalTopo
  - Focus: professional/technical mapping and planning.
  - Gap: powerful but complex for casual users.
  - TrailMix edge: automated safety-focused UX for everyday hikers.

- SOS / offline tools
  - Focus: emergency signaling and offline navigation.
  - Gap: reactive tools that help after an incident; limited prevention.
  - TrailMix edge: prevention-first approach — detect and avoid hazards before they become emergencies.

Why TrailMix

- Single integrated experience for detection, routing, and community hazard intelligence. 🛠️
- Makes trails safer for casual and expert users by surfacing hazard context and safer path options. 🛡️
- Designed for low-signal environments: local capture + background sync. 🔁

---

## 🧭 Core Components

### 🛣️ Adaptive Route Suggestions
- Weighted A* algorithm incorporating hazard probability and confidence  
- Highlights safer vs. higher-risk trail segments  
- Integrates ML-detected and user-reported hazards  

### 📷 Live Hazard Detection
- On-device TensorFlow + Gemini-powered contextual classification  
- Detects 3 key hazard types: blockage, debris, water  
- Stores hazards in MongoDB for community syncing  

### 🔁 Route Sharing + Offline Sync
- Stores hazard and route data offline  
- Auto-syncs when connection returns  
- Designed for low-signal field environments  

### 💬 Interactive Chatbot
- Uses hazard database + Gemini for safety insights  
- Provides real-time Q&A for trail conditions  
- **Text-to-speech playback** using ElevenLabs AI voices  
- Click speaker button (🔊) next to responses to hear them spoken aloud  

---

## 📈 Market Context

- U.S. hiking safety tech investment: **$28B**  
- 59.6M active U.S. hikers  
- 72% of hikers wish for better mapping tools  
- Hiking tech market growth 2025–2030: **$8B → $11B**  

TrailMix addresses the shift toward **adaptive, AI-augmented outdoor safety systems**.

---

## 🌟 Value Proposition

- The **only AI-powered hazard-aware trail safety network**  
- **ML-driven adaptive routing** instead of static maps  
- **Community hazard database** for real-time insights  
- Supports healthier outdoor activity and strengthens park services  
- Stores and syncs data even without cell service  

---

## 🧭 Contributing / Next steps

- ✅ Add tests for routing correctness (unit test for `buildCostGrid` and `astar`).
- ✅ Add optional types and runtime checks for hazard payloads.
- 🔁 Implement offline sync and background sync worker for hazards.

## ⚖️ License

This project is for demo / prototype use. Add a license file if you intend to open-source or distribute more broadly.

---
