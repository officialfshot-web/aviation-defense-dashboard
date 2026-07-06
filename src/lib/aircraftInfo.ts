import { AircraftClassification } from './classifier';

export interface AircraftInfo {
  icao24: string;
  type: string | null;
  registration: string | null;
  operator: string | null;
  classification: AircraftClassification | null;
  imageUrl: string | null;
  source: string;
}

function cacheKey(icao24: string) {
  return `aircraft-info-${icao24.toUpperCase()}`;
}

function getCached(icao24: string): AircraftInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(icao24));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: AircraftInfo; ts: number };
    if (Date.now() - parsed.ts > 7 * 24 * 60 * 60 * 1000) return null; // 7 days
    return parsed.data;
  } catch {
    return null;
  }
}

function setCached(icao24: string, data: AircraftInfo) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cacheKey(icao24), JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export async function fetchAircraftInfo(icao24: string): Promise<AircraftInfo | null> {
  const cached = getCached(icao24);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/aircraft-info?icao24=${encodeURIComponent(icao24)}`);
    if (!res.ok) return null;
    const data = await res.json() as AircraftInfo;
    setCached(icao24, data);
    return data;
  } catch (error) {
    console.error('Failed to fetch aircraft info:', error);
    return null;
  }
}
