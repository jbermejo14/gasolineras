import { NextResponse } from 'next/server';
import { getMitecoData } from '@/lib/miteco';

export async function GET() {
  try {
    const data = await getMitecoData();
    return NextResponse.json({
      success: true,
      fechaMiteco: data.fechaMiteco,
      totalEstaciones: data.estaciones.length,
      totalProvincias: data.provinciasMap.size,
      totalMunicipios: data.municipiosMap.size,
      timestamp: data.timestampFetch,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Error al consultar estado', details: err?.message },
      { status: 500 }
    );
  }
}
