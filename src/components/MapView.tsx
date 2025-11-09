'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useHazards } from "@/hooks/useHazards";
import { HazardResponse } from "@/types/hazard-db";

const ENV_EMERGENCY_SMS = process.env.NEXT_PUBLIC_EMERGENCY_SMS?.trim() ?? '';

// Next.js environment variable
mapboxgl.accessToken =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoidHJhaWxtaXgiLCJhIjoiY2x6MjN4eWRmMHExZzJrcGxqbm5ybGt4OCJ9.demo_token_replace_with_real_token";

export interface MapViewRef {
  addHazard: (hazard: { type: "debris" | "water" | "blocked" | "branch" | "other"; lat: number; lng: number }) => void;
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

  const [pos, setPos] = useState<{ lng: number; lat: number }>({ lng: -85.047884, lat: 33.9869289 }); // Hardcoded to trail start
  
  // Use MongoDB hazards hook - fetch hazards around trail coordinates
  const { hazards, loading, error, createHazard, fetchHazards } = useHazards({
    lat: 33.9869289,
    lng: -85.047884,
    radius: 20, // 20km radius should catch AI hazards around trail
    autoFetch: true
  });

  const [hazardRisks, setHazardRisks] = useState<Record<string, number>>({});
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  // Debug hazards changes
  useEffect(() => {
    console.log('Hazards changed:', hazards.length, hazards.map(h => ({ type: h.type, lat: h.latitude, lng: h.longitude })));
  }, [hazards]);

  useEffect(() => {
    if (!hazards.length) {
      setHazardRisks({});
      setRiskLoading(false);
      setRiskError(null);
      return;
    }

    const controller = new AbortController();
    setRiskLoading(true);
    setRiskError(null);

    const payload = {
      hazards: hazards.map((h) => ({
        id: h.id,
        latitude: h.latitude,
        longitude: h.longitude,
        confidence: h.confidence,
        type: h.type,
      })),
    };

    fetch('/api/hazard-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to compute risk');
        }
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.risks)) return;
        const map: Record<string, number> = {};
        for (const risk of data.risks) {
          if (risk?.id) map[risk.id] = risk.riskScore ?? 0;
        }
        setHazardRisks(map);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn('Failed to fetch hazard risk', err);
        setRiskError(err?.message ?? 'Failed to fetch hazard risk');
        setHazardRisks({});
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRiskLoading(false);
        }
      });

    return () => controller.abort();
  }, [hazards]);

  // Periodic refresh to ensure hazards stay current - reduce frequency to avoid UI flicker
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHazards();
    }, 60000); // Refresh every 60 seconds (reduced from 30)

    return () => clearInterval(interval);
  }, [fetchHazards]);

  // two-click routing state
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const startLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const endLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const [routing, setRouting] = useState<{ busy: boolean; error?: string } | null>(null);

  // Manual hazard creation state
  const [showHazardForm, setShowHazardForm] = useState(false);
  const [newHazard, setNewHazard] = useState({
    type: 'debris' as 'debris' | 'water' | 'blocked' | 'branch' | 'other',
    description: ''
  });

  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [emergencyToast, setEmergencyToast] = useState<string | null>(null);
  const emergencyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emergencyNumberIsConfigured = !!ENV_EMERGENCY_SMS;

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
          source: h.source,
          riskScore: h.id ? hazardRisks[h.id] : undefined,
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
    const r = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox, start, end, resolutionMeters }),
    });
    if (!r.ok) {
      const errorData = await r.json().catch(async () => ({ error: await r.text() || "route error" }));
      const errorMessage = errorData.message || errorData.error || "Route calculation failed";
      throw new Error(errorMessage);
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
          "line-color": "#001f03",
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

  const triggerEmergencySimulation = () => {
    if (!emergencyNumberIsConfigured) {
      setShowEmergencyConfirm(false);
      setEmergencyToast('No emergency SMS number configured. Set NEXT_PUBLIC_EMERGENCY_SMS in your .env.local file.');
      if (emergencyToastTimeoutRef.current) {
        clearTimeout(emergencyToastTimeoutRef.current);
      }
      emergencyToastTimeoutRef.current = setTimeout(() => setEmergencyToast(null), 6000);
      return;
    }

    const trimmed = ENV_EMERGENCY_SMS;
    setShowEmergencyConfirm(false);
    const messageBody = `TrailMix SOS: Need assistance near ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}.`;
    setEmergencyToast(`Texting ${trimmed} (simulation)`);
    if (emergencyToastTimeoutRef.current) {
      clearTimeout(emergencyToastTimeoutRef.current);
    }
    emergencyToastTimeoutRef.current = setTimeout(() => setEmergencyToast(null), 5000);

    if (typeof window !== 'undefined') {
      try {
        const smsUrl = `sms:${encodeURIComponent(trimmed)}?body=${encodeURIComponent(messageBody)}`;
        window.location.href = smsUrl;
      } catch (err) {
        console.warn('Unable to open SMS composer:', err);
      }
    }
  };

  // ---- map init ----
  useEffect(() => {
    if (!containerRef.current) return;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-85.047884, 33.9869289], // Trail start coordinates
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

      // hazards source/layers - Initialize with current hazard data
      const initialHazardData = hazardsToGeoJSON();
      m.addSource(HAZARDS_SOURCE_ID, {
        type: "geojson",
        data: initialHazardData,
      });

      m.addLayer({
        id: HAZARDS_LAYER_ID,
        type: "circle",
        source: HAZARDS_SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "riskScore"], 0],
            0, 8,
            5, 12,
            10, 16
          ],
          "circle-color": [
            "case",
            ["has", "riskScore"],
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "riskScore"], 0],
              0, "#34d399",
              4, "#facc15",
              7, "#f97316",
              10, "#dc2626"
            ],
            [
              "match",
              ["get", "type"],
              "debris", "#D97706",
              "water", "#3B82F6",
              "blocked", "#EF4444",
              "branch", "#10B981",
              "other", "#A855F7",
              "#001f03"
            ]
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        layout: {
          "visibility": "visible" // Ensure hazards are always visible
        }
      });

      m.addLayer({
        id: HAZARD_LABELS_ID,
        type: "symbol",
        source: HAZARDS_SOURCE_ID,
        layout: {
          "text-field": ["match", ["get", "type"], 
            "debris", "🪨", 
            "water", "💧", 
            "blocked", "🚫", 
            "branch", "🌿",
            "other", "⚠️",
            "⚠️"], // default fallback
          "text-size": 18,
          "text-anchor": "center",
          "visibility": "visible" // Ensure hazard labels are always visible
        },
      });

      // route source/layer
      ensureRouteSource(m);

      // Hardcode user location to trail start
      const trailStartCoords = { lng: -85.047884, lat: 33.9869289 }; // Trail start coordinates
      setPos(trailStartCoords);

      // Add user location marker immediately at trail start
      m.addSource(ME_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [trailStartCoords.lng, trailStartCoords.lat] },
          properties: {},
        },
      });
      m.addLayer({
        id: ME_LAYER_ID,
        type: "circle",
        source: ME_SOURCE_ID,
        paint: {
          "circle-color": "#001f03",
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
          const riskScore = typeof hazard.properties?.riskScore === 'number'
            ? hazard.properties.riskScore
            : (id && hazardRisks[id]) ?? undefined;
          
          // Find full hazard data
          const fullHazard = hazards.find(h => h.id === id);
          
          // Create popup for hazard
          new mapboxgl.Popup({ closeOnClick: true })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 8px; min-width: 200px;">
                <div style="font-weight: bold; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                  ${type === 'debris' ? '🪨' : type === 'water' ? '💧' : type === 'blocked' ? '🚫' : type === 'branch' ? '🌿' : '⚠️'} 
                  ${type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Hazard'}
                </div>
                ${riskScore !== undefined ? `
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  <strong>Risk Score:</strong> ${riskScore.toFixed(1)} / 10
                </div>
                ` : ''}
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  <strong>Confidence:</strong> ${Math.round((confidence ?? 0) * 100)}%
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                  <strong>Source:</strong> ${source}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                  <strong>Reported:</strong> ${timestamp ? new Date(timestamp).toLocaleDateString() : 'unknown'}
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
            
            // Fit map to show the entire route
            if (route.geometry?.coordinates && route.geometry.coordinates.length > 0) {
              const coords = route.geometry.coordinates as [number, number][];
              const lngs = coords.map(c => c[0]);
              const lats = coords.map(c => c[1]);
              const bounds = new mapboxgl.LngLatBounds(
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)]
              );
              m.fitBounds(bounds, { padding: 50, duration: 1000 });
            }
          } catch (err: any) {
            console.error('Route calculation error:', err);
            setRouting({ busy: false, error: err?.message ?? "Routing failed. Make sure start and end points are within the map view." });
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

      // Ensure hazards are visible after map load - improved timing
      setTimeout(() => {
        if (m.getLayer(HAZARDS_LAYER_ID)) {
          m.setLayoutProperty(HAZARDS_LAYER_ID, 'visibility', 'visible');
        }
        if (m.getLayer(HAZARD_LABELS_ID)) {
          m.setLayoutProperty(HAZARD_LABELS_ID, 'visibility', 'visible');
        }
        // Force initial hazard data load
        const src = m.getSource(HAZARDS_SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (src && hazards.length > 0) {
          src.setData(hazardsToGeoJSON() as any);
        }
        console.log('Map loaded with hazards visible, initial count:', hazards.length);
      }, 1000); // Increased delay to ensure everything is ready
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

  // hazards -> map sync with improved stability
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    
    const updateHazards = () => {
      const src = map.getSource(HAZARDS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (src && hazards.length >= 0) { // Check for array existence, allow empty arrays
        const geoData = hazardsToGeoJSON();
        src.setData(geoData as any);
        
        console.log(`Updated map with ${hazards.length} hazards`);
        
        // Force visibility after data update with a small delay
        setTimeout(() => {
          if (map.getLayer(HAZARDS_LAYER_ID)) {
            map.setLayoutProperty(HAZARDS_LAYER_ID, 'visibility', 'visible');
          }
          if (map.getLayer(HAZARD_LABELS_ID)) {
            map.setLayoutProperty(HAZARD_LABELS_ID, 'visibility', 'visible');
          }
        }, 100);
      }
    };

    // Add delay to ensure map is ready
    setTimeout(updateHazards, 100);
  }, [hazards, hazardRisks]);

  // actions
  function centerOnUser() {
    // Always center on hardcoded trail start location
    const trailStartCoords = { lng: -85.047884, lat: 33.9869289 }; // Trail start coordinates
    mapRef.current?.flyTo({ 
      center: [trailStartCoords.lng, trailStartCoords.lat], 
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

  async function addHazard(hazard: { type: "debris" | "water" | "blocked" | "branch" | "other"; lat: number; lng: number }) {
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

  useEffect(() => {
    return () => {
      if (emergencyToastTimeoutRef.current) {
        clearTimeout(emergencyToastTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Center on Me */}
      <button
        onClick={centerOnUser}
        className="map-control-button"
        style={{
          top: 160,
          right: 10,
        }}
        title="Get my location"
      >
        📍
      </button>

      {/* Clear Route */}
      <button
        onClick={clearRoute}
        className="map-action-button"
        style={{
          top: 210,
          right: 10,
          background: "linear-gradient(135deg, #111827 0%, #1F2937 100%)",
        }}
      >
        <span>🗺️</span>
        <span>Clear Route</span>
      </button>

      {/* Add Hazard Button */}
      <button
        onClick={() => setShowHazardForm(!showHazardForm)}
        className="map-action-button"
        style={{
          top: 260,
          right: 10,
          background: showHazardForm 
            ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)" 
            : "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
        }}
      >
        <span>{showHazardForm ? "❌" : "⚠️"}</span>
        <span>{showHazardForm ? "Cancel" : "Add Hazard"}</span>
      </button>

      {/* Manual Hazard Form */}
      {showHazardForm && (
        <div className="map-hazard-form" style={{ top: 310, right: 10 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "var(--text-dark)" }}>
            Add Hazard at Map Center
          </h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-dark)" }}>
              Type:
            </label>
            <select
              value={newHazard.type}
              onChange={(e) => setNewHazard(prev => ({ 
                ...prev, 
                type: e.target.value as 'debris' | 'water' | 'blocked' | 'branch' | 'other'
              }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                background: "white",
                cursor: "pointer",
                transition: "all var(--transition-base)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--primary-dark)";
                e.target.style.boxShadow = "0 0 0 3px rgba(0, 31, 3, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-light)";
                e.target.style.boxShadow = "none";
              }}
            >
              <option value="debris">🪨 Debris</option>
              <option value="water">💧 Water</option>
              <option value="blocked">🚫 Blocked</option>
              <option value="branch">🌿 Branch</option>
              <option value="other">⚠️ Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-dark)" }}>
              Description:
            </label>
            <input
              type="text"
              value={newHazard.description}
              onChange={(e) => setNewHazard(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Fallen tree blocking trail"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                transition: "all var(--transition-base)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--primary-dark)";
                e.target.style.boxShadow = "0 0 0 3px rgba(0, 31, 3, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-light)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={createManualHazard}
              disabled={loading}
              className="btn-primary"
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 14,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Creating..." : "Create Hazard"}
            </button>
            <button
              onClick={() => setShowHazardForm(false)}
              style={{
                padding: "10px 16px",
                backgroundColor: "#6B7280",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all var(--transition-base)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#4B5563";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#6B7280";
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Emergency button */}
      <button
        onClick={() => setShowEmergencyConfirm(true)}
        className="map-action-button"
        style={{
          top: 210,
          left: 10,
          right: undefined,
          background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
        }}
      >
        <span>🚨</span>
        <span>Emergency</span>
      </button>

      {showEmergencyConfirm && (
        <div
          style={{
            position: "absolute",
            top: 260,
            left: 10,
            zIndex: 1000,
            background: "white",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            border: "1px solid var(--border-light)",
            padding: 16,
            maxWidth: 260,
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 700 }}>Text My Emergency Contact?</h3>
          <p style={{ fontSize: 13, color: "var(--text-medium)", margin: "0 0 12px 0" }}>
            This simulation opens your SMS app to send a TrailMix alert. An Azure workflow can automate dispatch in production.
          </p>
          <div style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--border-light)',
            background: 'var(--bg-secondary)',
            marginBottom: 12,
            fontSize: 14,
            fontWeight: 600,
            color: emergencyNumberIsConfigured ? 'var(--text-dark)' : '#DC2626',
          }}>
            {emergencyNumberIsConfigured ? `Configured number: ${ENV_EMERGENCY_SMS}` : 'No number configured'}
          </div>
          {!emergencyNumberIsConfigured && (
            <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px 0' }}>
              Set <code>NEXT_PUBLIC_EMERGENCY_SMS</code> in <code>.env.local</code> and rebuild.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={triggerEmergencySimulation}
              className="btn-primary"
              style={{ flex: 1, padding: "8px 16px", opacity: emergencyNumberIsConfigured ? 1 : 0.6 }}
              disabled={!emergencyNumberIsConfigured}
            >
              Send Text
            </button>
            <button
              onClick={() => {
                setShowEmergencyConfirm(false);
              }}
              style={{
                padding: "8px 16px",
                background: "#6B7280",
                color: "white",
                borderRadius: "var(--radius-md)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hazard Status */}
      {hazards.length > 0 && (
        <div className="map-status-badge info" style={{ bottom: 80, left: 10 }}>
          📍 {hazards.length} {hazards.length === 1 ? 'Hazard' : 'Hazards'}
        </div>
      )}

      {riskLoading && (
        <div className="map-status-badge info" style={{ bottom: 120, left: 10 }}>
          🔄 Calculating risk…
        </div>
      )}

      {riskError && (
        <div className="map-status-badge error" style={{ bottom: riskLoading ? 150 : 120, left: 10 }}>
          ⚠️ {riskError}
        </div>
      )}

      {error && (
        <div className="map-status-badge error" style={{ bottom: 80, left: 10 }}>
          ❌ Error
        </div>
      )}

      {/* Route status */}
      {routing?.busy && (
        <div className="map-status-badge info" style={{ bottom: 10, left: "50%", transform: "translateX(-50%)" }}>
          ⏳ Computing route…
        </div>
      )}
      {routing?.error && (
        <div className="map-status-badge error" style={{ bottom: 10, left: "50%", transform: "translateX(-50%)" }}>
          ❌ {routing.error}
        </div>
      )}

      {emergencyToast && (
        <div
          className="map-status-badge info"
          style={{
            top: 160,
            left: 10,
            right: undefined,
            bottom: undefined,
            background: "rgba(17,24,39,0.85)",
          }}
        >
          {emergencyToast}
        </div>
      )}
    </div>
  );
});

MapView.displayName = "MapView";
export default MapView;