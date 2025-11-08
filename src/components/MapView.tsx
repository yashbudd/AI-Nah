'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useHazards } from "@/hooks/useHazards";
import { HazardResponse } from "@/types/hazard-db";

// Next.js environment variable
mapboxgl.accessToken =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoidHJhaWxtaXgiLCJhIjoiY2x6MjN4eWRmMHExZzJrcGxqbm5ybGt4OCJ9.demo_token_replace_with_real_token";

export interface MapViewRef {
  addHazard: (hazard: { type: "debris" | "water" | "blocked"; lat: number; lng: number }) => void;
}

const ROUTE_SOURCE_ID = "hazard-route";
const ROUTE_LAYER_ID = "hazard-route-line";
const HAZARDS_SOURCE_ID = "hazards";
const HAZARDS_LAYER_ID = "hazards";
const HAZARD_LABELS_ID = "hazard-labels";
const ME_SOURCE_ID = "me";
const ME_LAYER_ID = "me";

const MapView = forwardRef<MapViewRef>((_, ref) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<{ lng: number; lat: number }>({ lng: -83.802681, lat: 34.648460 }); // Hardcoded to forest
  
  // Use MongoDB hazards hook
  const { hazards, loading, error, createHazard } = useHazards({
    lat: 34.648460,
    lng: -83.802681,
    radius: 10,
    autoFetch: true
  });

  // two-click routing state
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const startLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const endLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const [routing, setRouting] = useState<{ busy: boolean; error?: string } | null>(null);

  // Manual hazard creation state
  const [showHazardForm, setShowHazardForm] = useState(false);
  const [newHazard, setNewHazard] = useState({
    type: 'debris' as 'debris' | 'water' | 'blocked',
    description: ''
  });

    // ---- helpers ----
  function hazardsToGeoJSON() {
    return {
      type: "FeatureCollection" as const,
      features: hazards.map((h) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [h.longitude, h.latitude] },
        properties: { 
          id: h.id, 
          type: h.type, 
          confidence: h.confidence,
          timestamp: h.timestamp,
          source: h.source
        },
      })),
    };
  }

  async function fetchRoute(
    bbox: [number, number, number, number],
    start: { lng: number; lat: number },
    end: { lng: number; lat: number },
    resolutionMeters = 8
  ): Promise<GeoJSON.Feature<GeoJSON.LineString>> {
    const r = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox, start, end, resolutionMeters }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || "route error");
    }
    return r.json();
  }

  function ensureRouteSource(map: mapboxgl.Map) {
    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-width": 4,
          "line-color": "#10B981",
          "line-opacity": 0.9,
        },
      });
    }
  }

  function setRouteData(routeGeo: GeoJSON.Feature<GeoJSON.LineString> | null) {
    const map = mapRef.current;
    if (!map) return;
    ensureRouteSource(map);

    const src = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (!routeGeo) {
      src.setData({ type: "FeatureCollection", features: [] } as any);
    } else {
      src.setData(routeGeo as any);
    }
  }

  function clearRoute() {
    setRouteData(null);
    startLLRef.current = null;
    endLLRef.current = null;
    startMarkerRef.current?.remove();
    endMarkerRef.current?.remove();
    startMarkerRef.current = null;
    endMarkerRef.current = null;
    setRouting(null);
  }

  function addMarker(ll: { lng: number; lat: number }, color: string) {
    const map = mapRef.current!;
    return new mapboxgl.Marker({ color }).setLngLat([ll.lng, ll.lat]).addTo(map);
  }

  // ---- map init ----
  useEffect(() => {
    if (!containerRef.current) return;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-83.802681, 34.648460], // Chattahoochee Forest
      zoom: 14,
      attributionControl: false,
    });
    mapRef.current = m;

    m.addControl(
      new mapboxgl.AttributionControl({ compact: true, customAttribution: "TrailMix" }),
      "bottom-left"
    );

    const navControl = new mapboxgl.NavigationControl({ showCompass: true, showZoom: true });
    m.addControl(navControl, "top-right");

    m.on("load", () => {
      setTimeout(() => m.resize(), 100);

      // hazards source/layers
      m.addSource(HAZARDS_SOURCE_ID, {
        type: "geojson",
        data: hazardsToGeoJSON(),
      });

      m.addLayer({
        id: HAZARDS_LAYER_ID,
        type: "circle",
        source: HAZARDS_SOURCE_ID,
        paint: {
          "circle-radius": 10,
          "circle-color": [
            "match",
            ["get", "type"],
            "debris",
            "#D97706",
            "water",
            "#3B82F6",
            "blocked",
            "#EF4444",
            "#10B981",
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      m.addLayer({
        id: HAZARD_LABELS_ID,
        type: "symbol",
        source: HAZARDS_SOURCE_ID,
        layout: {
          "text-field": ["match", ["get", "type"], "debris", "🪨", "water", "💧", "blocked", "🚫", "⚠️"],
          "text-size": 18,
          "text-anchor": "center",
        },
      });

      // route source/layer
      ensureRouteSource(m);

      // Hardcode user location to Chattahoochee National Forest trail
      const forestCoords = { lng: -83.802681, lat: 34.648460 }; // Chattahoochee Forest
      setPos(forestCoords);

      // Add user location marker immediately at forest location
      m.addSource(ME_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [forestCoords.lng, forestCoords.lat] },
          properties: {},
        },
      });
      m.addLayer({
        id: ME_LAYER_ID,
        type: "circle",
        source: ME_SOURCE_ID,
        paint: {
          "circle-color": "#10B981",
          "circle-radius": 12,
          "circle-stroke-width": 4,
          "circle-stroke-color": "#ffffff",
        },
      });

      // click to set start/end and route OR show hazard details
      m.on("click", async (e) => {
        // Check if we clicked on a hazard first
        const features = m.queryRenderedFeatures(e.point, {
          layers: [HAZARDS_LAYER_ID]
        });
        
        if (features.length > 0) {
          const hazard = features[0];
          const { type, confidence, timestamp, source, id } = hazard.properties || {};
          
          // Find full hazard data
          const fullHazard = hazards.find(h => h.id === id);
          
          // Create popup for hazard
          new mapboxgl.Popup({ closeOnClick: true })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 8px; min-width: 200px;">
                <div style="font-weight: bold; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                  ${type === 'debris' ? '🪨' : type === 'water' ? '💧' : '🚫'} 
                  ${type.charAt(0).toUpperCase() + type.slice(1)} Hazard
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  <strong>Confidence:</strong> ${Math.round(confidence * 100)}%
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  <strong>Source:</strong> ${source}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                  <strong>Reported:</strong> ${new Date(timestamp).toLocaleDateString()}
                </div>
                ${fullHazard?.description ? `
                  <div style="font-size: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                    ${fullHazard.description}
                  </div>
                ` : ''}
              </div>
            `)
            .addTo(m);
          
          return; // Don't process routing if we clicked on a hazard
        }

        // Original routing logic
        const ll = { lng: e.lngLat.lng, lat: e.lngLat.lat };

        // first click => start, second => end
        if (!startLLRef.current) {
          startLLRef.current = ll;
          startMarkerRef.current?.remove();
          startMarkerRef.current = addMarker(ll, "#111827"); // charcoal
          setRouteData(null);
          setRouting(null);
          return;
        }

        if (!endLLRef.current) {
          endLLRef.current = ll;
          endMarkerRef.current?.remove();
          endMarkerRef.current = addMarker(ll, "#2563EB"); // blue

          // compute route within current viewport bbox
          try {
            setRouting({ busy: true });
            const b = m.getBounds();
            const bbox: [number, number, number, number] = [
              b.getWest(),
              b.getSouth(),
              b.getEast(),
              b.getNorth(),
            ];

            const route = await fetchRoute(bbox, startLLRef.current, endLLRef.current, 8);
            setRouteData(route);
            setRouting({ busy: false });
          } catch (err: any) {
            setRouting({ busy: false, error: err?.message ?? "Routing failed" });
            // keep markers so the user can try again
          }
          return;
        }

        // third click: reset and start new start point
        clearRoute();
        startLLRef.current = ll;
        startMarkerRef.current = addMarker(ll, "#111827");
      });

      // Add hover effects for hazards
      m.on('mouseenter', HAZARDS_LAYER_ID, () => {
        m.getCanvas().style.cursor = 'pointer';
      });

      m.on('mouseleave', HAZARDS_LAYER_ID, () => {
        m.getCanvas().style.cursor = '';
      });
    });

    return () => {
      m.remove();
    };
  }, []);

  // window resize
  useEffect(() => {
    const handleResize = () => mapRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // hazards -> map sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(HAZARDS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(hazardsToGeoJSON() as any);
  }, [hazards]);

  // actions
  function centerOnUser() {
    // Always center on hardcoded forest location
    const forestCoords = { lng: -83.802681, lat: 34.648460 }; // Chattahoochee Forest
    mapRef.current?.flyTo({ 
      center: [forestCoords.lng, forestCoords.lat], 
      zoom: 17, 
      duration: 1000, 
      essential: true 
    });
  }

  function clearHazards() {
    // Clear hazards by reloading from database
    // For now, just alert - you could implement a delete API
    alert("Clear hazards functionality - would delete from database");
  }

  async function addHazard(hazard: { type: "debris" | "water" | "blocked"; lat: number; lng: number }) {
    // Use MongoDB to create hazard
    const newHazard = await createHazard({
      longitude: hazard.lng,
      latitude: hazard.lat,
      type: hazard.type,
      confidence: 0.8, // Default confidence for manual entries
      source: 'manual',
      description: `Manual ${hazard.type} report`
    });

    if (newHazard) {
      // Fly to the new hazard
      mapRef.current?.flyTo({
        center: [newHazard.longitude, newHazard.latitude],
        zoom: 17,
        duration: 1000
      });
    }
  }

  async function createManualHazard() {
    if (!newHazard.description.trim()) {
      alert('Please enter a description for the hazard');
      return;
    }

    const center = mapRef.current?.getCenter();
    if (!center) return;

    const hazard = await createHazard({
      longitude: center.lng,
      latitude: center.lat,
      type: newHazard.type,
      confidence: 0.9, // High confidence for manual entries
      source: 'manual',
      description: newHazard.description
    });

    if (hazard) {
      // Reset form
      setNewHazard({ type: 'debris', description: '' });
      setShowHazardForm(false);
      
      // Fly to the new hazard
      mapRef.current?.flyTo({
        center: [hazard.longitude, hazard.latitude],
        zoom: 17,
        duration: 1000
      });
    }
  }

  useImperativeHandle(ref, () => ({ addHazard }));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Center on Me */}
      <button
        onClick={centerOnUser}
        style={{
          position: "absolute",
          top: 160, // Moved down to be below navigation controls
          right: 10,
          zIndex: 1000,
          width: 40,
          height: 40,
          borderRadius: 4,
          border: "none",
          backgroundColor: "#fff",
          color: "#404040",
          cursor: "pointer",
          boxShadow: "0 0 0 2px rgba(0,0,0,.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f8f9fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#fff";
        }}
        title="Get my location"
      >
        📍
      </button>

      {/* Clear Route */}
      <button
        onClick={clearRoute}
        style={{
          position: "absolute",
          top: 210, // Moved down below the center on me button
          right: 10,
          zIndex: 1000,
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 6,
          border: "none",
          backgroundColor: "#111827",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        🗺️ Clear Route
      </button>

      {/* Add Hazard Button */}
      <button
        onClick={() => setShowHazardForm(!showHazardForm)}
        style={{
          position: "absolute",
          top: 260,
          right: 10,
          zIndex: 1000,
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 6,
          border: "none",
          backgroundColor: showHazardForm ? "#DC2626" : "#16A34A",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {showHazardForm ? "❌ Cancel" : "⚠️ Add Hazard"}
      </button>

      {/* Manual Hazard Form */}
      {showHazardForm && (
        <div
          style={{
            position: "absolute",
            top: 310,
            right: 10,
            zIndex: 1000,
            backgroundColor: "white",
            padding: "16px",
            borderRadius: 8,
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            minWidth: 250,
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Add Hazard at Map Center</h3>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>Type:</label>
            <select
              value={newHazard.type}
              onChange={(e) => setNewHazard(prev => ({ 
                ...prev, 
                type: e.target.value as 'debris' | 'water' | 'blocked' 
              }))}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 14,
              }}
            >
              <option value="debris">🌳 Debris</option>
              <option value="water">💧 Water</option>
              <option value="blocked">🚧 Blocked</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>Description:</label>
            <input
              type="text"
              value={newHazard.description}
              onChange={(e) => setNewHazard(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Fallen tree blocking trail"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={createManualHazard}
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 16px",
                backgroundColor: "#16A34A",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {loading ? "Creating..." : "Create Hazard"}
            </button>
            <button
              onClick={() => setShowHazardForm(false)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6B7280",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hazard Status */}
      {hazards.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 10,
            zIndex: 1000,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            borderRadius: 20,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          📍 {hazards.length}
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 10,
            zIndex: 1000,
            background: "rgba(220, 38, 38, 0.9)",
            color: "white",
            borderRadius: 20,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          ❌ Error
        </div>
      )}

      {/* Route status */}
      {routing?.busy && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(17,24,39,0.8)",
            color: "white",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Computing route…
        </div>
      )}
      {routing?.error && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(220,38,38,0.9)",
            color: "white",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {routing.error}
        </div>
      )}
    </div>
  );
});

MapView.displayName = "MapView";
export default MapView;