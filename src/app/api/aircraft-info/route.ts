import { NextRequest, NextResponse } from 'next/server';
import { classifyAircraftByMetadata } from '@/lib/classifier';

const USER_AGENT = 'TacticalDashboard/1.0 (research; contact@example.com)';

async function fetchAdsbDb(icao24: string) {
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/aircraft/${icao24.toLowerCase()}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.aircraft || data?.response?.aircraft || data || null;
  } catch {
    return null;
  }
}

async function fetchWikimediaImage(query: string) {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '5',
      gsrsearch: query,
      prop: 'imageinfo',
      iiprop: 'url|thumburl|size|mime',
      iiurlwidth: '400',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${searchParams.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0] as any;
    const imageInfo = first?.imageinfo?.[0];
    return imageInfo?.thumburl || imageInfo?.url || null;
  } catch {
    return null;
  }
}

async function fetchWikipediaPageImage(title: string) {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      prop: 'pageimages',
      titles: title,
      pithumbsize: '400',
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0] as any;
    return first?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function findAircraftImage(type: string | null, operator: string | null) {
  // Try specific aircraft type first
  if (type) {
    const url = await fetchWikimediaImage(`${type} aircraft`);
    if (url) return url;
  }
  // Try operator + aircraft type
  if (type && operator) {
    const url = await fetchWikimediaImage(`${operator} ${type} aircraft`);
    if (url) return url;
  }
  // Try generic aircraft type from Wikipedia
  if (type) {
    const wikiTitle = type.replace(/\s+/g, '_');
    const url = await fetchWikipediaPageImage(wikiTitle);
    if (url) return url;
  }
  // Fallback to generic aircraft
  return fetchWikimediaImage('aircraft in flight');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const icao24 = searchParams.get('icao24');
  if (!icao24) {
    return NextResponse.json({ error: 'icao24 required' }, { status: 400 });
  }

  const adsb = await fetchAdsbDb(icao24);
  const type = adsb?.type || adsb?.icao_type || adsb?.aircraft_type || null;
  const registration = adsb?.registration || adsb?.reg || null;
  const operator = adsb?.operator || adsb?.airline || adsb?.owner || null;
  const callsign = adsb?.callsign || null;

  const classification = classifyAircraftByMetadata(type, operator, callsign);
  const imageUrl = await findAircraftImage(type, operator);

  const response = NextResponse.json({
    icao24: icao24.toUpperCase(),
    type,
    registration,
    operator,
    classification,
    imageUrl,
    source: 'ADSBDB + Wikimedia Commons / Wikipedia',
  });
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return response;
}
