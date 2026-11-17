import type { ReactNode } from 'react';
import { Search, MapPin, List, Map as MapIcon, X } from 'lucide-react';
import type { GasFinderSort } from '@/components/GasFinderLogic';

const RADIUS_OPTIONS_KM = [5, 15, 30, 50];
// text-base en móvil evita el zoom automático de iOS; md:text-xs mantiene el diseño de escritorio.
const FIELD =
  'w-full min-h-11 md:min-h-0 py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-base md:text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--orange-primary)] transition-colors';

export type GasFinderView = 'list' | 'map';

interface GasFinderFiltersProps {
  search: string;
  province: string;
  provinces: Array<{ slug: string; name: string }>;
  sortBy: GasFinderSort;
  hasLocation: boolean;
  geoLoading: boolean;
  radius: number;
  view: GasFinderView;
  onSearchChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onSortChange: (value: GasFinderSort) => void;
  onToggleGeo: () => void;
  onRadiusChange: (value: number) => void;
  onViewChange: (value: GasFinderView) => void;
}

function GasFinderViewToggle({ view, onViewChange }: Pick<GasFinderFiltersProps, 'view' | 'onViewChange'>) {
  const option = (value: GasFinderView, label: string, icon: ReactNode) => (
    <button
      onClick={() => onViewChange(value)}
      className={`flex-1 sm:flex-none min-h-10 flex items-center justify-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
        view === value
          ? 'bg-[var(--orange-primary)] text-black shadow-xs'
          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="flex w-full sm:w-auto items-center bg-[var(--bg-input)] border border-[var(--border-color)] p-1 rounded-lg">
      {option('list', 'Lista', <List className="w-3.5 h-3.5" />)}
      {option('map', 'Mapa', <MapIcon className="w-3.5 h-3.5" />)}
    </div>
  );
}

export function GasFinderFilters(props: GasFinderFiltersProps) {
  const { search, province, provinces, sortBy, hasLocation, geoLoading, radius, view } = props;
  const geoLabel = hasLocation ? '📍 Ubicación Activa' : geoLoading ? 'Localizando...' : 'Cerca de mí';

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Buscar por municipio, calle, CP o marca..."
            className={`${FIELD} pl-9 pr-10`}
          />
          {search && (
            <button
              onClick={() => props.onSearchChange('')}
              aria-label="Borrar búsqueda"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select value={province} onChange={(e) => props.onProvinceChange(e.target.value)} className={FIELD}>
          <option value="TODAS">Toda España</option>
          {provinces.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => props.onSortChange(e.target.value as GasFinderSort)}
          className={FIELD}
        >
          <option value="price_asc">Precio: Más baratas</option>
          <option value="price_desc">Precio: Más caras</option>
          {hasLocation && <option value="distance_asc">Distancia: Más cercanas</option>}
          <option value="name_asc">Nombre: A - Z</option>
        </select>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={props.onToggleGeo}
            disabled={geoLoading}
            className={`min-h-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition-all ${
              hasLocation
                ? 'bg-[var(--orange-primary)] text-black border-[var(--orange-primary)]'
                : 'bg-[var(--bg-input)] text-[var(--orange-primary)] border-[var(--orange-border)] hover:bg-[var(--orange-primary)] hover:text-black'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{geoLabel}</span>
          </button>

          {hasLocation && (
            <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-md border border-[var(--border-color)]">
              <span className="text-[11px] text-[var(--text-muted)] px-1">Radio:</span>
              {RADIUS_OPTIONS_KM.map((r) => (
                <button
                  key={r}
                  onClick={() => props.onRadiusChange(r)}
                  className={`min-h-9 px-2.5 rounded text-[11px] font-semibold transition-colors ${
                    radius === r
                      ? 'bg-[var(--orange-primary)] text-black'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {r}km
                </button>
              ))}
            </div>
          )}
        </div>

        <GasFinderViewToggle view={view} onViewChange={props.onViewChange} />
      </div>
    </div>
  );
}
