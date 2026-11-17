import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HistoricoArea } from '@/components/HistoricoArea';
import { getAreasByKind, loadAreaHistory } from '@/lib/historico';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ provincia: string }>;
}

export function generateStaticParams() {
  return getAreasByKind('provincia').map((area) => ({ provincia: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provincia } = await params;
  return buildHistoricoMetadata('provincia', provincia);
}

export default async function HistoricoProvinciaPage({ params }: PageProps) {
  const { provincia } = await params;
  const areaFile = loadAreaHistory('provincia', provincia);
  if (!areaFile) notFound();

  return <HistoricoArea areaFile={areaFile} spain={loadAreaHistory('espana', 'espana')?.area ?? null} />;
}
