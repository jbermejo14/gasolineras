import { BRAND_CONFIG, getStationBrand } from './brands.ts';
import type { BrandInfo } from './brands.ts';
import { COMUNIDADES, findComunidadById } from './ccaa.ts';
import { HISTORY_FUELS, encodeDeltaSeries, priceToMilli, yearOfIso } from './historicoFormat.ts';
import type {
  AreaFuelSeries,
  AreaHistory,
  AreaHistoryFile,
  AreaIndexEntry,
  AreaKind,
  FuelSeries,
  HistoryFuel,
  HistoryIndexFile,
  PriceMilli,
  StationPartitionFile,
  WeekSnapshot,
  WeekStationRecord,
} from './historicoFormat.ts';
import { parseAndValidatePrice, slugify } from './miteco.ts';

/** Campo crudo de MITECO de cada carburante del histórico. */
const HISTORICO_BUILD_RAW_FIELDS: Record<HistoryFuel, string> = {
  gasolina95: 'Precio Gasolina 95 E5',
  diesel: 'Precio Gasoleo A',
  gasolina98: 'Precio Gasolina 98 E5',
  dieselPremium: 'Precio Gasoleo Premium',
};

const HISTORICO_BUILD_SPAIN_SLUG = 'espana';
const HISTORICO_BUILD_SPAIN_NAME = 'España';
const HISTORICO_BUILD_FORMAT_VERSION = 1;
const HISTORICO_BUILD_LOCALE = 'es';
const HISTORICO_BUILD_WORD_START = /(^|[^\p{L}])(\p{L})/gu;

type HistoricoBuildRawRecord = Record<string, unknown>;

export interface ProvinceInfo {
  idProvincia: string;
  name: string;
  slug: string;
  comunidadSlug: string | null;
}

function historicoBuildText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function historicoBuildIsRecord(value: unknown): value is HistoricoBuildRawRecord {
  return typeof value === 'object' && value !== null;
}

function historicoBuildPrice(value: unknown): PriceMilli | null {
  const { price } = parseAndValidatePrice(value);
  return price === null ? null : priceToMilli(price);
}

function historicoBuildStationRecord(item: HistoricoBuildRawRecord): WeekStationRecord | null {
  const id = historicoBuildText(item.IDEESS);
  if (!id) return null;
  const prices = {} as Record<HistoryFuel, PriceMilli | null>;
  for (const fuel of HISTORY_FUELS) {
    prices[fuel] = historicoBuildPrice(item[HISTORICO_BUILD_RAW_FIELDS[fuel]]);
  }
  return {
    id,
    idProvincia: historicoBuildText(item.IDProvincia),
    idCCAA: historicoBuildText(item.IDCCAA),
    rotulo: historicoBuildText(item['Rótulo']),
    prices,
  };
}

/** Reduce la respuesta cruda de MITECO de un día a un WeekSnapshot. Descarta registros sin IDEESS. */
export function buildWeekSnapshot(raw: { ListaEESSPrecio?: unknown[] }, date: string): WeekSnapshot {
  const list = Array.isArray(raw?.ListaEESSPrecio) ? raw.ListaEESSPrecio : [];
  const stations: WeekStationRecord[] = [];
  for (const item of list) {
    if (!historicoBuildIsRecord(item)) continue;
    const record = historicoBuildStationRecord(item);
    if (record) stations.push(record);
  }
  return { date, stations };
}

/** Primera letra de cada palabra en mayúscula y el resto en minúscula. */
function historicoBuildDisplayName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(
      HISTORICO_BUILD_WORD_START,
      (_match: string, separator: string, letter: string) => separator + letter.toUpperCase()
    );
}

/** A partir del listado oficial de provincias (claves IDPovincia/IDCCAA/Provincia). */
export function buildProvinceTable(listing: readonly Record<string, unknown>[]): Map<string, ProvinceInfo> {
  const table = new Map<string, ProvinceInfo>();
  for (const item of listing) {
    const idProvincia = historicoBuildText(item.IDPovincia ?? item.IDProvincia);
    const rawName = historicoBuildText(item.Provincia);
    if (!idProvincia || !rawName) continue;
    table.set(idProvincia, {
      idProvincia,
      name: historicoBuildDisplayName(rawName),
      // Igual que processRawMitecoData: slug del nombre en mayúsculas.
      slug: slugify(rawName.toUpperCase()),
      comunidadSlug: findComunidadById(historicoBuildText(item.IDCCAA))?.slug ?? null,
    });
  }
  return table;
}

/** Sumas, mínimos y recuentos de un carburante en un área, una posición por semana. */
interface HistoricoBuildFuelTotals {
  sum: Float64Array;
  min: Float64Array;
  count: Int32Array;
}

interface HistoricoBuildAreaTotals {
  entry: AreaIndexEntry;
  fuels: Record<HistoryFuel, HistoricoBuildFuelTotals>;
}

function historicoBuildNewFuelTotals(weekCount: number): HistoricoBuildFuelTotals {
  return {
    sum: new Float64Array(weekCount),
    min: new Float64Array(weekCount).fill(Infinity),
    count: new Int32Array(weekCount),
  };
}

function historicoBuildNewAreaTotals(entry: AreaIndexEntry, weekCount: number): HistoricoBuildAreaTotals {
  const fuels = {} as Record<HistoryFuel, HistoricoBuildFuelTotals>;
  for (const fuel of HISTORY_FUELS) fuels[fuel] = historicoBuildNewFuelTotals(weekCount);
  return { entry, fuels };
}

function historicoBuildAreaKey(kind: AreaKind, slug: string): string {
  return `${kind}:${slug}`;
}

function historicoBuildHasData(totals: HistoricoBuildAreaTotals): boolean {
  return HISTORY_FUELS.some((fuel) => totals.fuels[fuel].count.some((count) => count > 0));
}

function historicoBuildFuelSeries(totals: HistoricoBuildFuelTotals): AreaFuelSeries {
  const avg: FuelSeries = [];
  const min: FuelSeries = [];
  const count: number[] = [];
  totals.count.forEach((weekCount, index) => {
    count.push(weekCount);
    avg.push(weekCount > 0 ? Math.round(totals.sum[index] / weekCount) : null);
    min.push(weekCount > 0 ? totals.min[index] : null);
  });
  return { avg, min, count };
}

function historicoBuildAreaFile(totals: HistoricoBuildAreaTotals, weeks: string[]): AreaHistoryFile {
  const series = {} as Record<HistoryFuel, AreaFuelSeries>;
  for (const fuel of HISTORY_FUELS) series[fuel] = historicoBuildFuelSeries(totals.fuels[fuel]);
  const area: AreaHistory = { ...totals.entry, series };
  return { version: HISTORICO_BUILD_FORMAT_VERSION, weeks, area };
}

function historicoBuildBrandKey(brand: BrandInfo | null): string | null {
  if (!brand) return null;
  return Object.keys(BRAND_CONFIG).find((key) => BRAND_CONFIG[key] === brand) ?? null;
}

/** Acumulador de series por área: se le pasan las semanas una a una (memoria acotada). */
export class AreaHistoryAccumulator {
  private readonly weeks: string[];
  private readonly weekIndex: Map<string, number>;
  private readonly provinces: ReadonlyMap<string, ProvinceInfo>;
  private readonly areas = new Map<string, HistoricoBuildAreaTotals>();
  private readonly seenWeeks = new Set<number>();

  constructor(weeks: readonly string[], provinces: ReadonlyMap<string, ProvinceInfo>) {
    this.weeks = [...weeks];
    this.weekIndex = new Map(this.weeks.map((week, index) => [week, index]));
    this.provinces = provinces;
    this.registerAreas();
  }

  /** Suma una semana. RangeError si la fecha no está en weeks o ya se añadió. */
  addWeek(snapshot: WeekSnapshot): void {
    const index = this.weekIndex.get(snapshot.date);
    if (index === undefined) {
      throw new RangeError(`La semana ${snapshot.date} no está en la lista de semanas del acumulador.`);
    }
    if (this.seenWeeks.has(index)) {
      throw new RangeError(`La semana ${snapshot.date} ya se había añadido al acumulador.`);
    }
    this.seenWeeks.add(index);
    for (const station of snapshot.stations) this.addStation(station, index);
  }

  /** Genera índice y ficheros de área; las áreas sin ningún dato se omiten. */
  build(): { index: HistoryIndexFile; areas: AreaHistoryFile[] } {
    const withData = [...this.areas.values()].filter(historicoBuildHasData);
    const index: HistoryIndexFile = {
      version: HISTORICO_BUILD_FORMAT_VERSION,
      generatedAt: new Date().toISOString(),
      weeks: [...this.weeks],
      areas: withData.map((totals) => totals.entry),
    };
    return { index, areas: withData.map((totals) => historicoBuildAreaFile(totals, [...this.weeks])) };
  }

  /** Registra todas las áreas posibles en el orden final del índice. */
  private registerAreas(): void {
    this.register({ kind: 'espana', slug: HISTORICO_BUILD_SPAIN_SLUG, name: HISTORICO_BUILD_SPAIN_NAME });
    for (const comunidad of COMUNIDADES) {
      this.register({ kind: 'comunidad', slug: comunidad.slug, name: comunidad.name });
    }
    const provinces = [...this.provinces.values()].sort((a, b) =>
      a.name.localeCompare(b.name, HISTORICO_BUILD_LOCALE)
    );
    for (const province of provinces) {
      const entry: AreaIndexEntry = { kind: 'provincia', slug: province.slug, name: province.name };
      if (province.comunidadSlug) entry.parentSlug = province.comunidadSlug;
      this.register(entry);
    }
    for (const [key, brand] of Object.entries(BRAND_CONFIG)) {
      this.register({ kind: 'marca', slug: key, name: brand.name });
    }
  }

  private register(entry: AreaIndexEntry): void {
    this.areas.set(
      historicoBuildAreaKey(entry.kind, entry.slug),
      historicoBuildNewAreaTotals(entry, this.weeks.length)
    );
  }

  private addStation(station: WeekStationRecord, index: number): void {
    const keys = [historicoBuildAreaKey('espana', HISTORICO_BUILD_SPAIN_SLUG)];
    const comunidad = findComunidadById(station.idCCAA);
    if (comunidad) keys.push(historicoBuildAreaKey('comunidad', comunidad.slug));
    const province = this.provinces.get(station.idProvincia);
    if (province) keys.push(historicoBuildAreaKey('provincia', province.slug));
    const brandKey = historicoBuildBrandKey(getStationBrand(station.rotulo));
    if (brandKey) keys.push(historicoBuildAreaKey('marca', brandKey));
    for (const key of keys) this.addPrices(this.areas.get(key), station, index);
  }

  private addPrices(totals: HistoricoBuildAreaTotals | undefined, station: WeekStationRecord, index: number): void {
    if (!totals) return;
    for (const fuel of HISTORY_FUELS) {
      const price = station.prices[fuel];
      if (price === null) continue;
      const fuelTotals = totals.fuels[fuel];
      fuelTotals.sum[index] += price;
      fuelTotals.count[index] += 1;
      if (price < fuelTotals.min[index]) fuelTotals.min[index] = price;
    }
  }
}

type HistoricoBuildStationSeries = Record<HistoryFuel, FuelSeries>;

function historicoBuildEmptyStationSeries(weekCount: number): HistoricoBuildStationSeries {
  const series = {} as HistoricoBuildStationSeries;
  for (const fuel of HISTORY_FUELS) series[fuel] = new Array<PriceMilli | null>(weekCount).fill(null);
  return series;
}

function historicoBuildEncodeStation(
  series: HistoricoBuildStationSeries
): Partial<Record<HistoryFuel, (number | null)[]>> {
  const encoded: Partial<Record<HistoryFuel, (number | null)[]>> = {};
  for (const fuel of HISTORY_FUELS) {
    if (series[fuel].some((value) => value !== null)) encoded[fuel] = encodeDeltaSeries(series[fuel]);
  }
  return encoded;
}

function historicoBuildStationSeriesFor(
  byProvince: Map<string, Map<string, HistoricoBuildStationSeries>>,
  station: WeekStationRecord,
  weekCount: number
): HistoricoBuildStationSeries {
  let stations = byProvince.get(station.idProvincia);
  if (!stations) {
    stations = new Map();
    byProvince.set(station.idProvincia, stations);
  }
  let series = stations.get(station.id);
  if (!series) {
    series = historicoBuildEmptyStationSeries(weekCount);
    stations.set(station.id, series);
  }
  return series;
}

/** Particiones (provincia, año) de un año, a partir de los snapshots de ese año (los que falten quedan en null). */
export function buildStationPartitionsForYear(
  year: number,
  weeksOfYear: readonly string[],
  snapshots: readonly WeekSnapshot[]
): StationPartitionFile[] {
  const byProvince = new Map<string, Map<string, HistoricoBuildStationSeries>>();
  for (const snapshot of snapshots) {
    const index = weeksOfYear.indexOf(snapshot.date);
    if (index < 0 || yearOfIso(snapshot.date) !== year) {
      throw new RangeError(`La semana ${snapshot.date} no pertenece a las semanas del año ${year}.`);
    }
    for (const station of snapshot.stations) {
      if (!station.idProvincia) continue;
      const series = historicoBuildStationSeriesFor(byProvince, station, weeksOfYear.length);
      for (const fuel of HISTORY_FUELS) series[fuel][index] = station.prices[fuel];
    }
  }
  return [...byProvince.keys()].sort().map((idProvincia) => {
    const stations: StationPartitionFile['stations'] = {};
    for (const [id, series] of byProvince.get(idProvincia) ?? []) {
      stations[id] = historicoBuildEncodeStation(series);
    }
    return { version: HISTORICO_BUILD_FORMAT_VERSION, idProvincia, year, weeks: [...weeksOfYear], stations };
  });
}
