import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 md:p-12 text-center max-w-xl mx-auto my-6 md:my-12 space-y-4 shadow-md">
      <div className="w-16 h-16 rounded-full bg-[var(--orange-subtle)] border border-[var(--orange-border)] flex items-center justify-center mx-auto text-2xl">
        ⛽
      </div>
      <h2 className="text-xl md:text-2xl font-extrabold break-words text-[var(--text-main)]">
        Página o gasolinera no encontrada (404)
      </h2>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
        El enlace que has seguido no corresponde a ninguna provincia, municipio o estación de servicio registrada actualmente en la base de datos oficial de MITECO.
      </p>
      <div className="pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 min-h-11 rounded-xl bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] font-extrabold text-xs hover:bg-[var(--on-accent-hover)] transition-all shadow-md shadow-[var(--orange-glow)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al buscador principal</span>
        </Link>
      </div>
    </div>
  );
}
