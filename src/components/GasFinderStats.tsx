import type { GasFinderStats } from '@/components/GasFinderLogic';

const CARD = 'rounded-xl border bg-[var(--bg-card)] p-3 md:p-3.5 shadow-sm min-w-0';
const LABEL = 'text-[11px] font-bold uppercase tracking-wider block';
const VALUE = 'font-mono text-xl md:text-2xl font-extrabold mt-1 block truncate';
const UNIT = 'text-xs font-normal text-[var(--text-muted)] ml-1';

function GasFinderPrice({ value }: { value: number | null }) {
  return (
    <>
      {value ? value.toFixed(3) : '--'}
      <span className={UNIT}>€/l</span>
    </>
  );
}

export function GasFinderStatsStrip({ stats }: { stats: GasFinderStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Estaciones</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>{stats.total.toLocaleString('es-ES')}</span>
        <span className="text-[10px] text-[var(--text-dim)]">con precios registrados</span>
      </div>
      <div className={`${CARD} border-[var(--orange-primary)]`}>
        <span className={`${LABEL} text-[var(--orange-primary)]`}>Precio Más Barato</span>
        <span className={`${VALUE} text-[var(--orange-primary)]`}>
          <GasFinderPrice value={stats.min} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Mínimo actual</span>
      </div>
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Precio Medio</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>
          <GasFinderPrice value={stats.avg} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Promedio del filtro</span>
      </div>
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Precio Más Alto</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>
          <GasFinderPrice value={stats.max} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Máximo registrado</span>
      </div>
    </div>
  );
}
