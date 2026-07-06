import { Asset, Geofence } from '@/types/tactical';
import { haversineDistance, predictPath } from './threatIntel';

export interface ThreatScoreFactors {
  [key: string]: number;
  proximityScore: number;      // 0-100: closeness to nearest restricted zone
  lowSlowScore: number;        // 0-100: low/slow flight signature (UAS-like)
  approachScore: number;       // 0-100: heading toward a critical facility
  loiteringScore: number;      // 0-100: slow, turning flight near a facility
  maneuverScore: number;       // 0-100: rapid altitude or heading changes
  anonymityScore: number;      // 0-100: unknown identity / no callsign
}

export interface ThreatScore {
  total: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: ThreatScoreFactors;
  primaryFactor: string;
}

const MAX_SENSOR_RANGE_M = 50_000; // 50km horizon for scoring
const CRITICAL_DISTANCE_M = 2_000; // 2km to facility
const HIGH_DISTANCE_M = 10_000;    // 10km to facility

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return value >= min ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function proximityToGeofence(asset: Asset, geofences: Geofence[]): { distanceM: number; geofence: Geofence } | null {
  let nearest: { distanceM: number; geofence: Geofence } | null = null;
  for (const geofence of geofences) {
    const centerLat = geofence.coordinates[0][1];
    const centerLng = geofence.coordinates[0][0];
    const distance = haversineDistance(asset.position.lat, asset.position.lng, centerLat, centerLng);
    if (!nearest || distance < nearest.distanceM) {
      nearest = { distanceM: distance, geofence };
    }
  }
  return nearest;
}

function willEnterGeofence(asset: Asset, geofences: Geofence[], seconds: number = 300): { distanceM: number; geofence: Geofence; timeSeconds: number } | null {
  const path = predictPath(asset, seconds);
  for (const pos of path) {
    for (const geofence of geofences) {
      const centerLat = geofence.coordinates[0][1];
      const centerLng = geofence.coordinates[0][0];
      const distance = haversineDistance(pos.lat, pos.lng, centerLat, centerLng);
      if (distance <= (geofence.radius || 0)) {
        return { distanceM: distance, geofence, timeSeconds: pos.timeSeconds };
      }
    }
  }
  return null;
}

export function computeThreatScore(asset: Asset, geofences: Geofence[], history?: Array<{ lat: number; lng: number; altitude?: number; timestamp: number }>): ThreatScore {
  const factors: ThreatScoreFactors = {
    proximityScore: 0,
    lowSlowScore: 0,
    approachScore: 0,
    loiteringScore: 0,
    maneuverScore: 0,
    anonymityScore: 0,
  };

  const altitudeM = asset.position.altitude || 0;
  const speedKnots = asset.speed;
  const verticalRate = asset.metadata?.verticalRate || 0;
  const onGround = asset.metadata?.onGround || false;
  const classification = asset.metadata?.classification || 'unknown';
  const callsign = asset.metadata?.callsign;

  // 1. Proximity score
  const nearest = proximityToGeofence(asset, geofences);
  if (nearest) {
    if (nearest.distanceM <= CRITICAL_DISTANCE_M) {
      factors.proximityScore = 100;
    } else if (nearest.distanceM <= HIGH_DISTANCE_M) {
      factors.proximityScore = Math.round(60 + (1 - (nearest.distanceM - CRITICAL_DISTANCE_M) / (HIGH_DISTANCE_M - CRITICAL_DISTANCE_M)) * 40);
    } else {
      factors.proximityScore = Math.round(Math.max(0, 60 - (nearest.distanceM - HIGH_DISTANCE_M) / 1000));
    }
  }

  // 2. Low / slow score (UAS signature)
  if (!onGround) {
    const isLow = altitudeM < 1000;
    const isSlow = speedKnots < 60;
    const isVeryLow = altitudeM < 150;
    if (isVeryLow && isSlow) factors.lowSlowScore = 100;
    else if (isLow && isSlow) factors.lowSlowScore = 80;
    else if (isLow || isSlow) factors.lowSlowScore = 50;
  }

  // 3. Approach score (heading toward a facility within 5 min)
  const incursion = willEnterGeofence(asset, geofences, 300);
  if (incursion) {
    if (incursion.timeSeconds <= 60) factors.approachScore = 100;
    else if (incursion.timeSeconds <= 180) factors.approachScore = 80;
    else factors.approachScore = 60;
  }

  // 4. Loitering score (slow, turning, near facility)
  if (nearest && nearest.distanceM <= HIGH_DISTANCE_M && !onGround && speedKnots < 80) {
    const hist = history || [];
    if (hist.length >= 3) {
      const recent = hist.slice(-5);
      const distanceTravelledM = recent.reduce((sum, p, i) => {
        if (i === 0) return 0;
        return sum + haversineDistance(p.lat, p.lng, recent[i - 1].lat, recent[i - 1].lng);
      }, 0);
      // Low distance travelled over many points = loitering
      if (distanceTravelledM < 500 && recent.length >= 5) {
        factors.loiteringScore = 90;
      } else if (distanceTravelledM < 1500) {
        factors.loiteringScore = 60;
      }
    } else if (speedKnots < 40 && nearest.distanceM <= CRITICAL_DISTANCE_M) {
      factors.loiteringScore = 50;
    }
  }

  // 5. Maneuver score (rapid changes)
  if (!onGround) {
    const verticalRateFpm = verticalRate * 196.85; // m/s to ft/min
    if (Math.abs(verticalRateFpm) > 3000) factors.maneuverScore = 80;
    else if (Math.abs(verticalRateFpm) > 1500) factors.maneuverScore = 50;
  }

  // 6. Anonymity score
  if (!callsign || callsign.trim() === '') factors.anonymityScore += 60;
  if (classification === 'unknown') factors.anonymityScore += 30;
  if (classification === 'military') factors.anonymityScore += 10; // known but worth watching
  factors.anonymityScore = Math.min(100, factors.anonymityScore);

  // Weighted total
  const weights = {
    proximityScore: 0.25,
    lowSlowScore: 0.25,
    approachScore: 0.20,
    loiteringScore: 0.10,
    maneuverScore: 0.10,
    anonymityScore: 0.10,
  };

  const total = Math.round(
    factors.proximityScore * weights.proximityScore +
    factors.lowSlowScore * weights.lowSlowScore +
    factors.approachScore * weights.approachScore +
    factors.loiteringScore * weights.loiteringScore +
    factors.maneuverScore * weights.maneuverScore +
    factors.anonymityScore * weights.anonymityScore
  );

  let level: ThreatScore['level'] = 'low';
  if (total >= 80) level = 'critical';
  else if (total >= 60) level = 'high';
  else if (total >= 35) level = 'medium';

  // Find primary factor
  const factorEntries = Object.entries(factors) as [string, number][];
  const primary = factorEntries.reduce((max, [key, value]) => value > max.value ? { key, value } : max, { key: 'proximityScore', value: 0 });
  const primaryFactor = primary.key.replace('Score', '').replace(/([A-Z])/g, ' $1').trim();

  return { total, level, factors, primaryFactor };
}
