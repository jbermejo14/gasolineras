import React from 'react';
import Link from 'next/link';

interface FooterProps {
  fechaMiteco?: string;
}

export function Footer({ fechaMiteco }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[var(--border-color)] bg-[var(--bg-header)] py-6 md:py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs break-words text-[var(--text-muted)]">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-main)]">
            Gasolineras España &bull; Información de carburantes en tiempo real
          </p>
          <p className="mt-1">
            <strong>Fuente oficial:</strong> Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO).
            {fechaMiteco && <span> Última sincronización: <strong>{fechaMiteco}</strong>.</span>}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/" className="inline-flex items-center min-h-10 hover:text-[var(--orange-primary)] transition-colors">
            Inicio
          </Link>
          <span className="text-[var(--border-color)]">&bull;</span>
          <span className="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--orange-border)] text-[var(--orange-primary)] font-bold text-[11px]">
            SEO PROGRAMÁTICO
          </span>
        </div>
      </div>
    </footer>
  );
}
