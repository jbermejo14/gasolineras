import React from 'react';
import { getRedLinks } from '@/lib/red';

const RED_LINKS_TITLE = 'En Ododex también';

interface RedLinksProps {
  /** Clave de la página en el fichero de red (ruta desde la raíz del dominio, sin barra final). */
  pageKey: string;
}

/**
 * Enlaces a las páginas equivalentes de otras secciones de Ododex. No pinta nada si no hay enlaces.
 * Los href son de otra sección: se usan tal cual, sin InternalLink ni ruta base.
 */
export function RedLinks({ pageKey }: RedLinksProps) {
  const links = getRedLinks(pageKey);
  if (links.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-extrabold text-[var(--text-main)]">{RED_LINKS_TITLE}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center min-h-10 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)]"
          >
            {link.texto}
          </a>
        ))}
      </div>
    </div>
  );
}
