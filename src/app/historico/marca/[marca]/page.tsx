import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HistoricoArea } from '@/components/HistoricoArea';
import { getAreasByKind, loadAreaHistory } from '@/lib/historico';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ marca: string }>;
}

export function generateStaticParams() {
  return getAreasByKind('marca').map((area) => ({ marca: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marca } = await params;
  return buildHistoricoMetadata('marca', marca);
}

export default async function HistoricoMarcaPage({ params }: PageProps) {
  const { marca } = await params;
  const areaFile = loadAreaHistory('marca', marca);
  if (!areaFile) notFound();

  return <HistoricoArea areaFile={areaFile} spain={loadAreaHistory('espana', 'espana')?.area ?? null} />;
}
