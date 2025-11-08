import { useRef } from "react";
import CameraView from "./components/CameraView";
import MapView from "./components/MapView";
import DemoMode from "./components/DemoMode";

export default function App() {
  const sharedHazards = useRef<Array<{type:"debris"|"water"|"blocked"; lat:number; lng:number; timestamp:number}>>([]);
  const mapRef = useRef<any>(null);

  async function getPosition() {
    return new Promise<{lat:number;lng:number}>((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lng:p.coords.longitude }), rej, { enableHighAccuracy:true });
    });
  }

  function handleHazardAdded(hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) {
    sharedHazards.current.push({ ...hazard, timestamp: Date.now() });
    // Trigger map update
    if (mapRef.current?.addHazard) {
      mapRef.current.addHazard(hazard);
    }
  }

  return (
    <div className="mobile-app-container">
      <div className="mobile-content">
        <div className="trailmix-header">
          <h1>TrailMix</h1>
          <p>AI-powered trail safety</p>
        </div>
        
        <CameraView onHazardReport={handleHazardAdded} getPosition={getPosition} />
        <MapView ref={mapRef} />
        <DemoMode onAddHazard={handleHazardAdded} />
        
        <div className="tip" style={{ textAlign: 'center', marginTop: 16 }}>
          💡 Tip: Use demo mode to test with sample hazards
        </div>
      </div>
    </div>
  );
}
