import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  try {
    const { count } = await prisma.alert.deleteMany({
      where: { acknowledged: true },
    });

    return NextResponse.json({ cleared: count });
  } catch (error) {
    console.error('Clear alerts error:', error);
    return NextResponse.json({ error: 'Failed to clear acknowledged alerts' }, { status: 500 });
  }
}
