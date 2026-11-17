import { NextResponse } from 'next/server';
import { getMitecoData } from '@/lib/miteco';
import { buildEstacionesPayload } from '@/lib/stationPayload';

export const revalidate = 1800;

const CACHE_CONTROL_HEADER = 'public, s-maxage=1800, stale-while-revalidate=600';
const SERVICE_UNAVAILABLE_STATUS = 503;
const MITECO_ERROR_MESSAGE =
  'No se pudieron obtener los precios de MITECO. Inténtalo de nuevo en unos minutos.';

export async function GET() {
  try {
    const snapshot = await getMitecoData();
    return NextResponse.json(buildEstacionesPayload(snapshot), {
      headers: { 'Cache-Control': CACHE_CONTROL_HEADER },
    });
  } catch (err) {
    console.error('[API /estaciones] Fallo al obtener datos de MITECO:', err);
    return NextResponse.json({ error: MITECO_ERROR_MESSAGE }, { status: SERVICE_UNAVAILABLE_STATUS });
  }
}
