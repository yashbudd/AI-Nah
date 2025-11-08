'use client'

import { useRef } from 'react';
import DetectionView from '@/components/DetectionView';
import MapView from '@/components/MapView';

export default function DetectPage() {
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
      <div className="tip" style={{ textAlign: 'center', marginTop: 16 }}>
        💡 Tip: Report hazards with camera, see them on map below
      </div>
    </div>
  );
}