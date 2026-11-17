export const HISTORY_FUELS = ['gasolina95', 'diesel', 'gasolina98', 'dieselPremium'] as const;
export type HistoryFuel = (typeof HISTORY_FUELS)[number];
export const HISTORY_START_DATE = '2016-01-04';
export type PriceMilli = number;
export type FuelSeries = (PriceMilli | null)[];

/** Registro de una gasolinera en una semana (caché local del script). */
export interface WeekStationRecord {
  id: string;
  idProvincia: string;
  idCCAA: string;
  rotulo: string;
  prices: Record<HistoryFuel, PriceMilli | null>;
}
export interface WeekSnapshot {
  date: string;
  stations: WeekStationRecord[];
}

export type AreaKind = 'espana' | 'comunidad' | 'provincia' | 'marca';
export interface AreaFuelSeries {
  avg: FuelSeries;
  min: FuelSeries;
  count: number[];
}
export interface AreaHistory {
  kind: AreaKind;
  slug: string;
  name: string;
  parentSlug?: string;
  series: Record<HistoryFuel, AreaFuelSeries>;
}
export interface AreaIndexEntry {
  kind: AreaKind;
  slug: string;
  name: string;
  parentSlug?: string;
}
export interface HistoryIndexFile {
  version: 1;
  generatedAt: string;
  weeks: string[];
  areas: AreaIndexEntry[];
}
export interface AreaHistoryFile {
  version: 1;
  weeks: string[];
  area: AreaHistory;
}

/** Partición del histórico por gasolinera: una provincia y un año. Series en delta. */
export interface StationPartitionFile {
  version: 1;
  idProvincia: string;
  year: number;
  weeks: string[];
  stations: Record<string, Partial<Record<HistoryFuel, (number | null)[]>>>;
}

const MILLIS_PER_EURO = 1000;
const MONDAY_WEEKDAY = 1;
const DAYS_PER_WEEK = 7;
const MILLIS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function priceToMilli(price: number): PriceMilli {
  return Math.round(price * MILLIS_PER_EURO);
}

export function milliToPrice(value: PriceMilli): number {
  return value / MILLIS_PER_EURO;
}

function historicoParseIso(iso: string): RegExpExecArray {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new RangeError(`Fecha no válida "${iso}": se esperaba el formato yyyy-mm-dd.`);
  }
  return match;
}

function historicoUtcMillisToIso(millis: number): string {
  return new Date(millis).toISOString().slice(0, ISO_DATE_LENGTH);
}

function historicoIsoToUtcMillis(iso: string): number {
  const match = historicoParseIso(iso);
  const millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Date.UTC desborda las fechas imposibles (31 de febrero): se detectan al reformatear.
  if (historicoUtcMillisToIso(millis) !== iso) {
    throw new RangeError(`Fecha no válida "${iso}": no existe en el calendario.`);
  }
  return millis;
}

/**
 * Lunes desde fromIso (debe ser lunes; si no, RangeError) hasta el último
 * lunes <= toDate. Las fechas se tratan en UTC.
 */
export function listMondays(fromIso: string, toDate: Date): string[] {
  const start = historicoIsoToUtcMillis(fromIso);
  if (Number.isNaN(toDate.getTime())) {
    throw new RangeError('La fecha final no es válida (Invalid Date).');
  }
  if (new Date(start).getUTCDay() !== MONDAY_WEEKDAY) {
    throw new RangeError(`La fecha inicial ${fromIso} no es lunes.`);
  }
  const end = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate());
  const mondays: string[] = [];
  for (let day = start; day <= end; day += DAYS_PER_WEEK * MILLIS_PER_DAY) {
    mondays.push(historicoUtcMillisToIso(day));
  }
  return mondays;
}

/** '2016-01-04' → '04-01-2016' (formato del endpoint de MITECO). */
export function isoToMitecoDate(iso: string): string {
  historicoIsoToUtcMillis(iso);
  const match = historicoParseIso(iso);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function yearOfIso(iso: string): number {
  historicoIsoToUtcMillis(iso);
  return Number(historicoParseIso(iso)[1]);
}

/** Codifica una serie en delta: absoluto al inicio o tras un null, diferencia en el resto. */
export function encodeDeltaSeries(values: FuelSeries): (number | null)[] {
  return values.map((value, index) => {
    if (value === null) return null;
    const previous = index === 0 ? null : values[index - 1];
    return previous === null ? value : value - previous;
  });
}

/** Inversa exacta de encodeDeltaSeries. */
export function decodeDeltaSeries(encoded: readonly (number | null)[]): FuelSeries {
  const decoded: FuelSeries = [];
  encoded.forEach((delta, index) => {
    if (delta === null) {
      decoded.push(null);
      return;
    }
    const previous = index === 0 ? null : decoded[index - 1];
    decoded.push(previous === null ? delta : previous + delta);
  });
  return decoded;
}

function historicoStationYearSeries(
  file: StationPartitionFile,
  stationId: string,
  fuel: HistoryFuel
): FuelSeries {
  const encoded = file.stations[stationId]?.[fuel];
  if (!encoded) return file.weeks.map(() => null);
  const decoded = decodeDeltaSeries(encoded);
  if (decoded.length !== file.weeks.length) {
    throw new RangeError(
      `Serie de longitud ${decoded.length} en la gasolinera ${stationId}, año ${file.year}, carburante ${fuel}: se esperaban ${file.weeks.length} semanas.`
    );
  }
  return decoded;
}

/**
 * Une las particiones de varios años de una gasolinera en una serie continua.
 * Ordena por año; si la gasolinera falta en un año o el carburante se omitió,
 * esas semanas quedan en null.
 */
export function mergeStationPartitions(
  files: readonly StationPartitionFile[],
  stationId: string
): { weeks: string[]; series: Record<HistoryFuel, FuelSeries> } {
  const sorted = [...files].sort((a, b) => a.year - b.year);
  const weeks = sorted.flatMap((file) => file.weeks);
  const series = {} as Record<HistoryFuel, FuelSeries>;
  for (const fuel of HISTORY_FUELS) {
    series[fuel] = sorted.flatMap((file) => historicoStationYearSeries(file, stationId, fuel));
  }
  return { weeks, series };
}
