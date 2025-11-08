// Simple geolocation watcher. Call startGeo() once on mount; it keeps last fix in a ref-like object.
export type LatLng = { lat: number; lng: number };

export function startGeo(onUpdate: (pos: LatLng) => void) {
  if (!('geolocation' in navigator)) return { stop() {} };

  const id = navigator.geolocation.watchPosition(
    (p) => onUpdate({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => {}, // ignore errors (user may deny)
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 7_000 }
  );

  return { stop() { navigator.geolocation.clearWatch(id); } };
}
