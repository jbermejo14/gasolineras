import type { AreaHistory } from '@/lib/historicoFormat';
import { formatIsoDateEs, formatMilliEuro, formatSignedPercent, summarizeSeries } from '@/lib/historicoStats';
import type { DatedValue, SeriesSummary } from '@/lib/historicoStats';
import { FUEL_SHORT_LABELS } from '@/lib/miteco';

interface HistoricoAreaCardsProps {
  area: AreaHistory;
  weeks: readonly string[];
}

const HISTORICO_CARDS_CLASS = 'p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0';
const HISTORICO_CARDS_LABEL_CLASS = 'text-xs text-[var(--text-muted)] font-medium';
const HISTORICO_CARDS_VALUE_CLASS = 'font-mono text-lg md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1';
const HISTORICO_CARDS_NOTE_CLASS = 'text-xs text-[var(--text-dim)] mt-1';

function historicoCardsChangeText(changePct: number | null): string {
  if (changePct === null) return 'Sin dato de hace un año';
  return `${formatSignedPercent(changePct)} en un año`;
}

function historicoCardsExtreme(label: string, extreme: DatedValue | null): string {
  return extreme ? `${label}: ${formatMilliEuro(extreme.value)} (${formatIsoDateEs(extreme.date)})` : `${label}: sin datos`;
}

/** Cuatro tarjetas: precio actual de G95 y diésel, y máximo y mínimo históricos. */
export function HistoricoAreaCards({ area, weeks }: HistoricoAreaCardsProps) {
  const g95 = summarizeSeries(weeks, area.series.gasolina95.avg);
  const diesel = summarizeSeries(weeks, area.series.diesel.avg);
  const current = [
    { label: `${FUEL_SHORT_LABELS.gasolina95} actual`, summary: g95 },
    { label: `${FUEL_SHORT_LABELS.diesel} actual`, summary: diesel },
  ];
  const extremes = [
    { label: 'Máximo histórico', pick: (summary: SeriesSummary) => summary.max },
    { label: 'Mínimo histórico', pick: (summary: SeriesSummary) => summary.min },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {current.map(({ label, summary }) => (
        <div key={label} className={HISTORICO_CARDS_CLASS}>
          <div className={HISTORICO_CARDS_LABEL_CLASS}>{label}</div>
          <div className={HISTORICO_CARDS_VALUE_CLASS}>{summary.latest ? formatMilliEuro(summary.latest.value) : '--'}</div>
          <div className={HISTORICO_CARDS_NOTE_CLASS}>{historicoCardsChangeText(summary.changePct)}</div>
        </div>
      ))}
      {extremes.map(({ label, pick }) => (
        <div key={label} className={HISTORICO_CARDS_CLASS}>
          <div className={HISTORICO_CARDS_LABEL_CLASS}>{label}</div>
          <div className={`${HISTORICO_CARDS_NOTE_CLASS} space-y-1 break-words`}>
            <p>{historicoCardsExtreme(FUEL_SHORT_LABELS.gasolina95, pick(g95))}</p>
            <p>{historicoCardsExtreme(FUEL_SHORT_LABELS.diesel, pick(diesel))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
