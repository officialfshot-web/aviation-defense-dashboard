import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface RouteInfo {
  callsign: string;
  route: string | null;
  origin: string | null;
  destination: string | null;
  airports: string[];
}

const cache = new Map<string, { data: RouteInfo; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseRouteResponse(callsign: string, payload: unknown): RouteInfo {
  const raw = payload as any;

  // ADSB.lol commonly returns: { "_airports": [...], "airport_count": 2, "callsign": "...", "route": "KORD-KLAX", "route_airports": ["KORD", "KLAX"] }
  const routeString = raw?.route && typeof raw.route === 'string' ? raw.route : null;
  const airports: string[] = Array.isArray(raw?.route_airports)
    ? raw.route_airports.filter((a: unknown) => typeof a === 'string')
    : Array.isArray(raw?._airports)
      ? raw._airports.filter((a: unknown) => typeof a === 'string')
      : routeString
        ? routeString.split('-').filter(Boolean)
        : [];

  const origin = airports[0] || null;
  const destination = airports[1] || null;

  return {
    callsign,
    route: routeString || (airports.length >= 2 ? airports.join('-') : null),
    origin,
    destination,
    airports,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callsign = searchParams.get('callsign')?.trim().toUpperCase();

  if (!callsign) {
    return NextResponse.json({ error: 'callsign required' }, { status: 400 });
  }

  const cached = cache.get(callsign);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(`https://api.adsb.lol/api/0/route/${encodeURIComponent(callsign)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      // Cache empty result so repeated failures don't hammer the API
      const empty: RouteInfo = { callsign, route: null, origin: null, destination: null, airports: [] };
      cache.set(callsign, { data: empty, timestamp: Date.now() });
      return NextResponse.json(empty);
    }

    const data = await res.json();
    const routeInfo = parseRouteResponse(callsign, data);
    cache.set(callsign, { data: routeInfo, timestamp: Date.now() });
    return NextResponse.json(routeInfo);
  } catch (error) {
    console.error('Route API error:', error);
    const empty: RouteInfo = { callsign, route: null, origin: null, destination: null, airports: [] };
    return NextResponse.json(empty);
  }
}
