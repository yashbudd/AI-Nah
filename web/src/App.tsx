import React from "react";
import CameraView from "./components/CameraView";
import MapView from "./components/MapView";
import DemoToggle from "./components/DemoToggle";

export default function App() {
  async function getPosition() {
    return new Promise<{lat:number;lng:number}>((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lng:p.coords.longitude }), rej, { enableHighAccuracy:true });
    });
  }

  return (
    <div className="mobile-app-container">
      <div className="mobile-content">
        <div className="trailmix-header">
          <h1>TrailMix</h1>
          <p>AI-powered trail safety</p>
        </div>
        
        <CameraView onDetected={(h)=> console.log("Detected", h)} getPosition={getPosition} />
        <MapView />
        <DemoToggle getPosition={getPosition} />
        
        <div className="tip" style={{ textAlign: 'center', marginTop: 16 }}>
          💡 Tip: Use manual reporting if auto-detection is uncertain
        </div>
      </div>
    </div>
  );
}
