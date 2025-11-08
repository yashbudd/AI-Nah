'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Next.js environment variable
mapboxgl.accessToken =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoidHJhaWxtaXgiLCJhIjoiY2x6MjN4eWRmMHExZzJrcGxqbm5ybGt4OCJ9.demo_token_replace_with_real_token";

type Hazard = {
  id: string;
  type: "debris" | "water" | "blocked";
  lat: number;
  lng: number;
  timestamp: number;
};

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

  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);

  // two-click routing state
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const startLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const endLLRef = useRef<{ lng: number; lat: number } | null>(null);
  const [routing, setRouting] = useState<{ busy: boolean; error?: string } | null>(null);

  // ---- helpers ----
  function hazardsToGeoJSON() {
    return {
      type: "FeatureCollection",
      features: hazards.map((h) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.lng, h.lat] },
        properties: { id: h.id, type: h.type, timestamp: h.timestamp },
      })),
    } as GeoJSON.FeatureCollection;
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
      center: [-84.389, 33.775],
      zoom: 15,
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

      // geolocation watch
      const watchId = navigator.geolocation.watchPosition(
        (p) => {
          const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
          setPos(coords);

          if (!m.getSource(ME_SOURCE_ID)) {
            m.flyTo({ center: [coords.lng, coords.lat], zoom: 16 });
            m.addSource(ME_SOURCE_ID, {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
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
          } else {
            const source = m.getSource(ME_SOURCE_ID) as mapboxgl.GeoJSONSource;
            source.setData({
              type: "Feature",
              geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
              properties: {},
            } as any);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
      (m as any).geoWatchId = watchId;

      // click to set start/end and route
      m.on("click", async (e) => {
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
    });

    return () => {
      if ((m as any).geoWatchId) navigator.geolocation.clearWatch((m as any).geoWatchId);
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
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coords = { lng: p.coords.longitude, lat: p.coords.latitude };
        setPos(coords);
        mapRef.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 17, duration: 1000, essential: true });
      },
      () => {
        if (pos) {
          mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 17, duration: 800, essential: true });
        } else {
          mapRef.current?.flyTo({ center: [-84.389, 33.775], zoom: 15, duration: 800, essential: true });
          alert("📍 Location not available - please enable location services");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }

  function clearHazards() {
    setHazards([]);
  }

  function addHazard(hazard: { type: "debris" | "water" | "blocked"; lat: number; lng: number }) {
    const newHazard: Hazard = {
      id: Date.now().toString(),
      type: hazard.type,
      lat: hazard.lat,
      lng: hazard.lng,
      timestamp: Date.now(),
    };
    setHazards((prev) => [...prev, newHazard]);

    mapRef.current?.flyTo({ center: [hazard.lng, hazard.lat], zoom: 17, duration: 1000 });
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
          top: 10,
          left: 10,
          zIndex: 1000,
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 6,
          border: "none",
          backgroundColor: "#10B981",
          color: "white",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        📍 Center on Me
      </button>

      {/* Clear Route */}
      <button
        onClick={clearRoute}
        style={{
          position: "absolute",
          top: 10,
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