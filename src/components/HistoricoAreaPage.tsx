import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HistoricoArea } from '@/components/HistoricoArea';
import { getAreasByKind, loadAreaHistory } from '@/lib/historico';
import type { AreaKind } from '@/lib/historicoFormat';

const HISTORICO_PAGE_SPAIN_SLUG = 'espana';
const HISTORICO_PAGE_EMPTY_CLASS =
  'rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md space-y-3';

/** Parámetros estáticos de una ruta dinámica de histórico: un objeto `{ [paramName]: slug }` por área del índice. */
export function getHistoricoStaticParams<K extends string>(kind: AreaKind, paramName: K): Record<K, string>[] {
  return getAreasByKind(kind).map((area) => ({ [paramName]: area.slug }) as Record<K, string>);
}

function HistoricoAreaPageEmpty() {
  return (
    <div className={HISTORICO_PAGE_EMPTY_CLASS}>
      <h1 className="text-xl md:text-3xl font-extrabold text-[var(--text-main)]">Histórico de precios</h1>
      <p className="text-sm md:text-base text-[var(--text-muted)]">El histórico todavía no se ha generado.</p>
      <Link href="/" className="inline-flex items-center min-h-10 text-sm font-bold text-[var(--orange-primary)]">
        Volver al inicio
      </Link>
    </div>
  );
}

/** Página de histórico de un área: 404 si no existe (salvo España, que muestra el aviso de datos sin generar). */
export function renderHistoricoAreaPage(kind: AreaKind, slug: string) {
  const areaFile = loadAreaHistory(kind, slug);
  if (!areaFile) {
    if (kind === 'espana') return <HistoricoAreaPageEmpty />;
    notFound();
  }
  const spain = kind === 'espana' ? areaFile.area : (loadAreaHistory('espana', HISTORICO_PAGE_SPAIN_SLUG)?.area ?? null);
  return <HistoricoArea areaFile={areaFile} spain={spain} />;
}
