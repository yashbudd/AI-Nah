'use client'

import DetectionView from '@/components/DetectionView';

export default function DetectPage() {
  async function getPosition() {
    return new Promise<{lat:number;lng:number}>((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lng:p.coords.longitude }), rej, { enableHighAccuracy:true });
    });
  }

  //mongodb integration to be added later
  function handleHazardReport(hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) {
    // In a real app, this would sync with a global state or API
    console.log('Hazard reported:', hazard);
    alert(`Hazard reported: ${hazard.type} at ${hazard.lat.toFixed(4)}, ${hazard.lng.toFixed(4)}`);
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-white)' }}>
      <DetectionView />
    </div>
  );
}