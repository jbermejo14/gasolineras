import type { Metadata } from 'next';
import { getHistoricoStaticParams, renderHistoricoAreaPage } from '@/components/HistoricoAreaPage';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ comunidad: string }>;
}

export function generateStaticParams() {
  return getHistoricoStaticParams('comunidad', 'comunidad');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { comunidad } = await params;
  return buildHistoricoMetadata('comunidad', comunidad);
}

export default async function HistoricoComunidadPage({ params }: PageProps) {
  const { comunidad } = await params;
  return renderHistoricoAreaPage('comunidad', comunidad);
}
