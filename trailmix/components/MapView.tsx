import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";

// Next.js environment variable
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoidHJhaWxtaXgiLCJhIjoiY2x6MjN4eWRmMHExZzJrcGxqbm5ybGt4OCJ9.demo_token_replace_with_real_token';

type Hazard = {
  id: string;
  type: "debris" | "water" | "blocked";
  lat: number;
  lng: number;
  timestamp: number;
};

export interface MapViewRef {
  addHazard: (hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) => void;
}

const MapView = forwardRef<MapViewRef>((_, ref) => {
  const mapRef = useRef<mapboxgl.Map|null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{lng:number;lat:number}|null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-84.389, 33.775], 
      zoom: 15
    });
    mapRef.current = m;

    // Add controls for mobile
    m.addControl(new mapboxgl.NavigationControl({ 
      showCompass: true,
      showZoom: true 
    }), 'top-right');

    m.on("load", () => {
      // Add hazards source
      m.addSource("hazards", { 
        type: "geojson", 
        data: { type: "FeatureCollection", features: [] } 
      });
      
      // Add hazard markers
      m.addLayer({
        id: "hazards", 
        type: "circle", 
        source: "hazards",
        paint: {
          "circle-radius": 10,
          "circle-color": [
            "match", 
            ["get", "type"],
            "debris", "#D97706",
            "water", "#3B82F6",
            "blocked", "#EF4444",
            "#10B981"
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff"
        }
      });
      
      // Add emoji labels
      m.addLayer({
        id: "hazard-labels",
        type: "symbol",
        source: "hazards",
        layout: {
          "text-field": [
            "match", 
            ["get", "type"],
            "debris", "🪨",
            "water", "💧", 
            "blocked", "🚫",
            "⚠️"
          ],
          "text-size": 18,
          "text-anchor": "center"
        }
      });

      // Get user location - moved inside load event to avoid "Style is not done loading" error
      const watchId = navigator.geolocation.watchPosition((p) => {
        const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
        setPos(coords);
        
        // Center map on first location
        if (!m.getSource("me")) {
          m.flyTo({ center: [coords.lng, coords.lat], zoom: 16 });
        }
        
        // Update user location marker
        if (!m.getSource("me")) {
          m.addSource("me", { 
            type: "geojson", 
            data: { 
              type: "Feature", 
              geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
              properties: {}
            } 
          });
          m.addLayer({ 
            id: "me", 
            type: "circle", 
            source: "me", 
            paint: { 
              "circle-color": "#10B981", 
              "circle-radius": 12,
              "circle-stroke-width": 4,
              "circle-stroke-color": "#ffffff"
            }
          });
        } else {
          const source = m.getSource("me") as mapboxgl.GeoJSONSource;
          source.setData({ 
            type: "Feature", 
            geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
            properties: {}
          });
        }
      }, (error) => {
        console.error('Geolocation error:', error);
      }, { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000 
      });

      // Store watchId for cleanup
      (m as any).geoWatchId = watchId;
    });

    return () => { 
      if ((m as any).geoWatchId) {
        navigator.geolocation.clearWatch((m as any).geoWatchId);
      }
      m.remove(); 
    }
  }, []);

  // Update hazards on map when hazards state changes
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getSource("hazards")) return;

    const geojsonData = {
      type: "FeatureCollection",
      features: hazards.map(hazard => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [hazard.lng, hazard.lat]
        },
        properties: {
          id: hazard.id,
          type: hazard.type,
          timestamp: hazard.timestamp
        }
      }))
    };

    const source = mapRef.current.getSource("hazards") as mapboxgl.GeoJSONSource;
    source.setData(geojsonData as any);
  }, [hazards]);

  function centerOnUser() {
    if (!pos) {
      alert("📍 Location not available");
      return;
    }
    mapRef.current?.flyTo({ 
      center: [pos.lng, pos.lat], 
      zoom: 16,
      duration: 1000
    });
  }

  function clearHazards() {
    setHazards([]);
  }

  function addHazard(hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) {
    const newHazard: Hazard = {
      id: Date.now().toString(),
      type: hazard.type,
      lat: hazard.lat,
      lng: hazard.lng,
      timestamp: Date.now()
    };

    setHazards(prev => [...prev, newHazard]);
    
    // Fly to the new hazard
    mapRef.current?.flyTo({
      center: [hazard.lng, hazard.lat],
      zoom: 17,
      duration: 1000
    });
  }

  useImperativeHandle(ref, () => ({
    addHazard
  }));

  return (
    <div className="map-container">
      <div ref={containerRef} className="map-view" />
      
      <div className="hazard-count">
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#D97706'}}>
            {hazards.filter(h => h.type === 'debris').length}
          </span>
          <span className="hazard-count-label">Debris</span>
        </div>
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#3B82F6'}}>
            {hazards.filter(h => h.type === 'water').length}
          </span>
          <span className="hazard-count-label">Water</span>
        </div>
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#EF4444'}}>
            {hazards.filter(h => h.type === 'blocked').length}
          </span>
          <span className="hazard-count-label">Blocked</span>
        </div>
      </div>
      
      <div className="map-controls">
        <button className="btn-primary" onClick={centerOnUser} style={{ width: '100%' }}>
          📍 Center on Me
        </button>
        
        <button className="btn-secondary" onClick={clearHazards} style={{ width: '100%' }}>
          🧹 Clear Hazards
        </button>
        
        <div className="map-info">
          🎯 {hazards.length} hazard{hazards.length !== 1 ? 's' : ''} reported
        </div>
      </div>
    </div>
  );
});

MapView.displayName = "MapView";
export default MapView;