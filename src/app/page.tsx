'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Asset, Threat, Alert, Geofence } from '@/types/tactical';
import { Basemap } from '@/components/TacticalMap';

const TacticalMap = dynamic(() => import('@/components/TacticalMap'), { ssr: false }) as React.ComponentType<{
  assets: Asset[];
  threats: Threat[];
  geofences: any[];
  predictedPaths: any[];
  pois?: { id: string; lat: number; lng: number; label: string }[];
  focusPosition?: { lat: number; lng: number } | null;
  baseLocation?: { lat: number; lng: number; name: string; radiusKm: number };
  basemap?: Basemap;
  aircraftImageMap?: Record<string, string | null>;
  classificationMap?: Record<string, string | null>;
  trackHistory?: Record<string, Array<{ lat: number; lng: number; altitude?: number; timestamp: number }>>;
  showTracks?: boolean;
  showPredictedPaths?: boolean;
  followAssetId?: string | null;
  onAssetClick?: (asset: Asset) => void;
  onThreatClick?: (threat: Threat) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMapRightClick?: (lat: number, lng: number) => void;
  onPoiClick?: (poi: { id: string; lat: number; lng: number; label: string }) => void;
}>;
import { fetchRealAircraft, aircraftToAssets, aircraftToThreats } from '@/lib/realtime';
import { fetchAircraftInfo, AircraftInfo } from '@/lib/aircraftInfo';
import { fetchRouteByCallsign, RouteInfo } from '@/lib/routeInfo';
import { getAircraftTypeName } from '@/lib/aircraftTypes';
import { SAN_ANTONIO_GEOFENCES, predictPath, generateAlerts, PredictedPath } from '@/lib/threatIntel';
import { NEARBY_AIRPORTS } from '@/lib/airports';
import { computeThreatScore } from '@/lib/threatScoring';
import { fetchAlerts, syncAlerts, acknowledgeAlertBackend, clearAcknowledgedAlertsBackend, exportIncidentReport, downloadIncidentReport } from '@/lib/alertManager';
import { generateSidcFromAsset } from '@/lib/milstd2525';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [predictedPaths, setPredictedPaths] = useState<PredictedPath[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('—');
  const [selectedItem, setSelectedItem] = useState<Asset | Threat | null>(null);
  const [selectedItemInfo, setSelectedItemInfo] = useState<AircraftInfo | null>(null);
  const [selectedItemInfoLoading, setSelectedItemInfoLoading] = useState(false);
  const [selectedItemImageError, setSelectedItemImageError] = useState(false);
  const [selectedItemRoute, setSelectedItemRoute] = useState<RouteInfo | null>(null);
  const [selectedItemRouteLoading, setSelectedItemRouteLoading] = useState(false);
  const [focusPosition, setFocusPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [followAssetId, setFollowAssetId] = useState<string | null>(null);
  const [trackHistory, setTrackHistory] = useState<Record<string, Array<{ lat: number; lng: number; altitude?: number; timestamp: number }>>>({});
  const [customGeofences, setCustomGeofences] = useState<Geofence[]>([]);
  const [addingGeofence, setAddingGeofence] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>('dark');
  const [showTracks, setShowTracks] = useState(true);
  const [showPredictedPaths, setShowPredictedPaths] = useState(true);
  // Configurable home base / sector
  const [baseLocation, setBaseLocation] = useState<{ lat: number; lng: number; name: string; radiusKm: number }>({
    lat: 29.4241,
    lng: -98.4936,
    name: 'SAN ANTONIO, TX — JBSA SECTOR',
    radiusKm: 75,
  });
  const [showBaseConfig, setShowBaseConfig] = useState(false);
  const [showMobileAlerts, setShowMobileAlerts] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [baseConfigForm, setBaseConfigForm] = useState<typeof baseLocation>(baseLocation);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(false);
  const [aircraftImageMap, setAircraftImageMap] = useState<Record<string, string | null>>({});
  const [classificationMap, setClassificationMap] = useState<Record<string, string | null>>({});
  const [pois, setPois] = useState<{ id: string; lat: number; lng: number; label: string }[]>([]);
  const [lastUpdateMs, setLastUpdateMs] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const allGeofencesRef = useRef<Geofence[]>([]);
  const trackHistoryRef = useRef<Record<string, Array<{ lat: number; lng: number; altitude?: number; timestamp: number }>>>({});

  // Live clock for data age display
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync config form with active base when the panel opens
  useEffect(() => {
    if (showBaseConfig) {
      setBaseConfigForm(baseLocation);
      setGeoError(null);
      setGeoLoading(false);
    }
  }, [showBaseConfig, baseLocation]);

  // Fetch aircraft photo / metadata and route when selected asset changes
  useEffect(() => {
    setSelectedItemImageError(false);
    setSelectedItemRoute(null);
    const icao24 = selectedItem && 'category' in selectedItem ? selectedItem.metadata?.icao24 : undefined;
    const callsign = selectedItem && 'category' in selectedItem ? selectedItem.metadata?.callsign : undefined;
    if (!icao24) {
      setSelectedItemInfo(null);
      setSelectedItemRoute(null);
      return;
    }
    const load = async () => {
      setSelectedItemInfoLoading(true);
      const info = await fetchAircraftInfo(icao24);
      setSelectedItemInfo(info);
      setSelectedItemInfoLoading(false);
    };
    const loadRoute = async () => {
      if (!callsign) {
        setSelectedItemRoute(null);
        return;
      }
      setSelectedItemRouteLoading(true);
      const route = await fetchRouteByCallsign(callsign);
      setSelectedItemRoute(route);
      setSelectedItemRouteLoading(false);
    };
    load();
    loadRoute();
  }, [selectedItem]);

  // Fetch aircraft images and classification for visible assets on the map (cached per ICAO24)
  useEffect(() => {
    const fetchImages = async () => {
      const newImageMap: Record<string, string | null> = { ...aircraftImageMap };
      const newClassMap: Record<string, string | null> = { ...classificationMap };
      const toFetch = assets
        .map(a => a.metadata?.icao24 || a.id)
        .filter((icao24, i, arr) => icao24 && !newImageMap.hasOwnProperty(icao24) && arr.indexOf(icao24) === i)
        .slice(0, 15); // limit per update to avoid API spam
      if (toFetch.length === 0) return;
      for (const icao24 of toFetch) {
        const info = await fetchAircraftInfo(icao24);
        newImageMap[icao24] = info?.imageUrl || null;
        newClassMap[icao24] = info?.classification || null;
      }
      setAircraftImageMap(newImageMap);
      setClassificationMap(newClassMap);
    };
    fetchImages();
  }, [assets]);

  // Maintain track history for each aircraft
  useEffect(() => {
    setTrackHistory(prev => {
      const updated: Record<string, Array<{ lat: number; lng: number; altitude?: number; timestamp: number }>> = {};
      const now = Date.now();
      assets.forEach(asset => {
        const icao24 = asset.metadata?.icao24 || asset.id;
        const prevPoints = prev[icao24] || [];
        updated[icao24] = [
          ...prevPoints,
          { lat: asset.position.lat, lng: asset.position.lng, altitude: asset.position.altitude, timestamp: now },
        ].slice(-20); // keep last 20 positions
      });
      return updated;
    });
  }, [assets]);

  // Generate restricted airspace rings around the selected base
  function generateBaseGeofences(base: typeof baseLocation): Geofence[] {
    const innerRadius = Math.min(5000, base.radiusKm * 1000 * 0.15); // 15% of radius, max 5km
    const outerRadius = Math.min(15000, base.radiusKm * 1000 * 0.5); // 50% of radius, max 15km
    return [
      {
        id: `base-inner-${base.lat.toFixed(4)}-${base.lng.toFixed(4)}`,
        name: 'BASE PERIMETER',
        type: 'circle',
        coordinates: [[base.lng, base.lat]],
        radius: innerRadius,
        alertOnEntry: true,
        alertOnExit: false,
      },
      {
        id: `base-outer-${base.lat.toFixed(4)}-${base.lng.toFixed(4)}`,
        name: 'RESTRICTED AIRSPACE',
        type: 'circle',
        coordinates: [[base.lng, base.lat]],
        radius: outerRadius,
        alertOnEntry: true,
        alertOnExit: false,
      },
    ];
  }

  // Load alert history and initial aircraft data
  useEffect(() => {
    const loadAlerts = async () => {
      const history = await fetchAlerts(undefined, 100);
      setAlerts(history);
    };
    loadAlerts();

    const loadData = async () => {
      setIsLoadingAircraft(true);
      const aircraft = await fetchRealAircraft(baseLocation);
      setIsLoadingAircraft(false);
      const newAssets = aircraftToAssets(aircraft).map(asset => ({
        ...asset,
        metadata: {
          ...asset.metadata,
          threatScore: computeThreatScore(asset, allGeofencesRef.current, trackHistoryRef.current[asset.metadata?.icao24 || asset.id]),
        },
      }));
      setAssets(newAssets);
      setThreats(aircraftToThreats(aircraft));
      const now = Date.now();
      setLastUpdateMs(now);
      setLastUpdate(new Date(now).toLocaleTimeString());
    };

    loadData();
  }, []);

  // Clear stale aircraft and alerts when base changes so the user does not see
  // tracks from the previous sector while the new feed loads.
  useEffect(() => {
    setAssets([]);
    setThreats([]);
    setTrackHistory({});
    setAlerts([]);
  }, [baseLocation]);

  // Real-time polling loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      setIsLoadingAircraft(true);
      const aircraft = await fetchRealAircraft(baseLocation);
      setIsLoadingAircraft(false);
      const newAssets = aircraftToAssets(aircraft).map(asset => ({
        ...asset,
        metadata: {
          ...asset.metadata,
          threatScore: computeThreatScore(asset, allGeofencesRef.current, trackHistoryRef.current[asset.metadata?.icao24 || asset.id]),
        },
      }));
      const newThreats = aircraftToThreats(aircraft);
      setAssets(newAssets);
      setThreats(newThreats);
      const now = Date.now();
      setLastUpdateMs(now);
      setLastUpdate(new Date(now).toLocaleTimeString());
    }, 10000); // ADSB.lol polling interval

    return () => clearInterval(interval);
  }, [isLive, baseLocation]);

  // Combine default, base, and custom geofences
  const allGeofences = useMemo(() => {
    const baseGeofences = generateBaseGeofences(baseLocation);
    return baseLocation.name.includes('SAN ANTONIO')
      ? [...SAN_ANTONIO_GEOFENCES, ...baseGeofences, ...customGeofences]
      : [...baseGeofences, ...customGeofences];
  }, [baseLocation, customGeofences]);
  allGeofencesRef.current = allGeofences;
  trackHistoryRef.current = trackHistory;

  // Compute predicted paths and alerts when assets/threats change
  useEffect(() => {
    const paths = assets.map(asset => ({
      assetId: asset.name,
      positions: predictPath(asset, 300, 30),
    }));
    setPredictedPaths(paths);

    const newAlerts = generateAlerts(assets, threats, allGeofences);
    syncAlerts(newAlerts).then(synced => {
      setAlerts(prev => {
        // Preserve frontend state: acknowledged status from prev
        const prevMap = new Map(prev.map(a => [`${a.message}-${a.severity}`, a]));
        const merged = synced.map(a => {
          const existing = prevMap.get(`${a.message}-${a.severity}`);
          return existing?.acknowledged ? { ...existing, id: a.id, timestamp: a.timestamp } : a;
        });
        return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      });
    });
  }, [assets, threats, allGeofences]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsLive(prev => !prev);
      }
      if (e.code === 'KeyA') {
        const latest = alerts.find(a => !a.acknowledged);
        if (latest) {
          acknowledgeAlertBackend(latest.id, 'operator').then(() => fetchAlerts(undefined, 100).then(setAlerts));
        }
      }
      if (e.code === 'Escape') {
        setSelectedItem(null);
        setFocusPosition(null);
        setAddingGeofence(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [alerts]);

  return (
    <div className="relative w-full h-screen bg-[var(--background)] flex flex-col font-mono overflow-hidden">
      {/* Top Header Bar */}
      <div className="tactical-panel px-2 py-2 md:px-4 flex flex-col md:flex-row md:items-center justify-between text-[var(--foreground)] z-20 shrink-0 gap-2 md:gap-0">
        <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4">
          <div className="font-bold text-sm md:text-lg tracking-widest truncate">COUNTER-UAS / BASE SECURITY</div>
          <div className="hidden md:block text-[10px] text-[var(--text-dim)] border-l border-[var(--border-color)] pl-4 truncate max-w-[200px]">
            {baseLocation.name}
          </div>
          <button
            onClick={() => setShowBaseConfig(true)}
            className="text-[10px] border border-[var(--border-color)] px-2 py-1 md:py-0.5 tactical-button min-h-[32px] md:min-h-0"
          >
            SET BASE
          </button>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-dim)]">FEED:</span>
            <span className={isLive ? 'text-[var(--safe-green)]' : 'text-[var(--alert-yellow)]'}>
              {isLive ? '● LIVE' : '○ PAUSED'}
            </span>
            {isLoadingAircraft && (
              <span className="text-[10px] text-[var(--alert-yellow)] animate-pulse">LOADING AIRCRAFT...</span>
            )}
          </div>
          <div className="hidden md:block text-[var(--text-dim)]">UPDATED: {lastUpdate}</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-dim)]">DATA AGE:</span>
            <span className={`text-[10px] ${
              !lastUpdateMs ? 'text-[var(--text-dim)]' :
              now - lastUpdateMs > 60000 ? 'text-[var(--alert-red)]' :
              now - lastUpdateMs > 30000 ? 'text-[var(--alert-yellow)]' :
              'text-[var(--safe-green)]'
            }`}>
              {!lastUpdateMs ? '—' : `${Math.floor((now - lastUpdateMs) / 1000)}s`}
            </span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 min-h-0">
        <div className="scan-line" />
        <TacticalMap
          assets={assets}
          threats={threats}
          geofences={allGeofences}
          predictedPaths={predictedPaths}
          pois={pois}
          focusPosition={focusPosition}
          baseLocation={baseLocation}
          basemap={basemap}
          aircraftImageMap={aircraftImageMap}
          classificationMap={classificationMap}
          trackHistory={trackHistory}
          showTracks={showTracks}
          showPredictedPaths={showPredictedPaths}
          followAssetId={followAssetId}
          onAssetClick={(asset) => {
            setSelectedItem(asset);
            setFocusPosition({ lat: asset.position.lat, lng: asset.position.lng });
          }}
          onThreatClick={(threat) => {
            setSelectedItem(threat);
            setFocusPosition({ lat: threat.position.lat, lng: threat.position.lng });
          }}
          onMapClick={(lat, lng) => {
            if (!addingGeofence) return;
            const newGeofence: Geofence = {
              id: `custom-${Date.now()}`,
              name: `Custom Zone ${customGeofences.length + 1}`,
              type: 'circle',
              coordinates: [[lng, lat]],
              radius: 2000,
              alertOnEntry: true,
              alertOnExit: false,
            };
            setCustomGeofences(prev => [...prev, newGeofence]);
            setAddingGeofence(false);
          }}
          onMapRightClick={(lat, lng) => {
            const label = `POI-${pois.length + 1}`;
            setPois(prev => [...prev, { id: `${label}-${Date.now()}`, lat, lng, label }]);
          }}
          onPoiClick={(poi) => {
            setFocusPosition({ lat: poi.lat, lng: poi.lng });
          }}
        />

        {/* Desktop Control Panel */}
        <div className="hidden md:block absolute bottom-4 left-4 tactical-panel p-3 text-[var(--foreground)] space-y-3 rounded-sm z-40 w-44">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-color)] pb-1">Feed</div>
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-2 text-xs block w-full text-left border ${isLive ? 'tactical-button' : 'bg-[var(--alert-yellow)] text-black border-[var(--alert-yellow)]'}`}
          >
            {isLive ? 'PAUSE FEED' : 'RESUME FEED'}
          </button>

          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-color)] pb-1">Map Layers</div>
          <div className="grid grid-cols-2 gap-1">
            {(['dark', 'satellite', 'street', 'terrain'] as Basemap[]).map(b => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className={`px-2 py-1 text-[10px] border ${basemap === b ? 'bg-[var(--military-green)] text-black border-[var(--military-green)]' : 'tactical-button'}`}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setShowTracks(!showTracks)}
              className={`px-2 py-2 text-[10px] border ${showTracks ? 'tactical-button' : 'bg-[var(--text-dim)] text-black border-[var(--text-dim)]'}`}
            >
              TRACKS {showTracks ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowPredictedPaths(!showPredictedPaths)}
              className={`px-2 py-2 text-[10px] border ${showPredictedPaths ? 'tactical-button' : 'bg-[var(--text-dim)] text-black border-[var(--text-dim)]'}`}
            >
              PATHS {showPredictedPaths ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--border-color)] pb-1">Actions</div>
          <button
            onClick={() => setFocusPosition({ lat: baseLocation.lat, lng: baseLocation.lng })}
            className="tactical-button px-3 py-2 text-xs block w-full text-left"
          >
            CENTER BASE
          </button>
          <button
            onClick={() => setAddingGeofence(!addingGeofence)}
            className={`px-3 py-2 text-xs block w-full text-left border ${addingGeofence ? 'bg-[var(--military-green)] text-black border-[var(--military-green)]' : 'tactical-button'}`}
          >
            {addingGeofence ? 'CLICK MAP TO ADD ZONE' : 'ADD GEOFENCE'}
          </button>
          <button
            onClick={() => setPois([])}
            className="tactical-button px-3 py-2 text-xs block w-full text-left"
          >
            CLEAR POIs ({pois.length})
          </button>
          <button
            onClick={() => downloadIncidentReport(exportIncidentReport(alerts, assets, threats))}
            className="tactical-button critical px-3 py-2 text-xs block w-full text-left"
          >
            EXPORT REPORT
          </button>

          <div className="text-[10px] text-[var(--text-dim)] pt-2 border-t border-[var(--border-color)]">
            SPACE pause · A ack · ESC clear · R-CLICK add POI
          </div>
        </div>

        {/* Mobile Bottom Control Bar */}
        <div className="md:hidden absolute bottom-2 left-2 right-2 tactical-panel px-2 py-2 flex items-center justify-between gap-1 z-50 rounded-sm">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex-1 px-2 py-2 text-[10px] font-bold text-center border rounded-sm ${isLive ? 'tactical-button' : 'bg-[var(--alert-yellow)] text-black border-[var(--alert-yellow)]'}`}
          >
            {isLive ? 'PAUSE' : 'LIVE'}
          </button>
          <button
            onClick={() => setFocusPosition({ lat: baseLocation.lat, lng: baseLocation.lng })}
            className="flex-1 tactical-button px-2 py-2 text-[10px] font-bold text-center border rounded-sm"
          >
            BASE
          </button>
          <button
            onClick={() => {
              const basemaps: Basemap[] = ['dark', 'satellite', 'street', 'terrain'];
              setBasemap(basemaps[(basemaps.indexOf(basemap) + 1) % basemaps.length]);
            }}
            className="flex-1 tactical-button px-2 py-2 text-[10px] font-bold text-center border rounded-sm uppercase"
          >
            {basemap.slice(0, 3)}
          </button>
          <button
            onClick={() => setAddingGeofence(!addingGeofence)}
            className={`flex-1 px-2 py-2 text-[10px] font-bold text-center border rounded-sm ${addingGeofence ? 'bg-[var(--military-green)] text-black border-[var(--military-green)]' : 'tactical-button'}`}
          >
            {addingGeofence ? 'TAP' : 'ZONE'}
          </button>
          <button
            onClick={() => setShowMobileAlerts(prev => !prev)}
            className="flex-1 tactical-button px-2 py-2 text-[10px] font-bold text-center border rounded-sm relative"
          >
            ALERTS
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--alert-red)] text-black text-[8px] font-bold px-1 rounded-full">
                {alerts.filter(a => !a.acknowledged).length}
              </span>
            )}
          </button>
        </div>

        {/* Alert Panel */}
        <div className={`${showMobileAlerts ? 'block' : 'hidden'} md:block absolute bottom-16 left-2 right-2 md:bottom-auto md:top-4 md:left-auto md:right-4 tactical-panel p-3 md:p-4 text-[var(--foreground)] text-sm md:w-80 max-h-[50vh] md:max-h-[calc(100%-2rem)] overflow-y-auto tactical-scroll rounded-sm z-40`}>
          <div className="font-bold mb-3 text-base tracking-wider border-b border-[var(--border-color)] pb-1 flex items-center justify-between">
            <span>ALERTS</span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--alert-red)]">{alerts.filter(a => !a.acknowledged).length}</span>
              <button
                onClick={async () => {
                  await clearAcknowledgedAlertsBackend();
                  const fresh = await fetchAlerts(undefined, 100);
                  setAlerts(fresh);
                }}
                className="text-[10px] text-[var(--text-dim)] hover:text-[var(--foreground)] border border-[var(--border-color)] px-2 py-1 md:py-0.5 min-h-[32px] md:min-h-0"
              >
                CLEAR ACK
              </button>
              <button
                onClick={() => setShowMobileAlerts(false)}
                className="md:hidden text-[10px] text-[var(--text-dim)] hover:text-[var(--foreground)] border border-[var(--border-color)] px-2 py-1 min-h-[32px]"
              >
                CLOSE
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="text-[var(--text-dim)] text-xs border border-[var(--border-color)] p-2">
                NO ACTIVE ALERTS — SECTOR CLEAR
              </div>
            )}
            {alerts.slice(0, 15).map(alert => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.relatedAssetId) {
                    const asset = assets.find(a => a.id === alert.relatedAssetId);
                    if (asset) {
                      setSelectedItem(asset);
                      setFocusPosition({ lat: asset.position.lat, lng: asset.position.lng });
                    }
                  } else if (alert.relatedThreatId) {
                    const threat = threats.find(t => t.id === alert.relatedThreatId);
                    if (threat) {
                      setSelectedItem(threat);
                      setFocusPosition({ lat: threat.position.lat, lng: threat.position.lng });
                    }
                  }
                }}
                className={`text-xs border-l-2 pl-3 py-2 cursor-pointer hover:bg-[rgba(0,255,65,0.05)] hover:border-l-4 transition-all ${
                  alert.severity === 'critical'
                    ? 'border-[var(--alert-red)] bg-[rgba(255,51,51,0.1)]'
                    : 'border-[var(--alert-yellow)] bg-[rgba(255,204,0,0.05)]'
                } ${alert.acknowledged ? 'opacity-50' : ''}`}
                title="Click to go to aircraft / threat"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`font-bold ${alert.severity === 'critical' ? 'text-[var(--alert-red)]' : 'text-[var(--alert-yellow)]'}`}>
                    {alert.severity.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.relatedAssetId && (
                      <span className="text-[10px] text-[var(--text-dim)]">GO TO AIRCRAFT</span>
                    )}
                    {!alert.acknowledged && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await acknowledgeAlertBackend(alert.id, 'operator');
                          const fresh = await fetchAlerts(undefined, 100);
                          setAlerts(fresh);
                        }}
                        className="text-[10px] border border-[var(--border-color)] px-2 py-0.5 hover:bg-[var(--military-green)] hover:text-black"
                      >
                        ACK
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[var(--foreground)] mt-1">{alert.message}</div>
                {alert.acknowledged && (
                  <div className="text-[10px] text-[var(--text-dim)] mt-1">
                    ACK BY {alert.acknowledgedBy} @ {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString() : ''}
                  </div>
                )}
                <div className="text-[10px] text-[var(--text-dim)] mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Item Detail Panel */}
        {selectedItem && (
          <div
            className={`absolute tactical-panel p-3 md:p-4 text-[var(--foreground)] text-sm md:w-[28rem] md:max-h-[calc(100vh-8rem)] overflow-y-auto tactical-scroll z-40 transition-all duration-200 ease-out ${
              detailExpanded
                ? 'bottom-0 left-0 right-0 rounded-t-lg max-h-[85vh] md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-sm'
                : 'bottom-0 left-0 right-0 rounded-t-lg max-h-[40vh] md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-sm md:max-h-[calc(100vh-8rem)]'
            }`}
          >
            {/* Mobile sheet handle */}
            <div
              className="md:hidden flex flex-col items-center pb-2 cursor-pointer"
              onClick={() => setDetailExpanded(v => !v)}
              role="button"
              aria-label={detailExpanded ? 'Collapse details' : 'Expand details'}
            >
              <div className="w-10 h-1 bg-[var(--text-dim)] rounded-full mb-1.5" />
              <div className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider">
                {detailExpanded ? 'Tap to collapse' : 'Tap to expand'}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-2">
              <div className="font-bold text-base tracking-wider truncate pr-2">
                {'category' in selectedItem ? selectedItem.name : selectedItem.name}
              </div>
              <div className="flex items-center gap-2">
                {'category' in selectedItem && (
                  <button
                    onClick={() => {
                      const id = selectedItem.metadata?.icao24 || selectedItem.id;
                      setFollowAssetId(followAssetId === id ? null : id);
                    }}
                    className={`text-[10px] border px-2 py-1 min-h-[32px] md:min-h-0 md:py-0.5 ${
                      followAssetId === (selectedItem.metadata?.icao24 || selectedItem.id)
                        ? 'bg-[var(--alert-yellow)] text-black border-[var(--alert-yellow)]'
                        : 'text-[var(--text-dim)] hover:text-[var(--foreground)] border-[var(--border-color)]'
                    }`}
                  >
                    {followAssetId === (selectedItem.metadata?.icao24 || selectedItem.id) ? 'UNFOLLOW' : 'FOLLOW'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-[10px] text-[var(--text-dim)] hover:text-[var(--foreground)] border border-[var(--border-color)] px-2 py-1 min-h-[32px] md:min-h-0 md:py-0.5"
                >
                  CLOSE
                </button>
              </div>
            </div>
            {selectedItemInfoLoading && (
              <div className="text-[10px] text-[var(--text-dim)] mb-2">LOADING AIRCRAFT PHOTO...</div>
            )}
            {selectedItemInfo?.imageUrl && !selectedItemImageError && (
              <div className="mb-3 border border-[var(--border-color)] p-1 bg-black/40">
                <img
                  src={selectedItemInfo.imageUrl}
                  alt="Aircraft"
                  className="w-full h-40 object-contain"
                  loading="lazy"
                  onError={() => setSelectedItemImageError(true)}
                />
                <div className="text-[10px] text-[var(--text-dim)] mt-1 text-center">WIKIMEDIA COMMONS / WIKIPEDIA</div>
              </div>
            )}
            {selectedItemInfo && !selectedItemInfoLoading && (!selectedItemInfo.imageUrl || selectedItemImageError) && (
              <div className="mb-3 border border-[var(--border-color)] p-2 bg-black/40 flex flex-col items-center justify-center h-40">
                <svg viewBox="0 0 100 40" className="w-32 h-12 text-[var(--text-dim)] opacity-40" fill="currentColor">
                  <path d="M50 2 L90 20 L80 22 L55 14 L55 36 L65 38 L35 38 L45 36 L45 14 L20 22 L10 20 Z" />
                </svg>
                <div className="text-[10px] text-[var(--text-dim)] mt-2 text-center">NO PHOTO AVAILABLE</div>
                <div className="text-[10px] text-[var(--text-dim)] text-center">{getAircraftTypeName(selectedItemInfo.type || selectedItem.metadata?.aircraftType)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              {'category' in selectedItem && (
                <>
                  <span className="text-[var(--text-dim)]">TYPE:</span>
                  <span>{getAircraftTypeName(selectedItemInfo?.type || selectedItem.metadata?.aircraftType)}</span>
                  <span className="text-[var(--text-dim)]">CATEGORY:</span>
                  <span>{selectedItem.category}</span>
                  <span className="text-[var(--text-dim)]">CLASSIFICATION:</span>
                  <span className={
                    (selectedItemInfo?.classification || selectedItem.metadata?.classification) === 'military' ? 'text-[var(--alert-red)]'
                    : (selectedItemInfo?.classification || selectedItem.metadata?.classification) === 'helicopter' ? 'text-[var(--alert-yellow)]'
                    : (selectedItemInfo?.classification || selectedItem.metadata?.classification) === 'cargo' ? 'text-[#ffff00]'
                    : 'text-[var(--safe-green)]'
                  }>
                    {(selectedItemInfo?.classification || selectedItem.metadata?.classification || 'UNKNOWN').toUpperCase()}
                  </span>
                  <div className="hidden md:contents">
                    {selectedItemInfo?.registration && (
                      <><span className="text-[var(--text-dim)]">REGISTRATION:</span><span>{selectedItemInfo.registration}</span></>
                    )}
                    {selectedItemInfo?.operator && (
                      <><span className="text-[var(--text-dim)]">OPERATOR:</span><span>{selectedItemInfo.operator}</span></>
                    )}
                    {selectedItem.metadata?.landingStatus && (
                      <><span className="text-[var(--text-dim)]">STATUS:</span><span className={
                        selectedItem.metadata.landingStatus === 'landed' ? 'text-[var(--alert-red)]'
                        : selectedItem.metadata.landingStatus === 'landing' ? 'text-[var(--alert-yellow)]'
                        : selectedItem.metadata.landingStatus === 'departing' ? 'text-[#ffff00]'
                        : 'text-[var(--safe-green)]'
                      }>{selectedItem.metadata.landingStatus.toUpperCase()}</span></>
                    )}
                    {selectedItem.metadata?.nearestAirport && (
                      <><span className="text-[var(--text-dim)]">NEAREST AIRPORT:</span><span>{selectedItem.metadata.nearestAirport.icao} — {selectedItem.metadata.nearestAirport.name} ({(selectedItem.metadata.nearestAirport.distanceM / 1000).toFixed(1)} km)</span></>
                    )}
                  </div>
                  <span className="text-[var(--text-dim)]">SPEED:</span>
                  <span>{Math.round(selectedItem.speed)} kn</span>
                  <span className="text-[var(--text-dim)]">HEADING:</span>
                  <span>{Math.round(selectedItem.heading)}°</span>
                  <span className="text-[var(--text-dim)]">ALTITUDE:</span>
                  <span>{selectedItem.position.altitude ? Math.round(selectedItem.position.altitude) : 'N/A'} m</span>
                  <div className="hidden md:contents">
                    {selectedItem.metadata?.icao24 && (
                      <><span className="text-[var(--text-dim)]">ICAO24:</span><span>{selectedItem.metadata.icao24}</span></>
                    )}
                    {selectedItem.metadata?.callsign && (
                      <><span className="text-[var(--text-dim)]">CALLSIGN:</span><span>{selectedItem.metadata.callsign}</span></>
                    )}
                    {selectedItem.metadata?.originCountry && (
                      <><span className="text-[var(--text-dim)]">ORIGIN:</span><span>{selectedItem.metadata.originCountry}</span></>
                    )}
                    {selectedItem.metadata?.squawk && (
                      <><span className="text-[var(--text-dim)]">SQUAWK:</span><span>{selectedItem.metadata.squawk}</span></>
                    )}
                    {selectedItem.metadata?.verticalRate !== undefined && (
                      <><span className="text-[var(--text-dim)]">VERT RATE:</span><span>{Math.round(selectedItem.metadata.verticalRate)} m/s</span></>
                    )}
                    {selectedItem.metadata?.onGround !== undefined && (
                      <><span className="text-[var(--text-dim)]">ON GROUND:</span><span>{selectedItem.metadata.onGround ? 'YES' : 'NO'}</span></>
                    )}
                    {selectedItem.metadata?.source && (
                      <><span className="text-[var(--text-dim)]">SOURCE:</span><span>{selectedItem.metadata.source}</span></>
                    )}
                  </div>
                </>
              )}
              {'estimatedImpact' in selectedItem && (
                <>
                  <span className="text-[var(--text-dim)]">TYPE:</span>
                  <span>{selectedItem.type}</span>
                  <span className="text-[var(--text-dim)]">SEVERITY:</span>
                  <span className={selectedItem.severity === 'critical' ? 'text-[var(--alert-red)]' : 'text-[var(--alert-yellow)]'}>{selectedItem.severity}</span>
                  <span className="text-[var(--text-dim)]">IMPACT:</span>
                  <span>{selectedItem.estimatedImpact}%</span>
                  <span className="text-[var(--text-dim)]">STATUS:</span>
                  <span>{selectedItem.status}</span>
                </>
              )}
              <span className="text-[var(--text-dim)]">LAT:</span>
              <span>{selectedItem.position.lat.toFixed(4)}</span>
              <span className="text-[var(--text-dim)]">LNG:</span>
              <span>{selectedItem.position.lng.toFixed(4)}</span>
            </div>
            {'category' in selectedItem && (selectedItemRoute || selectedItemRouteLoading) && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                <div className="font-bold text-xs tracking-wider mb-2 text-[var(--text-dim)] flex items-center justify-between">
                  <span>ROUTE</span>
                  {selectedItemRouteLoading && <span className="text-[10px] animate-pulse">LOADING...</span>}
                </div>
                {selectedItemRoute?.route ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-center flex-1">
                      <div className="text-[var(--alert-yellow)] font-bold text-lg">{selectedItemRoute.origin || '—'}</div>
                      <div className="text-[10px] text-[var(--text-dim)]">ORIGIN</div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-[var(--text-dim)]">→</div>
                      <div className="text-[10px] text-[var(--text-dim)]">{selectedItemRoute.route}</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-[var(--safe-green)] font-bold text-lg">{selectedItemRoute.destination || '—'}</div>
                      <div className="text-[10px] text-[var(--text-dim)]">DEST</div>
                    </div>
                  </div>
                ) : !selectedItemRouteLoading ? (
                  <div className="text-xs text-[var(--text-dim)]">No route data available for this callsign.</div>
                ) : null}
              </div>
            )}

            {'category' in selectedItem && selectedItem.metadata?.nearestAirport && (
              <div className="hidden md:block mt-3 pt-3 border-t border-[var(--border-color)]">
                <div className="font-bold text-xs tracking-wider mb-2 text-[var(--text-dim)]">NEAREST AIRPORT</div>
                <div className="text-xs mb-2">
                  <span className="text-[var(--text-dim)]">AIRPORT:</span>{' '}
                  <span>{selectedItem.metadata.nearestAirport.icao} — {selectedItem.metadata.nearestAirport.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {NEARBY_AIRPORTS.find(a => a.icao === selectedItem.metadata?.nearestAirport?.icao)?.frequencies?.map(f => (
                    <div key={f.name} className="text-[10px] border border-[var(--border-color)] p-1 text-center">
                      <div className="text-[var(--text-dim)]">{f.name}</div>
                      <div className="text-[var(--foreground)]">{f.freq}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {'category' in selectedItem && selectedItem.metadata?.threatScore && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                <div className="font-bold text-xs tracking-wider mb-2 text-[var(--text-dim)] flex items-center justify-between">
                  <span>BEHAVIORAL THREAT SCORE</span>
                  <span className={
                    selectedItem.metadata.threatScore.level === 'critical' ? 'text-[var(--alert-red)]'
                    : selectedItem.metadata.threatScore.level === 'high' ? 'text-[var(--alert-yellow)]'
                    : selectedItem.metadata.threatScore.level === 'medium' ? 'text-[#ffff00]'
                    : 'text-[var(--safe-green)]'
                  }>
                    {selectedItem.metadata.threatScore.total}/100 — {selectedItem.metadata.threatScore.level.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-dim)] mb-1">PRIMARY: {selectedItem.metadata.threatScore.primaryFactor}</div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {Object.entries(selectedItem.metadata.threatScore.factors).map(([factor, value]) => (
                    <div key={factor} className="flex items-center justify-between border border-[var(--border-color)] p-1">
                      <span className="text-[var(--text-dim)]">{factor.replace('Score', '').replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className={value > 60 ? 'text-[var(--alert-red)]' : value > 35 ? 'text-[var(--alert-yellow)]' : 'text-[var(--safe-green)]'}>{Math.round(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setFocusPosition({ lat: selectedItem.position.lat, lng: selectedItem.position.lng })}
                className="tactical-button px-3 py-1 text-xs flex-1"
              >
                TRACK TARGET
              </button>
              <button
                onClick={() => {
                  const report = exportIncidentReport(alerts, assets, threats);
                  downloadIncidentReport(report);
                }}
                className="tactical-button critical px-3 py-1 text-xs flex-1"
              >
                LOG INCIDENT
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Base Location Config Panel */}
      {showBaseConfig && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-2 md:p-0">
          <div className="tactical-panel p-4 w-full md:w-80 max-w-[28rem] text-[var(--foreground)]">
            <div className="font-bold text-sm tracking-wider border-b border-[var(--border-color)] pb-2 mb-3 flex items-center justify-between">
              <span>SET OPERATING BASE</span>
              <button onClick={() => setShowBaseConfig(false)} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--foreground)] border border-[var(--border-color)] px-2 py-1 min-h-[32px]">CLOSE</button>
            </div>

            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Presets</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {[
                { lat: 29.4241, lng: -98.4936, name: 'SAN ANTONIO, TX — JBSA', radiusKm: 75 },
                { lat: 36.7783, lng: -119.4179, name: 'FRESNO, CA — 144 FW', radiusKm: 100 },
                { lat: 36.8219, lng: -76.3043, name: 'NORFOLK, VA — NAS', radiusKm: 80 },
                { lat: 49.4369, lng: 7.6005, name: 'RAMSTEIN, DE — AB', radiusKm: 90 },
                { lat: 35.6762, lng: 139.6503, name: 'YOKOTA, JP — AB', radiusKm: 100 },
                { lat: 25.7959, lng: -80.2870, name: 'MIAMI, FL — HOMESTEAD', radiusKm: 90 },
              ].map(preset => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setBaseLocation(preset);
                    setBaseConfigForm(preset);
                    setShowBaseConfig(false);
                  }}
                  className={`text-[10px] border p-1 py-2 md:py-1 text-left min-h-[44px] ${baseLocation.name === preset.name ? 'bg-[var(--military-green)] text-black border-[var(--military-green)]' : 'tactical-button'}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Custom Coordinates</div>
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.0001"
                  value={baseConfigForm.lat}
                  onChange={(e) => setBaseConfigForm(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                  className="bg-black/40 border border-[var(--border-color)] text-[10px] px-2 py-1 min-h-[40px] text-[var(--foreground)]"
                  placeholder="Lat"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={baseConfigForm.lng}
                  onChange={(e) => setBaseConfigForm(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                  className="bg-black/40 border border-[var(--border-color)] text-[10px] px-2 py-1 min-h-[40px] text-[var(--foreground)]"
                  placeholder="Lng"
                />
              </div>
              <input
                type="text"
                value={baseConfigForm.name}
                onChange={(e) => setBaseConfigForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black/40 border border-[var(--border-color)] text-[10px] px-2 py-1 min-h-[40px] text-[var(--foreground)]"
                placeholder="Sector name"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-dim)]">RADIUS KM:</span>
                <input
                  type="number"
                  value={baseConfigForm.radiusKm}
                  onChange={(e) => setBaseConfigForm(prev => ({ ...prev, radiusKm: Math.max(10, Math.min(500, parseInt(e.target.value) || 75)) }))}
                  className="flex-1 bg-black/40 border border-[var(--border-color)] text-[10px] px-2 py-1 min-h-[40px] text-[var(--foreground)]"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!navigator.geolocation) {
                  setGeoError('Geolocation is not supported by this browser.');
                  return;
                }
                setGeoLoading(true);
                setGeoError(null);
                navigator.geolocation.getCurrentPosition(
                  pos => {
                    const updated = {
                      ...baseConfigForm,
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                      name: 'CURRENT LOCATION — OPERATOR',
                    };
                    setBaseConfigForm(updated);
                    setBaseLocation(updated);
                    setGeoLoading(false);
                    setShowBaseConfig(false);
                  },
                  err => {
                    setGeoLoading(false);
                    switch (err.code) {
                      case err.PERMISSION_DENIED:
                        setGeoError('Location permission denied. Check browser settings and try again.');
                        break;
                      case err.POSITION_UNAVAILABLE:
                        setGeoError('Position unavailable. Try again or enter coordinates manually.');
                        break;
                      case err.TIMEOUT:
                        setGeoError('Location request timed out. Try again.');
                        break;
                      default:
                        setGeoError('Could not retrieve location.');
                    }
                  },
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
                );
              }}
              disabled={geoLoading}
              className={`tactical-button px-3 py-2 text-xs block w-full text-left mb-2 min-h-[44px] ${geoLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {geoLoading ? 'GETTING LOCATION...' : 'USE MY LOCATION'}
            </button>
            {geoError && (
              <div className="text-[10px] text-[var(--alert-red)] mb-2">{geoError}</div>
            )}
            <button
              onClick={() => {
                setBaseLocation(baseConfigForm);
                setShowBaseConfig(false);
              }}
              className="tactical-button px-3 py-2 text-xs block w-full text-left min-h-[44px]"
            >
              APPLY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
