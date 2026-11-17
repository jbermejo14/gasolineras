'use client';

import React from 'react';
import { MAP_LAYER_OPTIONS, type MapLayerType } from './leafletMapTiles';

interface LeafletMapToolbarProps {
  stationCount: number;
  mapTheme: MapLayerType;
  onThemeChange: (layer: MapLayerType) => void;
  onFocusPeninsula: () => void;
  onFocusCanarias: () => void;
}

const REGION_BUTTON_CLASS =
  'min-h-9 px-3 sm:min-h-0 sm:px-2.5 sm:py-1 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors';

/** Barra superior del mapa: contador, regiones y selector de capa (select en móvil, botones desde 640 px). */
export function LeafletMapToolbar({
  stationCount,
  mapTheme,
  onThemeChange,
  onFocusPeninsula,
  onFocusCanarias,
}: LeafletMapToolbarProps) {
  return (
    <div className="z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[var(--bg-header)] border-b border-[var(--border-color)] text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-2 py-0.5 rounded font-extrabold bg-[var(--orange-primary)] text-black text-[10px] tracking-wider uppercase">
          MAPA
        </span>
        <span className="font-semibold text-[var(--text-muted)] truncate">
          {stationCount.toLocaleString('es-ES')} gasolinera{stationCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <button type="button" onClick={onFocusPeninsula} className={REGION_BUTTON_CLASS}>
          Península
        </button>
        <button type="button" onClick={onFocusCanarias} className={REGION_BUTTON_CLASS}>
          Canarias
        </button>

        <select
          aria-label="Capa del mapa"
          value={mapTheme}
          onChange={(event) => onThemeChange(event.target.value as MapLayerType)}
          className="sm:hidden min-h-9 px-2 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] text-base sm:text-xs"
        >
          {MAP_LAYER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="hidden sm:flex items-center bg-[var(--bg-input)] rounded border border-[var(--border-color)] p-0.5">
          {MAP_LAYER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onThemeChange(option.value)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mapTheme === option.value
                  ? 'bg-[var(--orange-primary)] text-black'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
