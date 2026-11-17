import { HISTORY_FUELS } from '@/lib/historicoFormat';
import type { AreaHistory, HistoryFuel } from '@/lib/historicoFormat';
import { formatMilliEuro, summarizeSeries } from '@/lib/historicoStats';
import { FUEL_SHORT_LABELS } from '@/lib/miteco';

interface HistoricoAreaTableProps {
  area: AreaHistory;
  weeks: readonly string[];
}

const HISTORICO_TABLE_EMPTY_CELL = '--';

function historicoTableAveragesByFuel(area: AreaHistory, weeks: readonly string[]): Map<HistoryFuel, Map<number, number>> {
  const byFuel = new Map<HistoryFuel, Map<number, number>>();
  for (const fuel of HISTORY_FUELS) {
    const yearly = summarizeSeries(weeks, area.series[fuel].avg).yearlyAverages;
    if (yearly.length > 0) byFuel.set(fuel, new Map(yearly.map((item) => [item.year, item.avg])));
  }
  return byFuel;
}

/** Tabla año x carburante con el precio medio anual; omite los carburantes sin datos. */
export function HistoricoAreaTable({ area, weeks }: HistoricoAreaTableProps) {
  const byFuel = historicoTableAveragesByFuel(area, weeks);
  const fuels = HISTORY_FUELS.filter((fuel) => byFuel.has(fuel));
  const years = [...new Set(fuels.flatMap((fuel) => [...(byFuel.get(fuel) as Map<number, number>).keys()]))].sort(
    (a, b) => b - a,
  );
  if (years.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Precio medio anual por carburante en {area.name}</caption>
        <thead className="bg-[var(--bg-input)] text-xs text-[var(--text-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-bold">Año</th>
            {fuels.map((fuel) => (
              <th key={fuel} scope="col" className="px-3 py-2 font-bold whitespace-nowrap">{FUEL_SHORT_LABELS[fuel]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year} className="border-t border-[var(--border-color)]">
              <th scope="row" className="px-3 py-2 font-mono font-bold text-[var(--text-main)]">{year}</th>
              {fuels.map((fuel) => {
                const avg = byFuel.get(fuel)?.get(year);
                return (
                  <td key={fuel} className="px-3 py-2 font-mono whitespace-nowrap text-[var(--text-main)]">
                    {avg === undefined ? HISTORICO_TABLE_EMPTY_CELL : formatMilliEuro(avg)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
