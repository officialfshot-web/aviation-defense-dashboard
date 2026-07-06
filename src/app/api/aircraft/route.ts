import { NextResponse } from 'next/server';

// ADSB.lol API — free, unauthenticated, global ADS-B data.
// Supports lat/lon/distance queries, which maps cleanly to our base/radius model.
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const lat = parseFloat(searchParams.get('lat') || '29.4241');
  const lon = parseFloat(searchParams.get('lon') || '-98.4936');
  const dist = Math.min(500, Math.max(10, parseInt(searchParams.get('dist') || '75', 10)));
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)},${dist}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const response = await fetch(
      `https://api.adsb.lol/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) {
      throw new Error(`ADSB.lol API error: ${response.status}`);
    }

    const data = await response.json();
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Aircraft API error:', error);
    if (cached) {
      return NextResponse.json(cached.data);
    }
    return NextResponse.json({ ac: [] }, { status: 200 });
  }
}
