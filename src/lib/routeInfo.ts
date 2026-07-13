export interface RouteInfo {
  callsign: string;
  route: string | null;
  origin: string | null;
  destination: string | null;
  airports: string[];
}

function cacheKey(callsign: string) {
  return `route-info-${callsign.toUpperCase()}`;
}

function getCached(callsign: string): RouteInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(callsign));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: RouteInfo; ts: number };
    if (Date.now() - parsed.ts > 5 * 60 * 1000) return null; // 5 minutes
    return parsed.data;
  } catch {
    return null;
  }
}

function setCached(callsign: string, data: RouteInfo) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cacheKey(callsign), JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export async function fetchRouteByCallsign(callsign: string): Promise<RouteInfo | null> {
  if (!callsign || !callsign.trim()) return null;
  const normalized = callsign.trim();
  const cached = getCached(normalized);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/route?callsign=${encodeURIComponent(normalized)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as RouteInfo;
    if (!data || typeof data.callsign !== 'string') return null;
    setCached(normalized, data);
    return data;
  } catch (error) {
    console.error('Failed to fetch route:', error);
    return null;
  }
}
