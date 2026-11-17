import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HistoricoArea } from '@/components/HistoricoArea';
import { getAreasByKind, loadAreaHistory } from '@/lib/historico';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ comunidad: string }>;
}

export function generateStaticParams() {
  return getAreasByKind('comunidad').map((area) => ({ comunidad: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { comunidad } = await params;
  return buildHistoricoMetadata('comunidad', comunidad);
}

export default async function HistoricoComunidadPage({ params }: PageProps) {
  const { comunidad } = await params;
  const areaFile = loadAreaHistory('comunidad', comunidad);
  if (!areaFile) notFound();

  return <HistoricoArea areaFile={areaFile} spain={loadAreaHistory('espana', 'espana')?.area ?? null} />;
}
