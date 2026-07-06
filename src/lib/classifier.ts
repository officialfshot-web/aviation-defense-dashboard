export type AircraftClassification = 'helicopter' | 'military' | 'cargo' | 'commercial' | 'general_aviation' | 'unknown';

const HELICOPTER_TYPES = [
  'AS350', 'EC135', 'H135', 'H145', 'H125', 'B206', 'B407', 'B429', 'S76', 'S92', 'AW139', 'AW119', 'AW109',
  'H60', 'UH60', 'MH60', 'CH47', 'AH64', 'V22', 'UH1', 'H500', 'R22', 'R44', 'R66', 'MD500', 'MD600', 'BK117',
  'BO105', 'SA330', 'AS332', 'EC225', 'H225', 'KA32', 'MI8', 'MI17', 'MI24', 'S61', 'W3', 'AW101', 'NH90',
];

const CARGO_OPERATORS = [
  'ups', 'united parcel service', 'fedex', 'federal express', 'dhl', 'amazon', 'atlas air', 'kalitta', 'polar',
  'cargo', 'freight', 'air cargo', 'express', 'swift', 'martinaire',
];

const MILITARY_OPERATORS = [
  'air force', 'army', 'navy', 'marines', 'coast guard', 'defense', 'national guard', 'usaf', 'usn', 'usmc',
  'us army', 'royal air force', 'raf', 'rcaf', 'rAAF', 'nato', 'united nations', 'department of homeland security',
];

const CARGO_CALLSIGNS = ['UPS', 'FDX', 'DHL', 'AMZN', 'GTI', 'CKS', 'PAC', 'ABX', 'ATL', 'SWQ', 'MRA', 'EAT'];
const MILITARY_CALLSIGNS = ['RCH', 'HOOK', 'CNV', 'BOBBY', 'TREK', 'VALOR', 'RODD', 'PAT', 'KING', 'SAM', 'AMC', 'AF1', 'AF2', 'MARINE', 'NAVY', 'ARMY'];
const COMMERCIAL_CALLSIGNS = ['AAL', 'DAL', 'UAL', 'SWA', 'ASA', 'JBU', 'FFT', 'NKS', 'SKW', 'ENY', 'RPA', 'AWI', 'GJS'];

function normalize(text: string | null | undefined): string {
  return (text || '').toLowerCase().trim();
}

export function classifyAircraftByMetadata(
  type: string | null | undefined,
  operator: string | null | undefined,
  callsign: string | null | undefined
): AircraftClassification {
  const t = normalize(type);
  const op = normalize(operator);
  const cs = (callsign || '').toUpperCase().trim();
  const csPrefix = cs.split(/\d/)[0];

  // Helicopter detection
  if (HELICOPTER_TYPES.some(h => t.includes(h.toLowerCase()))) return 'helicopter';
  if (t.includes('helicopter') || t.includes('rotorcraft')) return 'helicopter';

  // Military detection
  if (MILITARY_OPERATORS.some(m => op.includes(m))) return 'military';
  if (MILITARY_CALLSIGNS.some(m => cs.startsWith(m) || csPrefix === m)) return 'military';
  if (t.includes('f-') || t.includes('c-') || t.includes('kc-') || t.includes('e-') || t.includes('b-') || t.includes('t-')) {
    // Could be military or civil; check operator first
    if (op && MILITARY_OPERATORS.some(m => op.includes(m))) return 'military';
  }
  if (t.includes('f-16') || t.includes('f-18') || t.includes('f-22') || t.includes('f-35') || t.includes('f-15')) return 'military';
  if (t.includes('c-130') || t.includes('c-17') || t.includes('c-5') || t.includes('kc-135')) return 'military';

  // Cargo detection
  if (CARGO_OPERATORS.some(c => op.includes(c))) return 'cargo';
  if (CARGO_CALLSIGNS.some(c => cs.startsWith(c) || csPrefix === c)) return 'cargo';
  if (t.includes('747') && op.includes('cargo')) return 'cargo';
  if (t.includes('md-11') && op.includes('cargo')) return 'cargo';

  // Commercial detection
  if (COMMERCIAL_CALLSIGNS.some(c => cs.startsWith(c) || csPrefix === c)) return 'commercial';
  if (op.includes('airlines') || op.includes('airways') || op.includes('air')) return 'commercial';

  // General aviation / unknown
  if (t.includes('cessna') || t.includes('beechcraft') || t.includes('piper') || t.includes('cirrus') || t.includes('gulfstream')) return 'general_aviation';

  return 'unknown';
}
