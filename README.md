# TrailMix

**AI-Powered Trail Mapping and Hazard Detection**

## Overview

TrailMix is an AI-driven mobile and web app that maps outdoor trails in real time and detects potential hazards using live computer vision. The app identifies obstacles such as debris, flooding, or blockages and automatically updates nearby hikers with safe, weighted route recommendations. TrailMix was built for the **AI ATL 2025 Hackathon** and submitted to the **Google**, **Microsoft for Startups**, **MongoDB Atlas**, **Google API**, and **Matt Steele** tracks.

## Problem

Hikers and outdoor enthusiasts often rely on outdated or incomplete information about trail conditions. After storms or seasonal changes, trails can quickly become unsafe due to fallen trees, erosion, or standing water. Most mapping tools do not provide real-time hazard detection, forcing users to rely on reports from other hikers or park rangers, which can be delayed or inaccurate.

The result is a lack of safety awareness, increased risk of injury, and inefficiency in emergency response or maintenance efforts.

## Opportunity

TrailMix addresses this gap by combining live hazard detection, spatial mapping, and AI-assisted route planning into one system. Modern computer vision models, combined with open mapping APIs and cloud databases, make it possible to automatically recognize hazards, share them with nearby users, and suggest alternative routes instantly.

This creates a safer, smarter, and more connected hiking experience while providing valuable environmental data for park services and outdoor organizations.

## Technology

TrailMix integrates several modern technologies across AI, mapping, and data infrastructure:

### Core Components

* **TensorFlow + Google Gemini API** – powers the live object detection and classification for hazards such as debris, blockages, or flooding.
* **Mapbox** – provides the interactive trail map, GPS tracking, and real-time hazard visualization.
* **MongoDB Atlas** – stores user profiles, hazard reports, and spatial data.
* **TypeScript + Next.js** – used for the front-end interface and routing logic.
* **Microsoft for Startups / Google Cloud** – supports cloud infrastructure and AI model hosting.

### Weighted Route Logic

Each trail segment is scored dynamically based on distance, elevation, and hazard severity.
The route suggestion engine prioritizes the lowest weighted path to minimize risk and travel time.

## Solution

TrailMix delivers a full hiking experience through five main screens:

1. **Map View** – Interactive Mapbox map showing trails, hazard markers, and AI-recommended safe routes.
2. **Live Detection** – Real-time camera mode that identifies hazards using TensorFlow and Gemini, displaying bounding boxes and confidence scores.
3. **Chatbot** – An AI assistant that answers questions like “What’s the safest path back?” or “Where were hazards last detected?”
4. **Profile** – Stores hiking history, preferences, and user-submitted hazard validations.
5. **Hazard List** – Displays all known hazards in the area, sorted by type, timestamp, and confidence level.

## Architecture

```
Frontend:  Next.js + TypeScript
AI Model:  TensorFlow + Google Gemini API
Mapping:   Mapbox API
Database:  MongoDB Atlas
Hosting:   Vercel / Firebase
```

1. User opens app → GPS and camera activate.
2. Live video stream → TensorFlow → Hazard classification.
3. Results sent to MongoDB with coordinates and confidence levels.
4. Mapbox updates visual layer and recalculates safest route.
5. Gemini chatbot responds to user questions using the latest map data.

## Future Work

* Integrate predictive hazard forecasting using weather and satellite inputs.
* Enable offline mode for remote trails with on-device model inference.
* Partner with local parks and trail organizations for verified data sharing.
* Expand to other outdoor use cases like biking and kayaking routes.

## Team

| Member   | Role               | Responsibilities                            |
| -------- | ------------------ | ------------------------------------------- |
| Yash     | AI Engineer        | Model training, detection pipeline          |
| Victoria | Frontend Developer | Mapbox integration, UI/UX                   |
| Coleman  | Backend Developer  | Database setup, API design, route weighting |

## Acknowledgments

TrailMix was built for **AI ATL 2025** and submitted to:

* Google AI Track
* Microsoft for Startups
* MongoDB Atlas Challenge
* Google API Challenge
* Matt Steele Track

Special thanks to the mentors and organizers who supported the event.

**TrailMix** helps people explore confidently—by turning live trail data into intelligent safety guidance.