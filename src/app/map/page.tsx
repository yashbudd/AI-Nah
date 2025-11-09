'use client'

import MapView from '@/components/MapView';

export default function MapPage() {
  return (
    <div style={{ height: 'calc(100vh - 180px)', width: '100%', position: 'relative', background: 'var(--bg-white)' }}>
      <MapView />
    </div>
  );
}
