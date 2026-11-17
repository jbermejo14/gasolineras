'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, Moon, Fuel, RefreshCw, Layers, Navigation } from 'lucide-react';

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

export function Header({ fechaMiteco }: HeaderProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('gasolineras_theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    if (initial === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('gasolineras_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-header)] border-b-2 border-[var(--orange-primary)] shadow-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-gradient-to-br from-[var(--orange-primary)] to-[var(--orange-dark)] flex items-center justify-center text-black font-extrabold shadow-md">
            <Fuel className="w-6 h-6 text-black" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base sm:text-xl font-extrabold tracking-tight text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors">
              GASOLINERAS <span className="text-[var(--orange-primary)]">ESPAÑA</span>
            </span>
            <p className="text-xs text-[var(--text-muted)] hidden sm:block">
              Precios oficiales del Ministerio para la Transición Ecológica (MITECO)
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
              className="flex items-center justify-center gap-1.5 min-w-10 h-10 px-2.5 sm:px-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--orange-primary)] hover:text-[var(--orange-primary)] transition-all"
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
