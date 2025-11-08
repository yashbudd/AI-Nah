'use client'

import { useRef } from 'react';
import DetectionView from '@/components/DetectionView';
import MapView from '@/components/MapView';
import HazardList from '@/components/HazardList';

export default function HomePage() {
  const mapRef = useRef<any>(null);

  async function getPosition() {
    return new Promise<{lat:number;lng:number}>((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lng:p.coords.longitude }), rej, { enableHighAccuracy:true });
    });
  }

  function handleHazardReport(hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) {
    // Add hazard to map
    if (mapRef.current?.addHazard) {
      mapRef.current.addHazard(hazard);
    }
  }

  return (
    <div>
      <div className="welcome-section">
        <h2>🏠 Welcome to TrailMix</h2>
        <p>Your AI-powered trail safety companion</p>
        
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h3>Camera Detection</h3>
            <p>Report trail hazards with your camera</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3>Interactive Map</h3>
            <p>View hazards and plan your route</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>AI Assistant</h3>
            <p>Get trail safety advice and tips</p>
          </div>
        </div>
        
        <div className="quick-actions">
          <h3>Quick Start</h3>
          <p>Use the bottom navigation to explore features</p>
        </div>
      </div>
    </div>
  );
}