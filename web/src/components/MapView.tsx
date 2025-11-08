import React, { useEffect, useRef, useState } from "react";
import mapboxgl, { LngLatBoundsLike } from "mapbox-gl";
import { getHazardsBBox, route } from "../api";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

export default function MapView() {
  const mapRef = useRef<mapboxgl.Map|null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{lng:number;lat:number}|null>(null);
  const [hazardCounts, setHazardCounts] = useState({ debris: 0, water: 0, blocked: 0 });

  useEffect(() => {
    const m = new mapboxgl.Map({
      container: containerRef.current!,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-84.389, 33.775], 
      zoom: 15 // Higher zoom for mobile
    });
    mapRef.current = m;

    // Add zoom and rotation controls for mobile
    m.addControl(new mapboxgl.NavigationControl({ 
      showCompass: true,
      showZoom: true,
      visualizePitch: true 
    }), 'top-right');

    m.on("load", ()=>{
      m.addSource("hazards", { type:"geojson", data: { type:"FeatureCollection", features:[] } as any });
      m.addLayer({
        id:"hazards", type:"circle", source:"hazards",
        paint: {
          "circle-radius": 8, // Larger for mobile
          "circle-color": [
            "match", ["get","type"],
            "debris","#D97706",
            "water","#3B82F6",
            "blocked","#EF4444",
            "#10B981"
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
      
      // Add labels for hazards
      m.addLayer({
        id: "hazard-labels",
        type: "symbol",
        source: "hazards",
        layout: {
          "text-field": [
            "match", ["get","type"],
            "debris","🪨",
            "water","💧", 
            "blocked","🚫",
            "⚠️"
          ],
          "text-size": 16,
          "text-offset": [0, 0],
          "text-anchor": "center"
        }
      });
    });

    // Enhanced geolocation for mobile
    const watchId = navigator.geolocation.watchPosition((p)=>{
      const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
      setPos(coords);
      
      // Center map on user location initially
      if (!m.getSource("me")) {
        m.flyTo({ center: [coords.lng, coords.lat], zoom: 16 });
      }
      
      if (!m.getSource("me")) {
        m.addSource("me", { type:"geojson", data: { type:"Feature", geometry:{type:"Point", coordinates:[coords.lng, coords.lat]} } as any });
        m.addLayer({ 
          id:"me", 
          type:"circle", 
          source:"me", 
          paint:{ 
            "circle-color":"#10B981", 
            "circle-radius":10,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff"
          }
        });
      } else {
        const s = m.getSource("me") as mapboxgl.GeoJSONSource;
        s.setData({ type:"Feature", geometry:{type:"Point", coordinates:[coords.lng, coords.lat]} } as any);
      }
    }, (error) => {
      console.error('Geolocation error:', error);
    }, { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 60000 
    });

    const id = setInterval(()=> refreshHazards(), 5000); // More frequent updates for mobile
    return ()=> { 
      clearInterval(id); 
      navigator.geolocation.clearWatch(watchId);
      m.remove(); 
    }
  }, []);

  async function refreshHazards() {
    const m = mapRef.current!;
    const b = m.getBounds();
    const bbox = { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() };
    try {
      const data = await getHazardsBBox(bbox);
      const s = m.getSource("hazards") as mapboxgl.GeoJSONSource;
      s.setData(data);
      
      // Update hazard counts
      const counts = { debris: 0, water: 0, blocked: 0 };
      data.features?.forEach((feature: any) => {
        const type = feature.properties?.type;
        if (type && counts[type as keyof typeof counts] !== undefined) {
          counts[type as keyof typeof counts]++;
        }
      });
      setHazardCounts(counts);
    } catch (error) {
      console.error('Failed to refresh hazards:', error);
    }
  }

  async function rerouteToHere() {
    if (!pos) {
      alert("📍 Getting your location...");
      return;
    }
    
    const dest = mapRef.current!.getCenter();
    try {
      const r = await route(`${pos.lng},${pos.lat}`, `${dest.lng},${dest.lat}`);
      const idx = r.selected ?? 0;
      const geom = r.routes[idx].geometry;
      
      if (!mapRef.current!.getSource("route")) {
        mapRef.current!.addSource("route", { type:"geojson", data: { type:"Feature", geometry: geom } as any });
        mapRef.current!.addLayer({ 
          id:"route", 
          type:"line", 
          source:"route", 
          paint: { 
            "line-width": 4, 
            "line-color":"#22C55E",
            "line-opacity": 0.8
          }
        });
      } else {
        (mapRef.current!.getSource("route") as mapboxgl.GeoJSONSource).setData({ type:"Feature", geometry: geom } as any);
      }
      
      // Show route note with better formatting
      const message = `🛤️ ${r.note || "Route ready"}`;
      alert(message);
    } catch (error) {
      alert("❌ Routing failed. Check connection.");
    }
  }

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

  return (
    <div className="map-container">
      <div ref={containerRef} className="map-view" />
      
      <div className="hazard-count">
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#D97706'}}>{hazardCounts.debris}</span>
          <span className="hazard-count-label">Debris</span>
        </div>
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#3B82F6'}}>{hazardCounts.water}</span>
          <span className="hazard-count-label">Water</span>
        </div>
        <div className="hazard-count-item">
          <span className="hazard-count-number" style={{color: '#EF4444'}}>{hazardCounts.blocked}</span>
          <span className="hazard-count-label">Blocked</span>
        </div>
      </div>
      
      <div className="map-controls">
        <button className="btn-primary" onClick={rerouteToHere} style={{ width: '100%' }}>
          🗺️ Route to Map Center
        </button>
        
        <button className="btn-secondary" onClick={centerOnUser} style={{ width: '100%' }}>
          📍 Center on Me
        </button>
        
        <div className="map-info">
          🎯 Drag map to choose destination, then tap route button
        </div>
      </div>
    </div>
  );
}