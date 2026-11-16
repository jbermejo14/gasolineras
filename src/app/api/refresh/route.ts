import { NextRequest, NextResponse } from 'next/server';
import { getMitecoData } from '@/lib/miteco';

export async function POST(req: NextRequest) {
  // Requisito 6: Elimina el refresco manual público y quita CORS abierto.
  // Protegido estrictamente con secreto de entorno REFRESH_SECRET.
  const authHeader = req.headers.get('authorization');
  const secretEnv = process.env.REFRESH_SECRET;

  if (!secretEnv) {
    return NextResponse.json(
      { error: 'Refresco manual deshabilitado. REFRESH_SECRET no está configurado en el servidor.' },
      { status: 403 }
    );
  }

  const expectedBearer = `Bearer ${secretEnv}`;
  if (authHeader !== expectedBearer) {
    return NextResponse.json(
      { error: 'No autorizado. Se requiere token Bearer válido en el header Authorization.' },
      { status: 401 }
    );
  }

  try {
    const data = await getMitecoData(true);
    return NextResponse.json({
      success: true,
      message: 'Datos de MITECO revalidados y actualizados con éxito',
      fechaMiteco: data.fechaMiteco,
      totalEstaciones: data.estaciones.length,
      timestamp: data.timestampFetch,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Error al actualizar datos de MITECO', details: err?.message },
      { status: 500 }
    );
  }
}
