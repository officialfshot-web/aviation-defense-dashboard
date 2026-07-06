import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const acknowledged = searchParams.get('acknowledged');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    const where: any = {};
    if (acknowledged !== null) {
      where.acknowledged = acknowledged === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('GET alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const alerts = Array.isArray(body) ? body : [body];

    const created = await prisma.$transaction(
      alerts.map((alert: any) =>
        prisma.alert.upsert({
          where: { externalId: alert.externalId || alert.id },
          update: {
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date(),
            assetId: alert.assetId,
            threatId: alert.threatId,
            geofenceId: alert.geofenceId,
            metadata: alert.metadata ? JSON.stringify(alert.metadata) : null,
          },
          create: {
            externalId: alert.externalId || alert.id,
            type: alert.type || 'threat',
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date(),
            assetId: alert.assetId,
            threatId: alert.threatId,
            geofenceId: alert.geofenceId,
            metadata: alert.metadata ? JSON.stringify(alert.metadata) : null,
          },
        })
      )
    );

    return NextResponse.json(created);
  } catch (error) {
    console.error('POST alerts error:', error);
    return NextResponse.json({ error: 'Failed to create alerts' }, { status: 500 });
  }
}
