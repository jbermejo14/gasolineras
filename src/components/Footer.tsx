import React from 'react';
import Link from 'next/link';
import { ConsentSettingsButton } from '@/components/ConsentSettingsButton';
import { getAdSenseClient } from '@/lib/adsense';
import { getRedSections } from '@/lib/red';
import { SITE_NAME } from '@/lib/site';

interface FooterProps {
  fechaMiteco?: string;
}

const FOOTER_LINK_CLASS = 'inline-flex items-center min-h-10 hover:text-[var(--orange-primary)] transition-colors';

const FOOTER_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/historico', label: 'Histórico de precios' },
  { href: '/aviso-legal', label: 'Aviso legal' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
];

/** Bloque con las demás webs de la red de Ododex; no pinta nada si no hay red. */
function FooterNetwork() {
  const sections = getRedSections();
  if (sections.length === 0) return null;

  return (
    <nav aria-label="Otras webs de Ododex" className="max-w-7xl mx-auto px-4 mt-4 pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
      <p className="font-semibold text-[var(--text-main)]">Otras webs de Ododex</p>
      <ul className="mt-1 flex flex-wrap gap-x-4">
        {sections.map(section => (
          <li key={section.ruta}>
            <a href={section.ruta} title={section.descripcion} className={FOOTER_LINK_CLASS}>
              {section.nombre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterSeparator() {
  return <span className="text-[var(--border-color)]">&bull;</span>;
}

export function Footer({ fechaMiteco }: FooterProps) {
  const showConsentButton = getAdSenseClient() !== null;

  return (
    <footer className="mt-auto border-t border-[var(--border-color)] bg-[var(--bg-header)] py-6 md:py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs break-words text-[var(--text-muted)]">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-main)]">
            Gasolineras España &bull; Precios de carburantes actualizados cada día
          </p>
          <p className="mt-1">
            Datos: Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO). {SITE_NAME} no está vinculado al Ministerio.
            {fechaMiteco && <span> Última sincronización: <strong>{fechaMiteco}</strong>.</span>}
          </p>
          <p className="mt-1">Los precios pueden no coincidir con los del surtidor.</p>
        </div>

        <div className="flex items-center gap-x-4 flex-wrap">
          {FOOTER_LINKS.map(link => (
            <React.Fragment key={link.href}>
              <Link href={link.href} className={FOOTER_LINK_CLASS}>
                {link.label}
              </Link>
              <FooterSeparator />
            </React.Fragment>
          ))}
          {showConsentButton && (
            <>
              <ConsentSettingsButton />
              <FooterSeparator />
            </>
          )}
        </div>
      </div>
      <FooterNetwork />
    </footer>
  );
}
