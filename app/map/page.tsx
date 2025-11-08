'use client'

import { useRef } from 'react';
import MapView from '@/components/MapView';
import HazardList from '@/components/HazardList';

export default function MapPage() {
  const mapRef = useRef<any>(null);

  async function getPosition() {
    return new Promise<{lat:number;lng:number}>((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lng:p.coords.longitude }), rej, { enableHighAccuracy:true });
    });
  }

  function handleHazardAdded(hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) {
    if (mapRef.current?.addHazard) {
      mapRef.current.addHazard(hazard);
    }
  }

  return (
    <div>
      <MapView ref={mapRef} />
      <HazardList onAddHazard={handleHazardAdded} />
      <div className="tip" style={{ textAlign: 'center', marginTop: 16 }}>
        💡 Tip: Use demo mode to test with sample hazards
      </div>
    </div>
  );
}