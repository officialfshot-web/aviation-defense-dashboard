import { Alert } from '@/types/tactical';

// Real backend persistence via Next.js API routes

export interface ApiAlert {
  id: string;
  externalId: string | null;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  assetId: string | null;
  threatId: string | null;
  geofenceId: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

function apiAlertToAlert(a: ApiAlert): Alert {
  return {
    id: a.id,
    type: a.type as Alert['type'],
    severity: a.severity as Alert['severity'],
    message: a.message,
    timestamp: new Date(a.timestamp).getTime(),
    acknowledged: a.acknowledged,
    acknowledgedBy: a.acknowledgedBy || undefined,
    acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt).getTime() : undefined,
  };
}

export async function fetchAlerts(acknowledged?: boolean, limit: number = 100): Promise<Alert[]> {
  try {
    const params = new URLSearchParams();
    if (acknowledged !== undefined) params.set('acknowledged', acknowledged.toString());
    params.set('limit', limit.toString());

    const response = await fetch(`/api/alerts?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    const data: ApiAlert[] = await response.json();
    return data.map(apiAlertToAlert);
  } catch (error) {
    console.error('fetchAlerts error:', error);
    return [];
  }
}

export async function syncAlerts(alerts: Alert[]): Promise<Alert[]> {
  try {
    const payload = alerts.map(a => ({
      id: a.id,
      externalId: `${a.message}-${a.severity}`,
      type: a.type,
      severity: a.severity,
      message: a.message,
      timestamp: a.timestamp,
      acknowledged: a.acknowledged,
      acknowledgedBy: a.acknowledgedBy,
      acknowledgedAt: a.acknowledgedAt,
      assetId: a.relatedAssetId,
      threatId: a.relatedThreatId,
    }));

    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Failed to sync alerts');
    const data: ApiAlert[] = await response.json();
    return data.map(apiAlertToAlert);
  } catch (error) {
    console.error('syncAlerts error:', error);
    return alerts;
  }
}

export async function acknowledgeAlertBackend(alertId: string, operator: string = 'operator'): Promise<void> {
  try {
    const response = await fetch('/api/alerts/acknowledge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alertId, operator }),
    });

    if (!response.ok) throw new Error('Failed to acknowledge alert');
  } catch (error) {
    console.error('acknowledgeAlertBackend error:', error);
  }
}

export async function clearAcknowledgedAlertsBackend(): Promise<void> {
  try {
    const response = await fetch('/api/alerts/clear', { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to clear acknowledged alerts');
  } catch (error) {
    console.error('clearAcknowledgedAlertsBackend error:', error);
  }
}

export function mergeAlerts(incoming: Alert[], existing: Alert[]): Alert[] {
  const existingMap = new Map<string, Alert>();

  for (const alert of existing) {
    const key = `${alert.message}-${alert.severity}`;
    existingMap.set(key, alert);
  }

  const merged: Alert[] = [];
  const seen = new Set<string>();

  for (const alert of incoming) {
    const key = `${alert.message}-${alert.severity}`;
    const existingAlert = existingMap.get(key);

    if (existingAlert?.acknowledged) {
      merged.push({ ...existingAlert, timestamp: alert.timestamp });
    } else {
      merged.push(alert);
    }
    seen.add(key);
  }

  for (const alert of existing) {
    const key = `${alert.message}-${alert.severity}`;
    if (!seen.has(key) && alert.acknowledged) {
      merged.push(alert);
      seen.add(key);
    }
  }

  return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
}

export function playAlertSound(severity: 'critical' | 'warning' | 'info'): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    if (severity === 'critical') {
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(0, ctx.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.25);
      oscillator.frequency.setValueAtTime(0, ctx.currentTime + 0.35);
    } else {
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore audio errors
  }
}

export function exportIncidentReport(alerts: Alert[], assets: any[], threats: any[]): string {
  const timestamp = new Date().toISOString();
  const report = {
    generatedAt: timestamp,
    summary: {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      warningAlerts: alerts.filter(a => a.severity === 'warning').length,
      activeAssets: assets.length,
      activeThreats: threats.length,
    },
    alerts,
    assets,
    threats,
  };

  return JSON.stringify(report, null, 2);
}

export function downloadIncidentReport(reportJson: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([reportJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incident-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
