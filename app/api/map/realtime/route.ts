import { NextResponse } from 'next/server';
import { getMapData } from '@/lib/maps/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getMapData();
    return NextResponse.json({
      success: true,
      customers: data.customers,
      employees: data.employees,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch realtime map data' },
      { status: 500 }
    );
  }
}
