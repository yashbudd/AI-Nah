import React, { useState } from "react";
import { createHazard } from "../api";

type Props = {
  getPosition: () => Promise<{lat:number; lng:number}>;
};

export default function DemoToggle({ getPosition }: Props) {
  const [demoMode, setDemoMode] = useState(false);

  async function addSimulatedHazard(type: "debris" | "water" | "blocked") {
    try {
      const pos = await getPosition();
      await createHazard({
        type,
        lat: pos.lat + (Math.random() - 0.5) * 0.001, // slightly randomize position
        lng: pos.lng + (Math.random() - 0.5) * 0.001,
        confidence: 0.9,
        source: "local"
      });
      alert(`Simulated ${type} hazard added near your location`);
    } catch (error) {
      // Fallback to default location if geolocation fails
      await createHazard({
        type,
        lat: 33.775 + (Math.random() - 0.5) * 0.001,
        lng: -84.389 + (Math.random() - 0.5) * 0.001,
        confidence: 0.9,
        source: "local"
      });
      alert(`Simulated ${type} hazard added at default location`);
    }
  }

  if (!demoMode) {
    return (
      <div className="demo-toggle disabled">
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button 
            onClick={() => setDemoMode(true)}
            className="btn-demo"
            style={{ width: '100%' }}
          >
            🎯 Enable Demo Mode
          </button>
          <div className="demo-description">
            Demo mode adds simulated hazards for reliable offline demonstrations
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-toggle enabled">
      <div className="demo-header">
        <h3 className="demo-title">🎯 Demo Mode Active</h3>
        <button 
          onClick={() => setDemoMode(false)}
          className="btn-demo"
          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
        >
          Disable
        </button>
      </div>
      
      <div className="demo-controls">
        <div className="demo-buttons-row">
          <button 
            onClick={() => addSimulatedHazard("debris")}
            className="btn-debris"
          >
            🪨 Add Debris
          </button>
          
          <button 
            onClick={() => addSimulatedHazard("water")}
            className="btn-water"
          >
            💧 Add Water
          </button>
          
          <button 
            onClick={() => addSimulatedHazard("blocked")}
            className="btn-blocked"
          >
            🚫 Add Blocked
          </button>
        </div>
      </div>
      
      <div className="demo-description">
        🎬 Use these buttons to add simulated hazards for a reliable demo experience
      </div>
    </div>
  );
}