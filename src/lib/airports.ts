import { haversineDistance } from './threatIntel';

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lng: number;
  type: 'military' | 'civil' | 'regional';
  frequencies?: { name: string; freq: string }[];
}

// Airports near the preset operating bases. Frequencies are public FAA / DoD / international data.
export const NEARBY_AIRPORTS: Airport[] = [
  // San Antonio, TX
  {
    icao: 'KSAT',
    name: 'San Antonio Intl',
    lat: 29.5337,
    lng: -98.4698,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '119.100' },
      { name: 'APP', freq: '124.750' },
      { name: 'GND', freq: '121.900' },
      { name: 'ATIS', freq: '118.000' },
    ],
  },
  {
    icao: 'KSKF',
    name: 'Kelly Field / Lackland AFB',
    lat: 29.3842,
    lng: -98.5811,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '133.050' },
      { name: 'ATIS', freq: '124.750' },
    ],
  },
  {
    icao: 'KRND',
    name: 'Randolph AFB',
    lat: 29.5296,
    lng: -98.2789,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '120.300' },
      { name: 'ATIS', freq: '124.050' },
    ],
  },
  {
    icao: 'KSSF',
    name: 'Stinson Municipal',
    lat: 29.2371,
    lng: -98.4709,
    type: 'civil',
    frequencies: [
      { name: 'CTAF', freq: '118.300' },
    ],
  },
  {
    icao: 'KBAZ',
    name: 'New Braunfels Regional',
    lat: 29.7045,
    lng: -98.0422,
    type: 'regional',
    frequencies: [
      { name: 'CTAF', freq: '122.800' },
    ],
  },
  {
    icao: 'KAUS',
    name: 'Austin-Bergstrom Intl',
    lat: 30.1945,
    lng: -97.6699,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '124.350' },
      { name: 'APP', freq: '119.000' },
      { name: 'GND', freq: '121.750' },
      { name: 'ATIS', freq: '126.575' },
    ],
  },
  // Fresno, CA / 144 FW
  {
    icao: 'KFAT',
    name: 'Fresno Yosemite Intl',
    lat: 36.7762,
    lng: -119.7181,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '118.500' },
      { name: 'APP', freq: '124.350' },
      { name: 'GND', freq: '121.700' },
      { name: 'ATIS', freq: '125.900' },
    ],
  },
  {
    icao: 'KNLC',
    name: 'Lemoore NAS / Reeves Field',
    lat: 36.3330,
    lng: -119.9521,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '125.850' },
      { name: 'ATIS', freq: '118.225' },
    ],
  },
  // Norfolk, VA / NAS
  {
    icao: 'KORF',
    name: 'Norfolk Intl',
    lat: 36.8946,
    lng: -76.2012,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '120.200' },
      { name: 'APP', freq: '124.650' },
      { name: 'GND', freq: '121.700' },
      { name: 'ATIS', freq: '125.950' },
    ],
  },
  {
    icao: 'KNGU',
    name: 'Chambers Field / Norfolk NAS',
    lat: 36.9375,
    lng: -76.2893,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '126.750' },
      { name: 'ATIS', freq: '119.925' },
    ],
  },
  {
    icao: 'KNTU',
    name: 'Oceana NAS',
    lat: 36.8207,
    lng: -76.0335,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '119.200' },
      { name: 'ATIS', freq: '121.200' },
    ],
  },
  // Ramstein, DE
  {
    icao: 'ETAR',
    name: 'Ramstein AB',
    lat: 49.4369,
    lng: 7.6005,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '129.100' },
      { name: 'APP', freq: '125.400' },
      { name: 'GND', freq: '122.100' },
      { name: 'ATIS', freq: '118.625' },
    ],
  },
  {
    icao: 'EDRZ',
    name: 'Zweibrucken AB',
    lat: 49.2095,
    lng: 7.4006,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '122.100' },
    ],
  },
  // Yokota, JP
  {
    icao: 'RJTY',
    name: 'Yokota AB',
    lat: 35.7484,
    lng: 139.3486,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '126.200' },
      { name: 'GND', freq: '121.700' },
      { name: 'ATIS', freq: '128.200' },
    ],
  },
  {
    icao: 'RJAA',
    name: 'Narita Intl',
    lat: 35.7647,
    lng: 140.3864,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '118.200' },
      { name: 'GND', freq: '121.700' },
      { name: 'ATIS', freq: '128.200' },
    ],
  },
  // Miami, FL / Homestead
  {
    icao: 'KMIA',
    name: 'Miami Intl',
    lat: 25.7959,
    lng: -80.2870,
    type: 'civil',
    frequencies: [
      { name: 'TWR', freq: '118.300' },
      { name: 'APP', freq: '126.300' },
      { name: 'GND', freq: '121.700' },
      { name: 'ATIS', freq: '126.600' },
    ],
  },
  {
    icao: 'KHST',
    name: 'Homestead ARB',
    lat: 25.4885,
    lng: -80.3836,
    type: 'military',
    frequencies: [
      { name: 'TWR', freq: '120.700' },
      { name: 'ATIS', freq: '119.250' },
    ],
  },
];

export function findNearestAirport(lat: number, lng: number): { airport: Airport; distanceM: number } | null {
  let nearest: { airport: Airport; distanceM: number } | null = null;
  for (const airport of NEARBY_AIRPORTS) {
    const d = haversineDistance(lat, lng, airport.lat, airport.lng);
    if (!nearest || d < nearest.distanceM) {
      nearest = { airport, distanceM: d };
    }
  }
  return nearest;
}

export function getLiveAtcStreamUrl(icao: string): string {
  return `https://www.liveatc.net/play/${icao.toLowerCase()}.pls`;
}

export function getLandingStatus(
  onGround: boolean,
  altitude: number | undefined,
  verticalRate: number | undefined,
  nearestDistanceM: number
): 'landed' | 'landing' | 'departing' | 'airborne' | 'unknown' {
  if (onGround) return 'landed';
  if (altitude !== undefined && altitude < 500 && verticalRate !== undefined && verticalRate < -1) {
    if (nearestDistanceM < 5000) return 'landing';
  }
  if (altitude !== undefined && altitude < 500 && verticalRate !== undefined && verticalRate > 1) {
    if (nearestDistanceM < 5000) return 'departing';
  }
  if (altitude !== undefined && altitude < 100 && nearestDistanceM < 3000) return 'landing';
  return 'airborne';
}
