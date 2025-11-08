'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

type MapViewHandle = {
  addPoint: (lng: number, lat: number, color?: string) => void;
};

type MapViewProps = {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { center = [-84.389, 33.749], zoom = 12 },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    addPoint(lng: number, lat: number, color = '#ff3b30') {
      const map = mapRef.current;
      if (!map) return;
      new mapboxgl.Marker({ color }).setLngLat([lng, lat]).addTo(map);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
      });

      map.addControl(new mapboxgl.NavigationControl({ showZoom: true }));

      map.on('error', (e) => {
        console.error(e?.error || e);
      });

      mapRef.current = map;
      return () => map.remove();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Map init error');
    }
  }, [center[0], center[1], zoom]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 420 }}>
      {error ? (
        <div style={{ padding: 12, color: '#b91c1c' }}>{error}</div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
});

export default MapView;