import type { Metadata } from 'next';
import { getHistoricoStaticParams, renderHistoricoAreaPage } from '@/components/HistoricoAreaPage';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ provincia: string }>;
}

export function generateStaticParams() {
  return getHistoricoStaticParams('provincia', 'provincia');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provincia } = await params;
  return buildHistoricoMetadata('provincia', provincia);
}

export default async function HistoricoProvinciaPage({ params }: PageProps) {
  const { provincia } = await params;
  return renderHistoricoAreaPage('provincia', provincia);
}
