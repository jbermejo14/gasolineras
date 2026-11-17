import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, FUEL_SHORT_LABELS, FuelType } from '@/lib/miteco';
import type { EstacionLigera } from '@/lib/stationPayload';
import { getStationBrand } from '@/lib/brands';
import { Clock, MapPin, Navigation } from 'lucide-react';

interface StationCardProps {
  station: EstacionLigera;
  selectedFuel: FuelType;
  isCheapest?: boolean;
}

export function StationCard({ station, selectedFuel, isCheapest = false }: StationCardProps) {
  const brand = getStationBrand(station.rotulo);
  const currentPrice = station.precios[selectedFuel];
  const fichaUrl = `/gasolinera/${station.id}-${station.slug}`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;

  // Otros precios secundarios
  const secondaryFuels = (Object.keys(station.precios) as FuelType[])
    .filter((f) => f !== selectedFuel && station.precios[f] !== null)
    .slice(0, 3);

  return (
    <article
      className={`min-w-0 rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all duration-200 bg-[var(--bg-card)] ${
        isCheapest
          ? 'border-[var(--orange-primary)] shadow-md shadow-[var(--orange-glow)]'
          : 'border-[var(--border-color)] hover:border-[var(--orange-border)] hover:bg-[var(--bg-card-hover)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h3 className="min-w-0">
          <Link
            href={fichaUrl}
            className={
              brand
                ? 'inline-flex min-w-0 max-w-full items-center gap-2 bg-white border border-[var(--border-color)] hover:border-[var(--orange-primary)] px-2.5 py-1 rounded-md shadow-xs transition-colors'
                : 'inline-block min-w-0 max-w-full break-words px-2.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--orange-border)] hover:border-[var(--orange-primary)] text-[var(--orange-primary)] text-xs font-bold uppercase tracking-tight transition-colors'
            }
          >
            {brand ? (
              <>
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={40}
                  height={20}
                  className="h-5 w-auto object-contain"
                />
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-tight break-words min-w-0">
                  {station.rotulo}
                </span>
              </>
            ) : (
              station.rotulo
            )}
          </Link>
        </h3>

        {isCheapest && (
          <span className="px-2 py-0.5 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[10px] font-extrabold uppercase">
            Más barata
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)] flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--text-dim)]" />
          <span className="min-w-0 break-words">
            {station.direccion}, {station.municipio} ({station.provincia})
          </span>
        </p>
        <p className="text-[11px] text-[var(--text-dim)] mt-1 flex items-start gap-1">
          <Clock className="w-3 h-3 shrink-0" />
          <span className="min-w-0 break-words">{station.horario}</span>
        </p>
      </div>

      {/* Bloque de precio principal y secundarios */}
      <div className="rounded-lg bg-[var(--bg-pricing-box)] border border-[var(--border-color)] p-3 flex items-center justify-between gap-3">
        <div className="shrink-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
            {FUEL_SHORT_LABELS[selectedFuel]}
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] leading-none">
            {currentPrice !== null ? currentPrice.toFixed(3) : '--'}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">€/l</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-end min-w-0">
          {secondaryFuels.map((f) => (
            <span
              key={f}
              className="text-[10px] px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]"
            >
              {FUEL_SHORT_LABELS[f]}: <strong className="text-[var(--text-main)] font-mono">{formatPrice(station.precios[f])}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link
          href={fichaUrl}
          className="flex-1 min-h-10 flex items-center justify-center text-center py-2 px-3 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors"
        >
          Ver Ficha Completa
        </Link>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-10 min-w-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-xs font-bold hover:bg-[var(--on-accent-hover)] transition-colors"
          title="Cómo llegar en Google Maps"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cómo llegar</span>
        </a>
      </div>
    </article>
  );
}
