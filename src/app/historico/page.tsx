import type { Metadata } from 'next';
import { renderHistoricoAreaPage } from '@/components/HistoricoAreaPage';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return buildHistoricoMetadata('espana', 'espana');
}

export default function HistoricoPage() {
  return renderHistoricoAreaPage('espana', 'espana');
}
