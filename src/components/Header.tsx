'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { SITE_NAME, SECTION_NAME } from '@/lib/site';
import { Sun, Moon, RefreshCw, Layers, Navigation } from 'lucide-react';

// Longitud de HH:MM
const HEADER_SHORT_TIME_LENGTH = 5;

interface HeaderProps {
  fechaMiteco?: string;
}

/** Abrevia "17/11/2026 10:04:11" a la hora "10:04" para pantallas estrechas. */
function headerShortDate(fecha: string): string {
  const time = fecha.split(' ')[1];
  return time ? time.slice(0, HEADER_SHORT_TIME_LENGTH) : fecha;
}

const THEME_STORAGE_KEY = 'ododex-theme';

type HeaderTheme = 'dark' | 'light';

/** Aplica el tema a <html>: atributo para el CSS propio y clase para Tailwind. */
function headerApplyTheme(theme: HeaderTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}

/** Tema que ya fijó el script de layout.tsx antes de pintar. */
function headerReadTheme(): HeaderTheme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function Header({ fechaMiteco }: HeaderProps) {
  const [theme, setTheme] = useState<HeaderTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(headerReadTheme());
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: HeaderTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    headerApplyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin localStorage (modo privado, cookies bloqueadas) el tema solo dura la visita.
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-header)] border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 group min-w-0"
          aria-label={`${SITE_NAME} · ${SECTION_NAME}, inicio`}
        >
          <BrandLogo />
          <span aria-hidden="true" className="w-px h-7 sm:h-8 bg-[var(--border-color)] shrink-0" />
          <div className="min-w-0">
            <span className="block sm:hidden text-[11px] leading-tight font-extrabold uppercase text-[var(--text-main)]">
              Gasolineras
              <span className="block text-[var(--orange-primary)]">España</span>
            </span>
            <span className="hidden sm:block truncate text-base font-extrabold uppercase text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors">
              Gasolineras <span className="text-[var(--orange-primary)]">España</span>
            </span>
            <p className="text-xs text-[var(--text-muted)] hidden lg:block">
              Datos oficiales de MITECO
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {fechaMiteco && (
            <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-2.5 sm:px-3 h-10 rounded-full text-xs text-[var(--text-main)] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--orange-primary)] animate-pulse-glow" />
              <span className="hidden md:inline text-[var(--text-muted)]">Actualizado a las:</span>
              <strong className="font-mono text-[var(--orange-primary)]">
                <span className="sm:hidden">{headerShortDate(fechaMiteco)}</span>
                <span className="hidden sm:inline">{fechaMiteco}</span>
              </strong>
            </div>
          )}

          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 min-w-10 h-10 px-2.5 sm:px-3 rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--orange-primary)] transition-colors cursor-pointer select-none"
              title="Cambiar Modo Claro / Oscuro"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-[var(--orange-primary)]" />
                  <span className="hidden sm:inline">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[var(--orange-primary)]" />
                  <span className="hidden sm:inline">Modo Oscuro</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
