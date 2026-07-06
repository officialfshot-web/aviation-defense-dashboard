import { Asset, Threat } from '@/types/tactical';

// Generate random assets around a center point
export function generateAssets(count: number, centerLat: number, centerLng: number): Asset[] {
  const assets: Asset[] = [];
  const types: Asset['type'][] = ['friendly', 'hostile', 'unknown', 'neutral'];
  const categories: Asset['category'][] = ['ground', 'air', 'sea', 'infrastructure'];
  const statuses: Asset['status'][] = ['active', 'inactive', 'damaged', 'destroyed'];

  for (let i = 0; i < count; i++) {
    const lat = centerLat + (Math.random() - 0.5) * 0.1;
    const lng = centerLng + (Math.random() - 0.5) * 0.1;
    
    assets.push({
      id: `asset-${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      name: `UNIT-${String(i + 1).padStart(3, '0')}`,
      position: {
        lat,
        lng,
        altitude: Math.random() * 10000,
      },
      heading: Math.random() * 360,
      speed: Math.random() * 100,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      lastUpdate: Date.now(),
    });
  }

  return assets;
}

// Generate random threats
export function generateThreats(count: number, centerLat: number, centerLng: number): Threat[] {
  const threats: Threat[] = [];
  const types: Threat['type'][] = ['missile', 'aircraft', 'vehicle', 'explosive'];
  const severities: Threat['severity'][] = ['low', 'medium', 'high', 'critical'];
  const statuses: Threat['status'][] = ['detected', 'tracking', 'intercepted', 'impacted'];

  for (let i = 0; i < count; i++) {
    const lat = centerLat + (Math.random() - 0.5) * 0.15;
    const lng = centerLng + (Math.random() - 0.5) * 0.15;
    
    threats.push({
      id: `threat-${i}`,
      name: `THREAT-${String(i + 1).padStart(3, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      position: {
        lat,
        lng,
      },
      targetId: Math.random() > 0.5 ? `asset-${Math.floor(Math.random() * 10)}` : undefined,
      estimatedImpact: 50 + Math.random() * 50, // 50-100 impact score
      status: statuses[Math.floor(Math.random() * statuses.length)],
    });
  }

  return threats;
}

// Simulate asset movement
export function updateAssetPositions(assets: Asset[]): Asset[] {
  return assets.map(asset => {
    if (asset.status !== 'active') return asset;

    const speedFactor = asset.speed * 0.00001; // Convert to coordinate movement
    const headingRad = (asset.heading * Math.PI) / 180;
    
    return {
      ...asset,
      position: {
        ...asset.position,
        lat: asset.position.lat + Math.sin(headingRad) * speedFactor,
        lng: asset.position.lng + Math.cos(headingRad) * speedFactor,
      },
      heading: (asset.heading + (Math.random() - 0.5) * 10) % 360,
      lastUpdate: Date.now(),
    };
  });
}

// Simulate threat movement
export function updateThreatPositions(threats: Threat[]): Threat[] {
  return threats.map(threat => {
    if (threat.status === 'intercepted' || threat.status === 'impacted') return threat;

    const speed = 0.00002; // Threats move faster
    const randomAngle = Math.random() * Math.PI * 2;
    
    return {
      ...threat,
      position: {
        lat: threat.position.lat + Math.sin(randomAngle) * speed,
        lng: threat.position.lng + Math.cos(randomAngle) * speed,
      },
      estimatedImpact: threat.estimatedImpact - 1000, // Countdown
    };
  });
}
