import type { Metadata } from 'next';
import Link from 'next/link';
import { HistoricoArea } from '@/components/HistoricoArea';
import { loadAreaHistory } from '@/lib/historico';
import { buildHistoricoMetadata } from '@/lib/historicoPageMeta';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return buildHistoricoMetadata('espana', 'espana');
}

export default function HistoricoPage() {
  const spain = loadAreaHistory('espana', 'espana');

  if (!spain) {
    return (
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md space-y-3">
        <h1 className="text-xl md:text-3xl font-extrabold text-[var(--text-main)]">Histórico de precios</h1>
        <p className="text-sm md:text-base text-[var(--text-muted)]">El histórico todavía no se ha generado.</p>
        <Link href="/" className="inline-flex items-center min-h-10 text-sm font-bold text-[var(--orange-primary)]">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <HistoricoArea areaFile={spain} spain={spain.area} />;
}
