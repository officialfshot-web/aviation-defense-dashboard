import L from 'leaflet';
import { Asset, Threat } from '@/types/tactical';

// NATO APP-6-inspired symbols using SVG
// Simplified for air/ground/sea assets and threats

export function getAssetIcon(asset: Asset): L.DivIcon {
  const frameColor = getFrameColor(asset.type);
  const fillColor = asset.category === 'air' ? '#00aaff' : asset.category === 'sea' ? '#00ffff' : '#00ff00';
  const symbol = getCategorySymbol(asset.category);

  return L.divIcon({
    className: 'military-symbol',
    html: `
      <svg width="32" height="32" viewBox="0 0 32 32" style="overflow:visible">
        ${getFrame(asset.type, frameColor)}
        <g transform="translate(16,16)" fill="${fillColor}" stroke="${frameColor}" stroke-width="1">
          ${symbol}
        </g>
      </svg>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export function getThreatIcon(threat: Threat): L.DivIcon {
  const color = threat.severity === 'critical' ? '#ff3333' : threat.severity === 'high' ? '#ff8800' : '#ffcc00';
  const symbol = threat.type === 'aircraft' ? getAircraftSymbol() : getGenericThreatSymbol();

  return L.divIcon({
    className: 'military-symbol',
    html: `
      <svg width="32" height="32" viewBox="0 0 32 32" style="overflow:visible">
        <polygon points="16,2 30,16 16,30 2,16" fill="none" stroke="${color}" stroke-width="2" />
        <g transform="translate(16,16)" fill="${color}" stroke="${color}" stroke-width="1">
          ${symbol}
        </g>
      </svg>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function getFrameColor(type: Asset['type']): string {
  switch (type) {
    case 'friendly': return '#00ff00';
    case 'hostile': return '#ff3333';
    case 'neutral': return '#00ffff';
    default: return '#ffff00';
  }
}

function getFrame(type: Asset['type'], color: string): string {
  switch (type) {
    case 'friendly':
      // Blue rectangle with green border for friendly (using green for this theme)
      return `<rect x="2" y="2" width="28" height="28" fill="none" stroke="${color}" stroke-width="2" />`;
    case 'hostile':
      // Red diamond for hostile
      return `<polygon points="16,2 30,16 16,30 2,16" fill="none" stroke="${color}" stroke-width="2" />`;
    case 'neutral':
      // Green circle for neutral
      return `<circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="2" />`;
    default:
      // Yellow square for unknown
      return `<rect x="4" y="4" width="24" height="24" fill="none" stroke="${color}" stroke-width="2" />`;
  }
}

function getCategorySymbol(category: Asset['category']): string {
  switch (category) {
    case 'air':
      return getAircraftSymbol();
    case 'sea':
      return getShipSymbol();
    case 'ground':
      return getGroundSymbol();
    default:
      return getAircraftSymbol();
  }
}

function getAircraftSymbol(): string {
  // Simple aircraft shape
  return `<path d="M-8,-2 L-3,-2 L0,-8 L3,-2 L8,-2 L8,2 L3,2 L0,8 L-3,2 L-8,2 Z" />`;
}

function getShipSymbol(): string {
  // Simple ship shape
  return `<path d="M-8,-4 L8,-4 L6,6 L-6,6 Z" />`;
}

function getGroundSymbol(): string {
  // Simple vehicle/ground unit
  return `<rect x="-7" y="-7" width="14" height="14" />`;
}

function getGenericThreatSymbol(): string {
  // Exclamation / blast shape
  return `<path d="M-2,-6 L2,-6 L1,2 L-1,2 Z M-2,4 L2,4 L2,6 L-2,6 Z" />`;
}
