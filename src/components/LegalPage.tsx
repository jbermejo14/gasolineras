import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FECHA_TEXTOS_LEGALES } from '@/lib/legal';

interface LegalPageProps {
  title: string;
  /** Ruta de la página, para la última migaja. */
  path: string;
  /** Etiqueta de la migaja; por defecto, el título. */
  breadcrumbLabel?: string;
  children: ReactNode;
}

// Estilos de los elementos del texto legal aplicados desde la tarjeta, para que las
// páginas escriban HTML plano sin repetir clases.
const LEGAL_TEXT_CLASSES = [
  '[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2:first-child]:mt-0',
  '[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-[var(--text-muted)] [&_p]:mb-3',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:text-sm [&_ul]:leading-relaxed [&_ul]:text-[var(--text-muted)]',
  '[&_a]:text-[var(--orange-primary)] [&_a]:underline [&_a:hover]:text-[var(--orange-hover)]',
  '[&_code]:rounded [&_code]:bg-[var(--bg-main)] [&_code]:px-1 [&_code]:text-xs',
  'break-words'
].join(' ');

const CARD_CLASSES =
  'rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 md:p-8';

/** Maqueta común de las páginas legales: migas, título, tarjeta con el texto y fecha de revisión. */
export function LegalPage({ title, path, breadcrumbLabel, children }: LegalPageProps) {
  return (
    <div className="max-w-3xl mx-auto min-w-0">
      <Breadcrumbs items={[{ label: breadcrumbLabel ?? title, href: path }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-4">{title}</h1>
      <div className={`${CARD_CLASSES} ${LEGAL_TEXT_CLASSES}`}>
        {children}
        <p className="!text-xs !mb-0 mt-6">Última revisión: {FECHA_TEXTOS_LEGALES}</p>
      </div>
    </div>
  );
}
