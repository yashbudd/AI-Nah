'use client'

import MapView from '@/components/MapView';

export default function MapPage() {
  return (
    <div style={{ height: 'calc(100vh - 250px)', width: '100%' }}>
      <MapView />
    </div>
  );
}
