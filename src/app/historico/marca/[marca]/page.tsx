import type { Metadata } from 'next';
import { getHistoricoStaticParams, renderHistoricoAreaPage } from '@/components/HistoricoAreaPage';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ marca: string }>;
}

export function generateStaticParams() {
  return getHistoricoStaticParams('marca', 'marca');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marca } = await params;
  return buildHistoricoMetadata('marca', marca);
}

export default async function HistoricoMarcaPage({ params }: PageProps) {
  const { marca } = await params;
  return renderHistoricoAreaPage('marca', marca);
}
