import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';

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
      zoom: 15,
      attributionControl: false // Remove default attribution control
    });
    mapRef.current = m;

    // Add custom attribution control in a better position
    m.addControl(new mapboxgl.AttributionControl({
      compact: true,
      customAttribution: 'TrailMix'
    }), 'bottom-left');

    // Add controls for mobile
    const navControl = new mapboxgl.NavigationControl({ 
      showCompass: true,
      showZoom: true 
    });
    m.addControl(navControl, 'top-right');

    console.log('Controls added:', { navControl });

    m.on("load", () => {
      // Resize map to fit container properly
      setTimeout(() => m.resize(), 100);
      
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
        console.log('Location updated:', coords);
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
        // Try to get position once if watch fails
        navigator.geolocation.getCurrentPosition((p) => {
          const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
          console.log('Fallback location:', coords);
          setPos(coords);
          m.flyTo({ center: [coords.lng, coords.lat], zoom: 16 });
        }, () => {
          console.log('Both geolocation methods failed');
        });
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

  // Handle window resize to ensure map fits properly
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    // Always try to get fresh location for better accuracy
    navigator.geolocation.getCurrentPosition((p) => {
      const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
      console.log('Centering on user location:', coords);
      setPos(coords);
      
      // Center the map on user with a good zoom level
      mapRef.current?.flyTo({ 
        center: [coords.lng, coords.lat], 
        zoom: 17,
        duration: 1000,
        essential: true // This makes the animation essential for accessibility
      });
    }, (error) => {
      console.error('Geolocation error:', error);
      
      // If fresh location fails, try using stored position
      if (pos) {
        console.log('Using stored position:', pos);
        mapRef.current?.flyTo({ 
          center: [pos.lng, pos.lat], 
          zoom: 17,
          duration: 800,
          essential: true
        });
      } else {
        // Fallback to Atlanta if no position available
        console.log('No location available, using Atlanta fallback');
        mapRef.current?.flyTo({
          center: [-84.389, 33.775],
          zoom: 15,
          duration: 800,
          essential: true
        });
        alert("📍 Location not available - please enable location services");
      }
    }, { 
      enableHighAccuracy: true, 
      timeout: 8000, 
      maximumAge: 10000 // Accept cached location up to 10 seconds old
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
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%' 
        }} 
      />
      
      {/* Center on Me button positioned over the map */}
      <button 
        onClick={centerOnUser}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          padding: '8px 12px',
          fontSize: '14px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#10B981',
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        📍 Center on Me
      </button>
    </div>
  );
});

MapView.displayName = "MapView";
export default MapView;