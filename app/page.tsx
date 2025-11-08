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
      <DetectionView onHazardReport={handleHazardReport} getPosition={getPosition} />
      <MapView ref={mapRef} />
      <HazardList onAddHazard={handleHazardReport} />
      
      <div className="tip" style={{ textAlign: 'center', marginTop: 16 }}>
        💡 Tip: Use manual reporting or demo mode to test hazard detection
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
        <button 
          onClick={() => window.location.href = '/map'}
          className="btn-secondary"
        >
          🗺️ Map Only View
        </button>
        <button 
          onClick={() => window.location.href = '/detect'}
          className="btn-secondary"
        >
          📸 Camera Only View
        </button>
        <button 
          onClick={() => window.location.href = '/chat'}
          className="btn-secondary"
        >
          💬 Chat Interface
        </button>
      </div>
    </div>
  );
}