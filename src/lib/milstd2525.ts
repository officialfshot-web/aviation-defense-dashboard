import L from 'leaflet';
import { Asset, MilStd2525D } from '@/types/tactical';

// ============================================================================
// MIL-STD-2525D Symbol Implementation
// ============================================================================

// SIDC (Symbol Identification Code) structure: 15 characters
// Position 1: Standard ID (S for MIL-STD-2525D)
// Position 2: Context (A=Air, G=Ground, S=Sea, etc.)
// Position 3: Standard Identity (F=Friend, H=Hostile, N=Neutral, U=Unknown, P=Pending, A=Assumed Friend)
// Position 4: Symbol Set (varies by context)
// Position 5-6: Entity/Type (specific entity)
// Position 7-8: Entity Subtype
// Position 9: Symbol Modifier
// Position 10-11: Country Code
// Position 12-14: Echelon
// Position 15: Higher Echelon (optional)

export interface SidcParts {
  standardId: string; // Position 1
  context: string; // Position 2
  standardIdentity: string; // Position 3
  symbolSet: string; // Position 4
  entityType: string; // Position 5-6
  entitySubtype: string; // Position 7-8
  symbolModifier: string; // Position 9
  countryCode: string; // Position 10-11
  echelon: string; // Position 12-14
  higherEchelon: string; // Position 15
}

// ============================================================================
// SIDC Encoder/Decoder
// ============================================================================

export function encodeSidc(parts: Partial<SidcParts>): string {
  const sidc = [
    parts.standardId || 'S',
    parts.context || 'A',
    parts.standardIdentity || 'U',
    parts.symbolSet || 'A',
    parts.entityType || 'AP',
    parts.entitySubtype || 'AA',
    parts.symbolModifier || '-',
    parts.countryCode || '--',
    parts.echelon || '---',
    parts.higherEchelon || '-'
  ].join('');
  return sidc;
}

export function decodeSidc(sidc: string): SidcParts {
  return {
    standardId: sidc[0] || 'S',
    context: sidc[1] || 'A',
    standardIdentity: sidc[2] || 'U',
    symbolSet: sidc[3] || 'A',
    entityType: sidc.substring(4, 6) || 'AP',
    entitySubtype: sidc.substring(6, 8) || 'AA',
    symbolModifier: sidc[8] || '-',
    countryCode: sidc.substring(9, 11) || '--',
    echelon: sidc.substring(11, 14) || '---',
    higherEchelon: sidc[14] || '-'
  };
}

// ============================================================================
// Frame Colors and Shapes
// ============================================================================

export function getFrameColor(standardIdentity: string): string {
  switch (standardIdentity) {
    case 'F': return '#00ff00'; // Friend - Green
    case 'H': return '#ff3333'; // Hostile - Red
    case 'N': return '#00ffff'; // Neutral - Cyan
    case 'U': return '#ffff00'; // Unknown - Yellow
    case 'P': return '#ff9900'; // Pending - Orange
    case 'A': return '#00ff00'; // Assumed Friend - Green
    default: return '#ffff00';
  }
}

export function getFillColor(standardIdentity: string): string {
  switch (standardIdentity) {
    case 'F': return 'rgba(0, 255, 0, 0.1)';
    case 'H': return 'rgba(255, 51, 51, 0.1)';
    case 'N': return 'rgba(0, 255, 255, 0.1)';
    case 'U': return 'rgba(255, 255, 0, 0.1)';
    case 'P': return 'rgba(255, 153, 0, 0.1)';
    case 'A': return 'rgba(0, 255, 0, 0.2)'; // Assumed friend has darker fill
    default: return 'rgba(255, 255, 0, 0.1)';
  }
}

// ============================================================================
// Frame Shape Generator
// ============================================================================

export function getFrameShape(standardIdentity: string, size: number = 32): string {
  const half = size / 2;
  const stroke = 2;
  
  switch (standardIdentity) {
    case 'F':
    case 'A':
      // Square for Friend/Assumed Friend
      return `<rect x="${stroke}" y="${stroke}" width="${size - stroke * 2}" height="${size - stroke * 2}" fill="${getFillColor(standardIdentity)}" stroke="${getFrameColor(standardIdentity)}" stroke-width="${stroke}" />`;
    
    case 'H':
    case 'P':
      // Diamond for Hostile/Pending
      return `<polygon points="${half},${stroke} ${size - stroke},${half} ${half},${size - stroke} ${stroke},${half}" fill="${getFillColor(standardIdentity)}" stroke="${getFrameColor(standardIdentity)}" stroke-width="${stroke}" />`;
    
    case 'N':
      // Circle for Neutral
      return `<circle cx="${half}" cy="${half}" r="${half - stroke}" fill="${getFillColor(standardIdentity)}" stroke="${getFrameColor(standardIdentity)}" stroke-width="${stroke}" />`;
    
    case 'U':
    default:
      // Square for Unknown
      return `<rect x="${stroke}" y="${stroke}" width="${size - stroke * 2}" height="${size - stroke * 2}" fill="${getFillColor(standardIdentity)}" stroke="${getFrameColor(standardIdentity)}" stroke-width="${stroke}" />`;
  }
}

// ============================================================================
// Echelon Indicators
// ============================================================================

export function getEchelonIndicator(echelon?: string): string {
  if (!echelon) return '';
  
  const indicators: Record<string, string> = {
    'team': '<circle cx="-12" cy="-12" r="2" fill="currentColor" />',
    'squad': '<circle cx="-12" cy="-12" r="2" fill="currentColor" /><circle cx="-8" cy="-12" r="2" fill="currentColor" />',
    'section': '<circle cx="-12" cy="-12" r="2" fill="currentColor" /><circle cx="-8" cy="-12" r="2" fill="currentColor" /><circle cx="-4" cy="-12" r="2" fill="currentColor" />',
    'platoon': '<line x1="-14" y1="-12" x2="-4" y2="-12" stroke="currentColor" stroke-width="2" />',
    'company': '<line x1="-14" y1="-14" x2="-4" y2="-14" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-10" x2="-4" y2="-10" stroke="currentColor" stroke-width="2" />',
    'battalion': '<line x1="-14" y1="-16" x2="-4" y2="-16" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-12" x2="-4" y2="-12" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-8" x2="-4" y2="-8" stroke="currentColor" stroke-width="2" />',
    'regiment': '<line x1="-14" y1="-18" x2="-4" y2="-18" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-14" x2="-4" y2="-14" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-10" x2="-4" y2="-10" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-6" x2="-4" y2="-6" stroke="currentColor" stroke-width="2" />',
    'brigade': '<line x1="-14" y1="-20" x2="-4" y2="-20" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-16" x2="-4" y2="-16" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-12" x2="-4" y2="-12" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-8" x2="-4" y2="-8" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-4" x2="-4" y2="-4" stroke="currentColor" stroke-width="2" />',
    'division': '<line x1="-14" y1="-22" x2="-4" y2="-22" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-18" x2="-4" y2="-18" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-14" x2="-4" y2="-14" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-10" x2="-4" y2="-10" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-6" x2="-4" y2="-6" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-2" x2="-4" y2="-2" stroke="currentColor" stroke-width="2" />',
    'corps': '<line x1="-14" y1="-24" x2="-4" y2="-24" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-20" x2="-4" y2="-20" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-16" x2="-4" y2="-16" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-12" x2="-4" y2="-12" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-8" x2="-4" y2="-8" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-4" x2="-4" y2="-4" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="0" x2="-4" y2="0" stroke="currentColor" stroke-width="2" />',
    'army': '<line x1="-14" y1="-26" x2="-4" y2="-26" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-22" x2="-4" y2="-22" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-18" x2="-4" y2="-18" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-14" x2="-4" y2="-14" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-10" x2="-4" y2="-10" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-6" x2="-4" y2="-6" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="-2" x2="-4" y2="-2" stroke="currentColor" stroke-width="2" /><line x1="-14" y1="2" x2="-4" y2="2" stroke="currentColor" stroke-width="2" />'
  };
  
  return indicators[echelon] || '';
}

// ============================================================================
// Status Modifiers
// ============================================================================

export function getStatusModifier(status?: string): string {
  if (!status || status === 'present') return '';
  
  switch (status) {
    case 'anticipated':
      return '<text x="0" y="-14" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">ANT</text>';
    case 'planned':
      return '<text x="0" y="-14" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">PLN</text>';
    default:
      return '';
  }
}

// ============================================================================
// HQ Indicator
// ============================================================================

export function getHqIndicator(isHq?: boolean): string {
  if (!isHq) return '';
  return '<text x="0" y="14" text-anchor="middle" font-size="10" fill="currentColor" font-weight="bold">HQ</text>';
}

// ============================================================================
// Task Force Indicator
// ============================================================================

export function getTaskForceIndicator(isTaskForce?: boolean): string {
  if (!isTaskForce) return '';
  return '<text x="12" y="-12" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">TF</text>';
}

// ============================================================================
// Feint/Dummy Indicator
// ============================================================================

export function getFeintDummyIndicator(isFeintDummy?: boolean): string {
  if (!isFeintDummy) return '';
  return '<text x="12" y="14" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">FD</text>';
}

// ============================================================================
// Entity Icons
// ============================================================================

export function getEntityIcon(category: string, entityType?: string): string {
  switch (category) {
    case 'air':
      return getAircraftIcon(entityType);
    case 'sea':
      return getSeaIcon(entityType);
    case 'ground':
      return getGroundIcon(entityType);
    case 'infrastructure':
      return getInfrastructureIcon(entityType);
    default:
      return getAircraftIcon(entityType);
  }
}

function getAircraftIcon(entityType?: string): string {
  // Different aircraft types
  switch (entityType) {
    case 'fighter':
      return '<path d="M-8,-2 L-3,-2 L0,-8 L3,-2 L8,-2 L8,2 L3,2 L0,8 L-3,2 L-8,2 Z" />';
    case 'bomber':
      return '<path d="M-10,-2 L-4,-2 L0,-10 L4,-2 L10,-2 L10,2 L4,2 L0,10 L-4,2 L-10,2 Z" />';
    case 'helicopter':
      return '<path d="M-6,-4 L6,-4 L6,4 L-6,4 Z M-8,-2 L8,-2 M0,-6 L0,-8" />';
    case 'transport':
      return '<path d="M-10,-3 L-5,-3 L0,-6 L5,-3 L10,-3 L10,3 L5,3 L0,6 L-5,3 L-10,3 Z" />';
    case 'uav':
      return '<path d="M-6,-2 L-2,-2 L0,-6 L2,-2 L6,-2 L6,2 L2,2 L0,6 L-2,2 L-6,2 Z M0,-8 L0,8" />';
    default:
      return '<path d="M-8,-2 L-3,-2 L0,-8 L3,-2 L8,-2 L8,2 L3,2 L0,8 L-3,2 L-8,2 Z" />';
  }
}

function getSeaIcon(entityType?: string): string {
  switch (entityType) {
    case 'surface':
      return '<path d="M-10,-4 L10,-4 L8,6 L-8,6 Z" />';
    case 'submarine':
      return '<path d="M-10,-2 L10,-2 L8,4 L-8,4 Z M0,-4 L0,6" />';
    case 'carrier':
      return '<path d="M-12,-6 L12,-6 L10,6 L-10,6 Z M-4,-6 L-4,6 M4,-6 L4,6" />';
    case 'patrol':
      return '<path d="M-8,-3 L8,-3 L6,4 L-6,4 Z" />';
    default:
      return '<path d="M-10,-4 L10,-4 L8,6 L-8,6 Z" />';
  }
}

function getGroundIcon(entityType?: string): string {
  switch (entityType) {
    case 'infantry':
      return '<circle cx="0" cy="0" r="6" /><circle cx="0" cy="-8" r="3" />';
    case 'armor':
      return '<rect x="-8" y="-6" width="16" height="12" /><rect x="-4" y="-8" width="8" height="4" />';
    case 'artillery':
      return '<rect x="-6" y="-6" width="12" height="12" /><line x1="0" y1="-6" x2="0" y2="-12" /><circle cx="0" cy="-14" r="2" />';
    case 'recon':
      return '<polygon points="0,-8 6,6 -6,6" />';
    case 'engineering':
      return '<rect x="-8" y="-6" width="16" height="12" /><path d="M-4,-6 L0,0 L4,-6" />';
    default:
      return '<rect x="-7" y="-7" width="14" height="14" />';
  }
}

function getInfrastructureIcon(entityType?: string): string {
  switch (entityType) {
    case 'airfield':
      return '<rect x="-8" y="-2" width="16" height="4" /><circle cx="0" cy="-6" r="3" />';
    case 'port':
      return '<rect x="-8" y="-4" width="16" height="8" /><path d="M-8,4 L8,4 L8,8 L-8,8 Z" />';
    case 'radar':
      return '<line x1="-8" y1="0" x2="8" y2="0" /><line x1="0" y1="-8" x2="0" y2="8" /><circle cx="0" cy="0" r="4" fill="none" />';
    case 'command':
      return '<rect x="-8" y="-8" width="16" height="16" /><rect x="-4" y="-4" width="8" height="8" />';
    default:
      return '<rect x="-8" y="-8" width="16" height="16" />';
  }
}

// ============================================================================
// Direction Arrow
// ============================================================================

export function getDirectionArrow(heading: number, size: number = 32): string {
  const half = size / 2;
  const arrowLength = half + 4;
  const angle = (heading - 90) * (Math.PI / 180); // Convert heading to radians (0° = North)
  
  const x1 = half + Math.cos(angle) * arrowLength;
  const y1 = half + Math.sin(angle) * arrowLength;
  const x2 = half + Math.cos(angle + Math.PI * 0.85) * 4;
  const y2 = half + Math.sin(angle + Math.PI * 0.85) * 4;
  const x3 = half + Math.cos(angle - Math.PI * 0.85) * 4;
  const y3 = half + Math.sin(angle - Math.PI * 0.85) * 4;
  
  return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${getFrameColor('F')}" stroke="#000" stroke-width="1" />`;
}

// ============================================================================
// Main Symbol Generator
// ============================================================================

export function getMilStd2525DIcon(asset: Asset, size: number = 32): L.DivIcon {
  const milStd = asset.milStd2525D;
  const sidc = milStd?.sidc;
  const parts = sidc ? decodeSidc(sidc) : null;
  
  // Determine standard identity
  const standardIdentity = parts?.standardIdentity || 
    (asset.type === 'friendly' ? 'F' : 
     asset.type === 'hostile' ? 'H' : 
     asset.type === 'neutral' ? 'N' : 
     asset.type === 'pending' ? 'P' : 
     asset.type === 'assumed_friend' ? 'A' : 'U');
  
  const frameColor = getFrameColor(standardIdentity);
  const category = milStd?.symbolSet || asset.category;
  const entityType = milStd?.entityType || asset.metadata?.aircraftType;
  
  // Build SVG
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible">
      <g color="${frameColor}">
        ${getFrameShape(standardIdentity, size)}
        <g transform="translate(${size / 2}, ${size / 2})" fill="${frameColor}" stroke="${frameColor}" stroke-width="1">
          ${getEntityIcon(category, entityType)}
        </g>
        ${getEchelonIndicator(milStd?.echelon)}
        ${getStatusModifier(milStd?.status)}
        ${getHqIndicator(milStd?.headquarters)}
        ${getTaskForceIndicator(milStd?.taskForce)}
        ${getFeintDummyIndicator(milStd?.feintDummy)}
        ${getDirectionArrow(asset.heading, size)}
      </g>
    </svg>
  `;
  
  return L.divIcon({
    className: 'milstd2525-symbol',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

// ============================================================================
// Helper: Generate SIDC from Asset
// ============================================================================

export function generateSidcFromAsset(asset: Asset): string {
  const milStd = asset.milStd2525D || {};
  
  // Context based on category
  const contextMap: Record<string, string> = {
    'air': 'A',
    'ground': 'G',
    'sea': 'S',
    'infrastructure': 'I'
  };
  
  // Standard identity based on type
  const identityMap: Record<string, string> = {
    'friendly': 'F',
    'hostile': 'H',
    'neutral': 'N',
    'unknown': 'U',
    'pending': 'P',
    'assumed_friend': 'A'
  };
  
  // Echelon mapping
  const echelonMap: Record<string, string> = {
    'team': '---',
    'squad': '--',
    'section': '-',
    'platoon': 'P',
    'company': 'C',
    'battalion': 'B',
    'regiment': 'R',
    'brigade': 'G',
    'division': 'D',
    'corps': 'X',
    'army': 'A'
  };
  
  const parts: SidcParts = {
    standardId: 'S',
    context: contextMap[asset.category] || 'A',
    standardIdentity: identityMap[asset.type] || 'U',
    symbolSet: milStd.symbolSet ? milStd.symbolSet[0].toUpperCase() : 'A',
    entityType: milStd.entityType?.substring(0, 2) || 'AP',
    entitySubtype: milStd.entityType?.substring(2, 4) || 'AA',
    symbolModifier: milStd.status === 'anticipated' ? 'A' : milStd.status === 'planned' ? 'P' : '-',
    countryCode: milStd.countryCode || '--',
    echelon: echelonMap[milStd.echelon || ''] || '---',
    higherEchelon: '-'
  };
  
  return encodeSidc(parts);
}
