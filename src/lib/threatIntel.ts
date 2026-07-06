import { Asset, Threat, Alert, Geofence } from '@/types/tactical';

export interface PredictedPosition {
  lat: number;
  lng: number;
  altitude?: number;
  timeSeconds: number;
}

export interface PredictedPath {
  assetId: string;
  positions: PredictedPosition[];
}

// San Antonio military/critical zones
export const SAN_ANTONIO_GEOFENCES: Geofence[] = [
  {
    id: 'jbsa-lackland',
    name: 'JBSA-Lackland',
    type: 'circle',
    coordinates: [[-98.6176, 29.3863]],
    radius: 5000, // 5km
    alertOnEntry: true,
    alertOnExit: false,
  },
  {
    id: 'jbsa-randolph',
    name: 'JBSA-Randolph',
    type: 'circle',
    coordinates: [[-98.2789, 29.5296]],
    radius: 4000,
    alertOnEntry: true,
    alertOnExit: false,
  },
  {
    id: 'fort-sam-houston',
    name: 'Fort Sam Houston',
    type: 'circle',
    coordinates: [[-98.4215, 29.4732]],
    radius: 3000,
    alertOnEntry: true,
    alertOnExit: false,
  },
  {
    id: 'camp-bullis',
    name: 'Camp Bullis',
    type: 'circle',
    coordinates: [[-98.5897, 29.6402]],
    radius: 4000,
    alertOnEntry: true,
    alertOnExit: false,
  },
  {
    id: 'san-antonio-downtown',
    name: 'Downtown San Antonio',
    type: 'circle',
    coordinates: [[-98.4936, 29.4241]],
    radius: 2500,
    alertOnEntry: true,
    alertOnExit: false,
  },
];

// Predict future positions based on current heading and speed
export function predictPath(asset: Asset, seconds: number = 300, interval: number = 30): PredictedPosition[] {
  const positions: PredictedPosition[] = [];
  const headingRad = ((asset.heading || 0) * Math.PI) / 180;
  const speedKnots = asset.speed || 0;
  const speedMps = speedKnots * 0.514444; // knots to m/s

  // Approximate degrees per meter at the asset's current latitude
  const latPerMeter = 1 / 110574;
  const lngPerMeter = 1 / (111320 * Math.cos((asset.position.lat * Math.PI) / 180));

  for (let t = interval; t <= seconds; t += interval) {
    const distanceM = speedMps * t;
    const deltaLat = distanceM * Math.cos(headingRad) * latPerMeter;
    const deltaLng = distanceM * Math.sin(headingRad) * lngPerMeter;

    positions.push({
      lat: asset.position.lat + deltaLat,
      lng: asset.position.lng + deltaLng,
      altitude: asset.position.altitude,
      timeSeconds: t,
    });
  }

  return positions;
}

// Haversine distance in meters between two lat/lng points
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if a point is inside a geofence
export function isPointInGeofence(lat: number, lng: number, geofence: Geofence): boolean {
  if (geofence.type === 'circle' && geofence.radius) {
    const center = geofence.coordinates[0];
    return haversineDistance(lat, lng, center[1], center[0]) <= geofence.radius;
  }
  // Polygon support can be added here with ray casting
  return false;
}

// Detect which geofence an asset is currently inside
export function detectGeofenceViolations(
  assets: Asset[],
  geofences: Geofence[]
): { asset: Asset; geofence: Geofence; distance: number }[] {
  const violations: { asset: Asset; geofence: Geofence; distance: number }[] = [];

  for (const asset of assets) {
    for (const geofence of geofences) {
      const distance = haversineDistance(
        asset.position.lat,
        asset.position.lng,
        geofence.coordinates[0][1],
        geofence.coordinates[0][0]
      );
      if (distance <= (geofence.radius || 0)) {
        violations.push({ asset, geofence, distance });
      }
    }
  }

  return violations;
}

// Predict if any asset will enter a geofence within the prediction window
export function predictGeofenceIncursions(
  assets: Asset[],
  geofences: Geofence[],
  seconds: number = 300
): { asset: Asset; geofence: Geofence; timeToEntry: number; distance: number }[] {
  const incursions: { asset: Asset; geofence: Geofence; timeToEntry: number; distance: number }[] = [];

  for (const asset of assets) {
    const path = predictPath(asset, seconds);
    for (const geofence of geofences) {
      for (const pos of path) {
        const distance = haversineDistance(
          pos.lat,
          pos.lng,
          geofence.coordinates[0][1],
          geofence.coordinates[0][0]
        );
        if (distance <= (geofence.radius || 0)) {
          incursions.push({ asset, geofence, timeToEntry: pos.timeSeconds, distance });
          break; // Only report first incursion per geofence per asset
        }
      }
    }
  }

  return incursions;
}

// Generate alerts from violations and predicted incursions
export function generateAlerts(assets: Asset[], existingThreats: Threat[], geofences: Geofence[] = []): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // Current violations
  const violations = detectGeofenceViolations(assets, geofences);
  for (const v of violations) {
    alerts.push({
      id: `violation-${v.asset.id}-${v.geofence.id}-${now}`,
      type: 'threat',
      severity: v.distance < 1000 ? 'critical' : 'warning',
      message: `${v.asset.name} inside ${v.geofence.name} — ${Math.round(v.distance / 1000)}km from center`,
      timestamp: now,
      acknowledged: false,
      relatedAssetId: v.asset.id,
      relatedGeofenceId: v.geofence.id,
    });
  }

  // Predicted incursions
  const incursions = predictGeofenceIncursions(assets, geofences);
  for (const i of incursions) {
    // Skip if already inside
    if (violations.some(v => v.asset.id === i.asset.id && v.geofence.id === i.geofence.id)) continue;

    alerts.push({
      id: `predicted-${i.asset.id}-${i.geofence.id}-${now}`,
      type: 'threat',
      severity: i.timeToEntry < 60 ? 'critical' : 'warning',
      message: `${i.asset.name} predicted to enter ${i.geofence.name} in ${Math.round(i.timeToEntry / 60)} min`,
      timestamp: now,
      acknowledged: false,
      relatedAssetId: i.asset.id,
      relatedGeofenceId: i.geofence.id,
    });
  }

  // Existing threats
  for (const threat of existingThreats) {
    alerts.push({
      id: `threat-${threat.id}-${now}`,
      type: 'threat',
      severity: threat.severity === 'critical' ? 'critical' : 'warning',
      message: `${threat.name} detected — severity ${threat.severity}`,
      timestamp: now,
      acknowledged: false,
      relatedThreatId: threat.id,
    });
  }

  return alerts;
}

// De-duplicate alerts by message content (keep latest)
export function deduplicateAlerts(alerts: Alert[]): Alert[] {
  const seen = new Map<string, Alert>();
  for (const alert of alerts) {
    seen.set(alert.message, alert);
  }
  return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
}
