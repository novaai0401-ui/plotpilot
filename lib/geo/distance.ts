/**
 * Haversine distance in kilometers between two lat/lng points.
 * Good to ~0.5% accuracy, fast enough to compute in a JS loop for thousands of pairs.
 */
const EARTH_KM = 6371;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Quick city-name match for orgs without lat/lng. Case-insensitive substring.
 * "Bangalore" matches "bangalore", "Bangalore South", "bangalore-urban", etc.
 */
export function cityMatches(orgCity?: string | null, leadCity?: string | null): boolean {
  if (!orgCity || !leadCity) return false;
  const a = orgCity.trim().toLowerCase();
  const b = leadCity.trim().toLowerCase();
  return a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a));
}
