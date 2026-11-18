import { calcularStatsCombustible, FUEL_LABELS } from './miteco.ts';
import type { FuelType, Gasolinera } from './miteco.ts';

/** Radio por defecto, en km, para considerar cercana otra gasolinera. */
export const NEARBY_MAX_KM = 10;
/** Número máximo de gasolineras cercanas que se devuelven por defecto. */
export const NEARBY_LIMIT = 6;
/** Litros de un depósito de referencia para comparar costes. */
export const TANK_LITERS = 50;

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const EURO_DECIMALS = 2;
const KM_DECIMALS = 1;
const CENTS_TOLERANCE = 0.005;
const MIN_STATIONS_TO_RANK = 2;
const UNREADABLE_LABEL_PREFIX = 'nº';
const UNREADABLE_LABELS: ReadonlySet<string> = new Set(['NO HAY', 'NO ROTULO', 'NO', '-']);
const STARTS_WITH_DIGIT = /^\d/;
const MULTIPLE_SPACES = /\s{2,}/g;

/** Combustibles que se comparan en el resumen, en el orden en que se redactan. */
const STATION_INSIGHTS_SUMMARY_FUELS: ReadonlyArray<{ fuel: FuelType; name: string }> = [
  { fuel: 'diesel', name: 'diésel' },
  { fuel: 'gasolina95', name: 'gasolina 95' },
];

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface MunicipalityRank {
  position: number;
  total: number;
}

export interface NearbyStation {
  station: Gasolinera;
  km: number;
}

/** Distancia en kilómetros entre dos puntos (fórmula de haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEGREES_TO_RADIANS;
  const dLon = (b.lon - a.lon) * DEGREES_TO_RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEGREES_TO_RADIANS) * Math.cos(b.lat * DEGREES_TO_RADIANS) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Importe en euros con dos decimales y coma: 81,70 €. */
export function formatEuros(value: number): string {
  return `${value.toFixed(EURO_DECIMALS).replace('.', ',')} €`;
}

/** Distancia con un decimal y coma: 2,3 km. */
export function formatKm(km: number): string {
  return `${km.toFixed(KM_DECIMALS).replace('.', ',')} km`;
}

/**
 * Nombre legible de la estación para enlaces. Los rótulos vacíos, que empiezan por "Nº" o por un
 * dígito, o que son marcas de relleno de MITECO ("NO HAY", "NO ROTULO"), se sustituyen por la dirección.
 */
export function stationLabel(station: Gasolinera): string {
  const label = station.rotulo.trim();
  const isUnreadable =
    label === '' ||
    label.toLowerCase().startsWith(UNREADABLE_LABEL_PREFIX) ||
    STARTS_WITH_DIGIT.test(label) ||
    UNREADABLE_LABELS.has(label.toUpperCase());
  return isUnreadable ? `Gasolinera en ${station.direccion}` : label.replace(MULTIPLE_SPACES, ' ');
}

/**
 * Puesto de la estación entre las del municipio con precio de ese combustible,
 * de la más barata (1) a la más cara. Los empates comparten puesto.
 * Devuelve null si la estación no tiene precio de ese combustible.
 */
export function municipalityRank(
  station: Gasolinera,
  stations: Gasolinera[],
  fuel: FuelType
): MunicipalityRank | null {
  const price = station.precios[fuel];
  if (price === null) return null;
  const prices = stations.map((s) => s.precios[fuel]).filter((p): p is number => p !== null);
  const cheaper = prices.filter((p) => p < price).length;
  return { position: cheaper + 1, total: prices.length };
}

/** Estaciones más cercanas (sin incluir la propia) dentro del radio, de menor a mayor distancia. */
export function nearbyStations(
  station: Gasolinera,
  candidates: Gasolinera[],
  options: { maxKm?: number; limit?: number } = {}
): NearbyStation[] {
  const maxKm = options.maxKm ?? NEARBY_MAX_KM;
  const limit = options.limit ?? NEARBY_LIMIT;
  return candidates
    .filter((candidate) => candidate.id !== station.id)
    .map((candidate) => ({ station: candidate, km: distanceKm(station, candidate) }))
    .filter((entry) => entry.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

interface StationInsightsRanking {
  name: string;
  position: number;
  total: number;
  /** Estaciones con exactamente el mismo precio, contando la propia. */
  tied: number;
}

function stationInsightsRankings(station: Gasolinera, stations: Gasolinera[]): StationInsightsRanking[] {
  const rankings: StationInsightsRanking[] = [];
  for (const { fuel, name } of STATION_INSIGHTS_SUMMARY_FUELS) {
    const rank = municipalityRank(station, stations, fuel);
    if (!rank || rank.total < MIN_STATIONS_TO_RANK) continue;
    const tied = stations.filter((s) => s.precios[fuel] === station.precios[fuel]).length;
    rankings.push({ name, ...rank, tied });
  }
  return rankings;
}

function stationInsightsIsTied(ranking: StationInsightsRanking): boolean {
  return ranking.tied > 1 && (ranking.position === 1 || ranking.tied === ranking.total);
}

function stationInsightsIsLast(ranking: StationInsightsRanking): boolean {
  return ranking.tied === 1 && ranking.position === ranking.total;
}

function stationInsightsTieSentence(ranking: StationInsightsRanking, municipality: string): string {
  const others = ranking.tied - 1;
  if (ranking.tied === ranking.total) {
    return `Tiene el mismo precio de ${ranking.name} que las otras ${others} de ${municipality}.`;
  }
  return `Comparte el precio de ${ranking.name} más bajo de ${municipality} con otras ${others}.`;
}

function stationInsightsPlace(ranking: StationInsightsRanking): string {
  if (stationInsightsIsLast(ranking)) return 'más cara';
  return ranking.position === 1 ? 'más barata' : `${ranking.position}.ª`;
}

function stationInsightsRankSentence(rankings: StationInsightsRanking[], municipality: string): string {
  const [first, ...others] = rankings;
  const firstPlace = stationInsightsPlace(first);
  const firstTotal = `de las ${first.total} de ${municipality} en ${first.name}`;
  const isMiddle = first.position > 1 && !stationInsightsIsLast(first);
  const head = isMiddle
    ? `Es la ${firstPlace} gasolinera más barata ${firstTotal}`
    : `Es la gasolinera ${firstPlace} ${firstTotal}`;
  const tail = others.map((other) => {
    const totalNote = other.total === first.total ? '' : ` de ${other.total}`;
    return ` y la ${stationInsightsPlace(other)}${totalNote} en ${other.name}`;
  });
  return `${head}${tail.join('')}.`;
}

function stationInsightsRankingSentences(station: Gasolinera, stations: Gasolinera[]): string[] {
  const rankings = stationInsightsRankings(station, stations);
  const ordinal = rankings.filter((ranking) => !stationInsightsIsTied(ranking));
  const ties = rankings.filter(stationInsightsIsTied);
  const sentences = ties.map((ranking) => stationInsightsTieSentence(ranking, station.municipio));
  if (ordinal.length > 0) sentences.unshift(stationInsightsRankSentence(ordinal, station.municipio));
  return sentences;
}

function stationInsightsCostSentence(
  station: Gasolinera,
  stations: Gasolinera[],
  fuel: FuelType,
  name: string,
  isShort: boolean
): string | null {
  const price = station.precios[fuel];
  if (price === null) return null;
  const cost = formatEuros(price * TANK_LITERS);
  const base = isShort
    ? `En ${name}, ${TANK_LITERS} litros cuestan ${cost}`
    : `Llenar ${TANK_LITERS} litros de ${name} cuesta ${cost}`;
  const average = isShort ? 'la media' : 'la media del municipio';
  const stats = calcularStatsCombustible(stations, fuel);
  if (stats.avg === null || stats.count < MIN_STATIONS_TO_RANK) return `${base}.`;
  const diff = (price - stats.avg) * TANK_LITERS;
  if (Math.abs(diff) < CENTS_TOLERANCE) return `${base}, igual que ${average}.`;
  const direction = diff > 0 ? 'más' : 'menos';
  return `${base}, ${formatEuros(Math.abs(diff))} ${direction} que ${average}.`;
}

function stationInsightsCostSentences(station: Gasolinera, stations: Gasolinera[]): string[] {
  const sentences: string[] = [];
  for (const { fuel, name } of STATION_INSIGHTS_SUMMARY_FUELS) {
    const sentence = stationInsightsCostSentence(station, stations, fuel, name, sentences.length > 0);
    if (sentence) sentences.push(sentence);
  }
  return sentences;
}

function stationInsightsNoFuelSentence(station: Gasolinera): string {
  const available = (Object.keys(FUEL_LABELS) as FuelType[]).filter((fuel) => station.precios[fuel] !== null);
  const head = `${station.rotulo} no publica hoy precio de diésel ni de gasolina 95`;
  if (available.length === 0) return `${head} ni de ningún otro combustible.`;
  return `${head}. Sí vende: ${available.map((fuel) => FUEL_LABELS[fuel]).join(', ')}.`;
}

/**
 * Párrafo en español con el puesto de la estación en su municipio (diésel y gasolina 95)
 * y el coste de llenar 50 litros frente a la media municipal. Con una sola estación en el
 * municipio no hay clasificación; sin diésel ni gasolina 95 solo se listan sus combustibles.
 */
export function stationSummary(station: Gasolinera, municipalityStations: Gasolinera[]): string {
  const hasSummaryFuel = STATION_INSIGHTS_SUMMARY_FUELS.some(({ fuel }) => station.precios[fuel] !== null);
  if (!hasSummaryFuel) return stationInsightsNoFuelSentence(station);

  const ranking =
    municipalityStations.length <= 1
      ? [`Es la única gasolinera de ${station.municipio} con precio publicado hoy.`]
      : stationInsightsRankingSentences(station, municipalityStations);
  return [...ranking, ...stationInsightsCostSentences(station, municipalityStations)].join(' ');
}
