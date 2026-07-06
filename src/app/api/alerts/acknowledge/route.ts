import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const { id, operator } = await request.json();

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedBy: operator || 'operator',
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    return NextResponse.json({ error: 'Failed to acknowledge alert' }, { status: 500 });
  }
}
