import { Asset, Threat } from '@/types/tactical';
import { classifyAircraftByMetadata } from './classifier';
import { findNearestAirport, getLandingStatus } from './airports';

// ADSB.lol aircraft format
export interface AdsbAircraft {
  hex: string;               // ICAO 24-bit address
  flight: string | null;     // callsign (with trailing spaces)
  r: string | null;          // registration
  t: string | null;          // aircraft type ICAO code
  alt_baro: number | null;   // barometric altitude (ft)
  alt_geom: number | null;   // geometric altitude (ft)
  gs: number | null;         // ground speed (knots)
  track: number | null;      // true track (degrees)
  baro_rate: number | null;  // barometric vertical rate (ft/min)
  squawk: string | null;
  category: string | null;   // ADS-B emitter category
  lat: number | null;
  lon: number | null;
  seen_pos: number | null;   // seconds since last position update
  dst: number | null;        // distance from query point (km)
}

export async function fetchRealAircraft(
  base: { lat: number; lng: number; radiusKm: number }
): Promise<AdsbAircraft[]> {
  try {
    const params = new URLSearchParams({
      lat: base.lat.toString(),
      lon: base.lng.toString(),
      dist: base.radiusKm.toString(),
    });

    const response = await fetch(`/api/aircraft?${params.toString()}`);
    const data = await response.json();

    if (!data.ac || !Array.isArray(data.ac)) {
      return [];
    }

    return data.ac as AdsbAircraft[];
  } catch (error) {
    console.error('Failed to fetch aircraft:', error);
    return [];
  }
}

// Convert feet to meters
function ftToM(ft: number | null): number {
  return (ft || 0) * 0.3048;
}

export function aircraftToAssets(aircraft: AdsbAircraft[]): Asset[] {
  return aircraft
    .filter(a => a.lat !== null && a.lon !== null)
    .map(a => {
      const altitudeM = ftToM(a.alt_baro ?? a.alt_geom);
      const speedKnots = a.gs || 0;
      const verticalRateFpm = a.baro_rate || 0;
      const onGround = altitudeM < 50 && speedKnots < 30;
      const nearest = findNearestAirport(a.lat!, a.lon!);
      const landingStatus = nearest
        ? getLandingStatus(onGround, altitudeM, verticalRateFpm / 196.85, nearest.distanceM)
        : 'unknown';
      return {
        id: a.hex.toUpperCase(),
        name: a.flight ? a.flight.trim() : `ICAO-${a.hex.toUpperCase()}`,
        type: classifyAircraftByCountry(a),
        category: 'air' as const,
        position: {
          lat: a.lat!,
          lng: a.lon!,
          altitude: altitudeM,
        },
        heading: a.track || 0,
        speed: speedKnots,
        status: onGround ? 'inactive' : 'active',
        lastUpdate: Date.now(),
        metadata: {
          icao24: a.hex.toUpperCase(),
          callsign: a.flight ? a.flight.trim() : undefined,
          originCountry: guessCountryFromRegistration(a.r),
          squawk: a.squawk || undefined,
          verticalRate: verticalRateFpm / 196.85, // ft/min to m/s
          onGround,
          source: 'ADSB.lol',
          aircraftType: a.t || undefined,
          registration: a.r || undefined,
          classification: classifyAircraftByMetadata(a.t || undefined, undefined, a.flight || undefined),
          landingStatus,
          nearestAirport: nearest
            ? { icao: nearest.airport.icao, name: nearest.airport.name, distanceM: Math.round(nearest.distanceM) }
            : undefined,
        },
      };
    });
}

export function aircraftToThreats(aircraft: AdsbAircraft[]): Threat[] {
  return aircraft
    .filter(a => a.lat !== null && a.lon !== null)
    .filter(a => {
      const altitudeM = ftToM(a.alt_baro ?? a.alt_geom);
      const speedKnots = a.gs || 0;
      const onGround = altitudeM < 50 && speedKnots < 30;
      const isUnknown = !a.flight || a.flight.trim() === '';
      const isLow = altitudeM < 1000 && !onGround;
      const isSlow = speedKnots < 60;
      const isVeryLow = altitudeM < 150;

      return (isLow && isSlow) || (isUnknown && isLow) || isVeryLow;
    })
    .map(a => {
      const altitudeM = ftToM(a.alt_baro ?? a.alt_geom);
      const speedKnots = a.gs || 0;

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let estimatedImpact = 50;
      let type: 'aircraft' | 'vehicle' | 'missile' | 'explosive' = 'aircraft';
      let name = a.flight ? a.flight.trim() : `UNKNOWN-${a.hex.toUpperCase()}`;

      if (altitudeM < 150 && speedKnots < 60) {
        severity = 'critical';
        estimatedImpact = 95;
        type = 'aircraft';
        name = `POTENTIAL-UAS-${name}`;
      } else if (altitudeM < 500 || speedKnots < 60) {
        severity = 'high';
        estimatedImpact = 80;
        name = `LOW-SLOW-${name}`;
      } else {
        severity = 'medium';
        estimatedImpact = 60;
        name = `UNKNOWN-${name}`;
      }

      return {
        id: `threat-${a.hex}`,
        name,
        type,
        position: {
          lat: a.lat!,
          lng: a.lon!,
        },
        severity,
        status: 'detected' as const,
        estimatedImpact,
        metadata: {
          altitude: altitudeM,
          speed: speedKnots,
          country: guessCountryFromRegistration(a.r),
          classification: 'UAS-suspect',
        },
      };
    });
}

function classifyAircraftByCountry(a: AdsbAircraft): 'friendly' | 'hostile' | 'neutral' {
  // Best-effort origin based on registration prefix; real systems use IFF/mode codes
  const country = guessCountryFromRegistration(a.r);
  const friendlyCountries = ['United States', 'Canada', 'United Kingdom', 'Australia'];
  if (friendlyCountries.includes(country)) return 'friendly';
  if (!a.flight || a.flight.trim() === '') return 'neutral';
  return 'neutral';
}

function guessCountryFromRegistration(reg: string | null): string {
  if (!reg) return 'Unknown';
  const prefix = reg.toUpperCase().slice(0, 2);
  switch (prefix) {
    case 'N-': return 'United States';
    case 'C-': return 'Canada';
    case 'G-': return 'United Kingdom';
    case 'V': return 'Australia';
    case 'D-': return 'Germany';
    case 'F-': return 'France';
    case 'JA': return 'Japan';
    case 'HL': return 'South Korea';
    case 'B-': return 'China';
    default: return 'Unknown';
  }
}
