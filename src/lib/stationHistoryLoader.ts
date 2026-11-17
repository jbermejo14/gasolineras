import { HISTORY_FUELS, HISTORY_START_DATE, mergeStationPartitions, yearOfIso } from './historicoFormat.ts';
import type { FuelSeries, HistoryFuel, StationPartitionFile } from './historicoFormat.ts';

/** Peticiones simultáneas máximas al cargar particiones. */
export const STATION_HISTORY_MAX_CONCURRENCY = 4;
const STATION_HISTORY_RECENT_YEARS = 2;

/** Devuelve la partición del año, o null si ese año no tiene fichero (404). Lanza ante cualquier otro fallo. */
export type FetchPartition = (year: number) => Promise<StationPartitionFile | null>;

export interface StationHistoryMerged {
  weeks: string[];
  series: Record<HistoryFuel, FuelSeries>;
}

/** Años que se piden al montar: el anterior y el actual. */
export function listRecentYears(currentYear: number): number[] {
  return Array.from({ length: STATION_HISTORY_RECENT_YEARS }, (_, index) => {
    return currentYear - (STATION_HISTORY_RECENT_YEARS - 1) + index;
  });
}

/** Años desde el inicio del histórico hasta el actual que aún no se han pedido, en orden ascendente. */
export function listMissingYears(currentYear: number, requestedYears: readonly number[]): number[] {
  const requested = new Set(requestedYears);
  const missing: number[] = [];
  for (let year = yearOfIso(HISTORY_START_DATE); year <= currentYear; year += 1) {
    if (!requested.has(year)) missing.push(year);
  }
  return missing;
}

/**
 * Pide las particiones de los años dados con como máximo `limit` peticiones a la vez.
 * Los años sin fichero (null) se omiten. Si una petición falla, se propaga el primer error.
 */
export async function loadPartitions(
  years: readonly number[],
  fetchPartition: FetchPartition,
  limit: number = STATION_HISTORY_MAX_CONCURRENCY
): Promise<StationPartitionFile[]> {
  const results: (StationPartitionFile | null)[] = new Array(years.length).fill(null);
  let nextIndex = 0;

  async function stationHistoryWorker(): Promise<void> {
    while (nextIndex < years.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fetchPartition(years[index]);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, years.length));
  await Promise.all(Array.from({ length: workerCount }, () => stationHistoryWorker()));
  return results.filter((file): file is StationPartitionFile => file !== null);
}

/** Une las particiones de la gasolinera en una serie continua ordenada por año. */
export function mergeStationHistory(
  files: readonly StationPartitionFile[],
  stationId: string
): StationHistoryMerged {
  return mergeStationPartitions(files, stationId);
}

/** ¿Hay algún precio en alguno de los carburantes? */
export function hasAnyPrice(merged: StationHistoryMerged): boolean {
  return HISTORY_FUELS.some((fuel) => merged.series[fuel].some((value) => value !== null));
}
