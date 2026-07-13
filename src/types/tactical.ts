export interface MilStd2525D {
  sidc?: string; // 15-character Symbol Identification Code
  echelon?: 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'regiment' | 'brigade' | 'division' | 'corps' | 'army';
  status?: 'present' | 'anticipated' | 'planned';
  countryCode?: string; // 2-char ISO country code
  taskForce?: boolean;
  headquarters?: boolean;
  feintDummy?: boolean;
  symbolSet?: 'air' | 'ground' | 'sea' | 'subsurface' | 'space' | 'land' | 'cyber';
  entityType?: string; // Specific entity type code
}

export interface Asset {
  id: string;
  type: 'friendly' | 'hostile' | 'unknown' | 'neutral' | 'pending' | 'assumed_friend';
  category: 'ground' | 'air' | 'sea' | 'infrastructure';
  name: string;
  position: {
    lat: number;
    lng: number;
    altitude?: number;
  };
  heading: number;
  speed: number;
  status: 'active' | 'inactive' | 'damaged' | 'destroyed';
  lastUpdate: number;
  milStd2525D?: MilStd2525D;
  metadata?: {
    icao24?: string;
    callsign?: string;
    originCountry?: string;
    squawk?: string;
    verticalRate?: number;
    onGround?: boolean;
    source?: string;
    aircraftType?: string;
    registration?: string;
    operator?: string;
    imageUrl?: string;
    classification?: 'helicopter' | 'military' | 'cargo' | 'commercial' | 'general_aviation' | 'unknown';
    landingStatus?: 'landed' | 'landing' | 'departing' | 'airborne' | 'unknown';
    nearestAirport?: { icao: string; name: string; distanceM: number };
    route?: {
      origin: string | null;
      destination: string | null;
      routeString: string | null;
      airports: string[];
    };
    threatScore?: {
      total: number;
      level: 'low' | 'medium' | 'high' | 'critical';
      factors: Record<string, number>;
      primaryFactor: string;
    };
  };
}

export interface Threat {
  id: string;
  name: string;
  type: 'missile' | 'aircraft' | 'vehicle' | 'explosive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  position: {
    lat: number;
    lng: number;
  };
  targetId?: string;
  estimatedImpact: number;
  status: 'detected' | 'tracking' | 'intercepted' | 'impacted';
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'threat' | 'asset_update' | 'system' | 'communication';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  relatedAssetId?: string;
  relatedThreatId?: string;
  relatedGeofenceId?: string;
}

export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: number[][];
  radius?: number;
  alertOnEntry: boolean;
  alertOnExit: boolean;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  type: 'text' | 'alert' | 'command';
}
