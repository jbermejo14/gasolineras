import { FuelType } from '@/lib/miteco';
import { StationCard } from '@/components/StationCard';
import type { GasFinderStation } from '@/components/GasFinderLogic';

const PANEL = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]';
const PRIMARY_BUTTON =
  'min-h-10 px-4 py-2 rounded-lg bg-[var(--orange-primary)] text-black text-xs font-bold hover:bg-[var(--orange-hover)] transition-colors';

/** Esqueleto con alto parecido al de la lista mientras se descargan las estaciones. */
export function GasFinderLoading() {
  return (
    <div
      className={`${PANEL} min-h-[450px] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse`}
    >
      Cargando gasolineras…
    </div>
  );
}

export function GasFinderError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className={`${PANEL} p-8 md:p-12 text-center space-y-3`}>
      <span className="text-4xl block">⚠️</span>
      <h3 className="font-bold text-base text-[var(--text-main)]">No se pudieron cargar las gasolineras</h3>
      <p className="text-xs text-[var(--text-muted)] break-words">{message}</p>
      <button onClick={onRetry} className={PRIMARY_BUTTON}>
        Reintentar
      </button>
    </div>
  );
}

export function GasFinderEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className={`${PANEL} p-8 md:p-12 text-center space-y-3`}>
      <span className="text-4xl block">⛽</span>
      <h3 className="font-bold text-base text-[var(--text-main)]">
        No se encontraron gasolineras con los filtros actuales
      </h3>
      <p className="text-xs text-[var(--text-muted)]">
        Prueba a restablecer el buscador, cambiar la provincia o ampliar el radio de búsqueda.
      </p>
      <button onClick={onReset} className={PRIMARY_BUTTON}>
        Restablecer filtros
      </button>
    </div>
  );
}

interface GasFinderListProps {
  stations: GasFinderStation[];
  totalCount: number;
  fuel: FuelType;
  cheapestPrice: number | null;
  onLoadMore: () => void;
}

export function GasFinderList({ stations, totalCount, fuel, cheapestPrice, onLoadMore }: GasFinderListProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((s) => (
          <StationCard
            key={s.id}
            station={s}
            selectedFuel={fuel}
            isCheapest={cheapestPrice !== null && s.precios[fuel] === cheapestPrice}
          />
        ))}
      </div>

      {stations.length < totalCount && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            className="min-h-11 px-6 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--orange-border)] text-xs font-bold text-[var(--orange-primary)] hover:bg-[var(--orange-primary)] hover:text-black transition-all shadow-sm"
          >
            Cargar más gasolineras ({totalCount - stations.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
