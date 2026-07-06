'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { forward as mgrsForward } from 'mgrs';
import { Asset, Threat, Geofence } from '@/types/tactical';
import { PredictedPath } from '@/lib/threatIntel';
import { getAssetIcon, getThreatIcon } from '@/lib/militarySymbols';
import { getMilStd2525DIcon } from '@/lib/milstd2525';

function getBasemapUrl(basemap: Basemap): string {
  switch (basemap) {
    case 'satellite':
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    case 'street':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    case 'terrain':
      return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    case 'dark':
    default:
      return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  }
}

function getBasemapAttribution(basemap: Basemap): string {
  switch (basemap) {
    case 'satellite':
      return '&copy; Esri';
    case 'street':
      return '&copy; OpenStreetMap contributors';
    case 'terrain':
      return '&copy; OpenStreetMap contributors, SRTM';
    case 'dark':
    default:
      return '&copy; OpenStreetMap contributors &copy; CARTO';
  }
}

function getBasemapMaxZoom(basemap: Basemap): number {
  switch (basemap) {
    case 'satellite':
      return 18;
    case 'terrain':
      return 17;
    case 'street':
    case 'dark':
    default:
      return 19;
  }
}

function getBasemapSubdomains(basemap: Basemap): string {
  switch (basemap) {
    case 'dark':
      return 'abcd'; // CARTO
    case 'satellite':
      return 'abc'; // Esri (url has no {s}, but keep consistent)
    case 'street':
    case 'terrain':
    default:
      return 'abc'; // OSM / OpenTopoMap
  }
}

function latLngToMgrs(lat: number, lng: number): string {
  try {
    return mgrsForward([lng, lat]);
  } catch {
    return '---';
  }
}

export type Basemap = 'dark' | 'satellite' | 'street' | 'terrain';

interface TacticalMapProps {
  assets: Asset[];
  threats: Threat[];
  geofences?: Geofence[];
  predictedPaths?: PredictedPath[];
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
}

export default function TacticalMap({ assets, threats, geofences = [], predictedPaths = [], pois = [], focusPosition, baseLocation, basemap = 'dark', aircraftImageMap = {}, classificationMap = {}, trackHistory = {}, showTracks = true, showPredictedPaths = true, followAssetId = null, onAssetClick, onThreatClick, onMapClick, onMapRightClick, onPoiClick }: TacticalMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const assetLayer = useRef<L.LayerGroup | null>(null);
  const threatLayer = useRef<L.LayerGroup | null>(null);
  const geofenceLayer = useRef<L.LayerGroup | null>(null);
  const pathLayer = useRef<L.LayerGroup | null>(null);
  const poiLayer = useRef<L.LayerGroup | null>(null);
  const trackLayer = useRef<L.LayerGroup | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialMaxZoom = getBasemapMaxZoom(basemap);
    const initialCenter = baseLocation ? [baseLocation.lat, baseLocation.lng] as [number, number] : [29.4241, -98.4936] as [number, number];
    const initialZoom = baseLocation ? Math.max(9, 14 - Math.log2(baseLocation.radiusKm / 5)) : 12;
    map.current = L.map(mapContainer.current, { maxZoom: initialMaxZoom }).setView(initialCenter, initialZoom);
    tileLayer.current = L.tileLayer(getBasemapUrl(basemap), {
      attribution: getBasemapAttribution(basemap),
      subdomains: getBasemapSubdomains(basemap),
      maxZoom: initialMaxZoom,
      maxNativeZoom: initialMaxZoom,
    }).addTo(map.current);

    map.current.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursor({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.current.on('mouseout', () => setCursor(null));

    assetLayer.current = L.layerGroup().addTo(map.current);
    threatLayer.current = L.layerGroup().addTo(map.current);
    geofenceLayer.current = L.layerGroup().addTo(map.current);
    pathLayer.current = L.layerGroup().addTo(map.current);
    poiLayer.current = L.layerGroup().addTo(map.current);
    trackLayer.current = L.layerGroup().addTo(map.current);

    if (onMapClick) {
      map.current.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Pan to focus position when it changes
  useEffect(() => {
    if (!map.current || !focusPosition) return;
    map.current.setView([focusPosition.lat, focusPosition.lng], 14, {
      animate: true,
      duration: 1,
    });
  }, [focusPosition]);

  // Pan to base location when it changes
  useEffect(() => {
    if (!map.current || !baseLocation) return;
    const zoom = Math.max(9, 14 - Math.log2(baseLocation.radiusKm / 5));
    map.current.setView([baseLocation.lat, baseLocation.lng], zoom, {
      animate: true,
      duration: 1,
    });
  }, [baseLocation]);

  // Follow selected asset on map
  useEffect(() => {
    if (!map.current || !followAssetId) return;
    const asset = assets.find(a => a.id === followAssetId || a.metadata?.icao24 === followAssetId);
    if (!asset) return;
    map.current.panTo([asset.position.lat, asset.position.lng], { animate: true, duration: 0.8 });
  }, [assets, followAssetId]);

  // Update basemap when prop changes
  useEffect(() => {
    if (!map.current) return;
    const maxZoom = getBasemapMaxZoom(basemap);
    if (tileLayer.current) {
      map.current.removeLayer(tileLayer.current);
    }
    tileLayer.current = L.tileLayer(getBasemapUrl(basemap), {
      attribution: getBasemapAttribution(basemap),
      subdomains: getBasemapSubdomains(basemap),
      maxZoom,
      maxNativeZoom: maxZoom,
    }).addTo(map.current);
    map.current.setMaxZoom(maxZoom);
    if (map.current.getZoom() > maxZoom) {
      map.current.setZoom(maxZoom);
    }
  }, [basemap]);

  // Right-click handler
  useEffect(() => {
    if (!map.current || !onMapRightClick) return;
    const handler = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      onMapRightClick(e.latlng.lat, e.latlng.lng);
    };
    map.current.on('contextmenu', handler);
    return () => {
      map.current?.off('contextmenu', handler);
    };
  }, [onMapRightClick]);

  function getAssetIconWithImage(asset: Asset, imageUrl?: string | null, classification?: string | null): L.DivIcon {
    const callsign = asset.metadata?.callsign || asset.name;
    const alt = asset.position.altitude ? `${Math.round(asset.position.altitude)}m` : '';
    const clsShort = classification ? classification[0].toUpperCase() : '';
    const score = asset.metadata?.threatScore;
    const threatLevel = score?.level || 'low';
    const threatColor = threatLevel === 'critical' ? '#ff3333'
      : threatLevel === 'high' ? '#ff9900'
      : threatLevel === 'medium' ? '#ffff00'
      : '#00ff00';
    const classificationColor = classification === 'military' ? '#ff3333'
      : classification === 'helicopter' ? '#ff9900'
      : classification === 'cargo' ? '#ffff00'
      : classification === 'commercial' ? '#00ff00'
      : '#00ff00';
    const scoreBadge = score && score.total > 0 ? `<span style="margin-left:4px;padding:0 3px;background:${threatColor};color:#000;font-size:8px;border-radius:2px;">${score.total}</span>` : '';
    const label = `${callsign}${alt ? ' · ' + alt : ''}${clsShort ? ' · ' + clsShort : ''}${scoreBadge}`;
    const markerHtml = imageUrl
      ? `<div style="position:relative;width:26px;height:26px;border-radius:50%;border:2px solid ${classificationColor};overflow:hidden;background:#000;box-shadow:0 0 4px ${threatColor};"><img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none'" /><div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${threatColor};pointer-events:none;"></div></div>`
      : `<div style="position:relative;width:26px;height:26px;border-radius:50%;border:2px solid ${classificationColor};background:#000;box-shadow:0 0 4px ${threatColor};display:flex;align-items:center;justify-content:center;color:${classificationColor};font-size:12px;font-weight:bold;">${clsShort || 'A'}<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${threatColor};pointer-events:none;"></div></div>`;
    return L.divIcon({
      className: 'aircraft-marker',
      html: `<div style="display:flex;flex-direction:column;align-items:center;">${markerHtml}<div style="margin-top:2px;padding:1px 4px;background:rgba(0,0,0,0.7);border:1px solid ${threatColor};color:${threatColor};font-size:9px;font-family:monospace;white-space:nowrap;border-radius:2px;">${label}</div></div>`,
      iconSize: [26, 40],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    });
  }

  useEffect(() => {
    if (!map.current || !assetLayer.current) return;
    assetLayer.current.clearLayers();

    assets.forEach(asset => {
      const icao24 = asset.metadata?.icao24 || asset.id;
      const imageUrl = aircraftImageMap[icao24];
      const classification = classificationMap[icao24] || asset.metadata?.classification || null;
      const score = asset.metadata?.threatScore;
      const scoreText = score ? `<br/><strong>THREAT SCORE:</strong> ${score.total}/100 (${score.level})<br/>Primary: ${score.primaryFactor}` : '';
      
      // Use MIL-STD-2525D icon if available, otherwise fall back to custom icon
      const icon = asset.milStd2525D 
        ? getMilStd2525DIcon(asset)
        : getAssetIconWithImage(asset, imageUrl, classification);
      
      const sidcText = asset.milStd2525D?.sidc ? `<br/><strong>SIDC:</strong> ${asset.milStd2525D.sidc}` : '';
      const echelonText = asset.milStd2525D?.echelon ? `<br/><strong>Echelon:</strong> ${asset.milStd2525D.echelon}` : '';
      
      const marker = L.marker([asset.position.lat, asset.position.lng], {
        icon,
      }).bindPopup(`<strong>${asset.name}</strong><br/>Type: ${asset.type}<br/>Category: ${asset.category}<br/>Classification: ${classification || 'unknown'}<br/>Status: ${asset.status}<br/>Speed: ${Math.round(asset.speed)} kn<br/>Heading: ${Math.round(asset.heading)}°${scoreText}${sidcText}${echelonText}`);
      if (onAssetClick) marker.on('click', () => onAssetClick(asset));
      marker.addTo(assetLayer.current!);
    });
  }, [assets, aircraftImageMap, classificationMap]);

  // Render track history trails
  useEffect(() => {
    if (!map.current || !trackLayer.current) return;
    trackLayer.current.clearLayers();
    if (!showTracks) return;

    Object.entries(trackHistory).forEach(([icao24, points]) => {
      if (points.length < 2) return;
      const latLngs = points.map(p => [p.lat, p.lng] as L.LatLngExpression);
      L.polyline(latLngs, {
        color: '#00ff00',
        weight: 2,
        opacity: 0.4,
        dashArray: '4, 6',
      }).bindPopup(`Track history: ${icao24}`).addTo(trackLayer.current!);
    });
  }, [trackHistory, showTracks]);

  useEffect(() => {
    if (!map.current || !threatLayer.current) return;
    threatLayer.current.clearLayers();

    threats.forEach(threat => {
      const marker = L.marker([threat.position.lat, threat.position.lng], {
        icon: getThreatIcon(threat),
      }).bindPopup(`<strong>THREAT</strong><br/>Name: ${threat.name}<br/>Type: ${threat.type}<br/>Severity: ${threat.severity}<br/>Status: ${threat.status}<br/>Impact: ${threat.estimatedImpact}%`);
      if (onThreatClick) marker.on('click', () => onThreatClick(threat));
      marker.addTo(threatLayer.current!);
    });
  }, [threats]);

  // Update geofences on map
  useEffect(() => {
    if (!map.current || !geofenceLayer.current) return;
    geofenceLayer.current.clearLayers();

    // Base marker
    if (baseLocation) {
      L.marker([baseLocation.lat, baseLocation.lng], {
        icon: L.divIcon({
          className: 'base-marker',
          html: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#ff3333" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="#ff3333"/><path d="M10 2 L10 18 M2 10 L18 10" stroke="#ff3333" stroke-width="1" stroke-opacity="0.5"/></svg>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).bindPopup(`<strong>BASE</strong><br/>${baseLocation.name}<br/>Lat: ${baseLocation.lat.toFixed(4)}<br/>Lng: ${baseLocation.lng.toFixed(4)}`).addTo(geofenceLayer.current!);
    }

    geofences.forEach(geofence => {
      if (geofence.type === 'circle' && geofence.radius) {
        const center = geofence.coordinates[0];
        const isBasePerimeter = geofence.name === 'BASE PERIMETER';
        const isRestricted = geofence.name === 'RESTRICTED AIRSPACE';
        const color = isBasePerimeter ? '#ff3333' : isRestricted ? '#ff9900' : '#ff6600';
        const fillOpacity = isBasePerimeter ? 0.15 : 0.08;
        const dashArray = isRestricted ? '10, 10' : undefined;

        L.circle([center[1], center[0]], {
          radius: geofence.radius,
          color,
          weight: isBasePerimeter ? 3 : 2,
          fillColor: color,
          fillOpacity,
          dashArray,
        }).bindPopup(`<strong>${geofence.name}</strong><br/>Radius: ${Math.round(geofence.radius / 1000)}km<br/>Restricted Zone`).addTo(geofenceLayer.current!);

        // Add a small label marker at the top of the ring
        const labelLat = center[1] + (geofence.radius / 111000);
        L.marker([labelLat, center[0]], {
          icon: L.divIcon({
            className: 'geofence-label',
            html: `<div style="color:${color};font-size:9px;font-family:monospace;font-weight:bold;text-shadow:0 0 2px #000;white-space:nowrap;">${geofence.name}</div>`,
            iconSize: [120, 12],
            iconAnchor: [60, 6],
          }),
        }).addTo(geofenceLayer.current!);
      }
    });
  }, [geofences, baseLocation]);

  // Update predicted paths on map
  useEffect(() => {
    if (!map.current || !pathLayer.current) return;
    pathLayer.current.clearLayers();
    if (!showPredictedPaths) return;

    predictedPaths.forEach(path => {
      const points = path.positions.map(p => [p.lat, p.lng] as L.LatLngExpression);
      if (points.length < 2) return;
      L.polyline(points, {
        color: '#ff00ff',
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10',
      }).bindPopup(`<strong>Predicted Path</strong><br/>Asset: ${path.assetId}`).addTo(pathLayer.current!);
    });
  }, [predictedPaths, showPredictedPaths]);

  // Update POIs on map
  useEffect(() => {
    if (!map.current || !poiLayer.current) return;
    poiLayer.current.clearLayers();

    pois.forEach(poi => {
      const marker = L.marker([poi.lat, poi.lng], {
        icon: L.divIcon({
          className: 'military-symbol',
          html: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#ffff00" stroke-width="2"/><text x="10" y="14" text-anchor="middle" fill="#ffff00" font-size="10">★</text></svg>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).bindPopup(`<strong>POI</strong><br/>${poi.label}<br/>Lat: ${poi.lat.toFixed(4)}<br/>Lng: ${poi.lng.toFixed(4)}`);
      if (onPoiClick) marker.on('click', () => onPoiClick(poi));
      marker.addTo(poiLayer.current!);
    });
  }, [pois]);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Map Title / Info Panel */}
      <div className="absolute top-4 left-4 tactical-panel p-4 text-[var(--foreground)] text-sm font-mono rounded-sm z-10">
        <div className="font-bold text-base mb-2 tracking-wider border-b border-[var(--border-color)] pb-1">
          TACTICAL SITUATION DISPLAY
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-[var(--text-dim)]">ASSETS:</span>
          <span className="text-right">{assets.length}</span>
          <span className="text-[var(--text-dim)]">THREATS:</span>
          <span className="text-right text-[var(--alert-red)]">{threats.length}</span>
          <span className="text-[var(--text-dim)]">HIGH/CRIT:</span>
          <span className="text-right text-[var(--alert-red)]">
            {assets.filter(a => a.metadata?.threatScore && ['high', 'critical'].includes(a.metadata.threatScore.level)).length}
          </span>
          <span className="text-[var(--text-dim)]">ZONES:</span>
          <span className="text-right">{geofences.length}</span>
        </div>
        <div className="mt-2 text-[10px] text-[var(--text-dim)]">CLICK MARKERS / RIGHT-CLICK MAP</div>
      </div>

      {/* Cursor Coordinates */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 tactical-panel px-3 py-1 text-[var(--foreground)] text-xs font-mono rounded-sm z-10">
        {cursor ? (
          <div className="flex items-center gap-4">
            <span>LAT: {cursor.lat.toFixed(5)}</span>
            <span>LNG: {cursor.lng.toFixed(5)}</span>
            <span>MGRS: {latLngToMgrs(cursor.lat, cursor.lng)}</span>
          </div>
        ) : (
          <span className="text-[var(--text-dim)]">MOVE CURSOR FOR COORDINATES</span>
        )}
      </div>

    </div>
  );
}
