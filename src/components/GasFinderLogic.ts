import type { FuelType } from '@/lib/miteco';
import type { EstacionLigera } from '@/lib/stationPayload';
// Ruta relativa con extensión para que Node pueda importar el módulo en las pruebas.
import { BRAND_CONFIG, matchesBrand } from '../lib/brands.ts';

/** Número de tarjetas que se añaden cada vez que se pulsa "Cargar más". */
export const GAS_FINDER_PAGE_SIZE = 36;

const EARTH_RADIUS_KM = 6371;
const DISTANCE_DECIMALS_FACTOR = 10;
const PRICE_DECIMALS_FACTOR = 1000;
const MISSING_PRICE_ASC = 999;
const MISSING_PRICE_DESC = -1;
const MISSING_DISTANCE = 9999;

export type GasFinderSort = 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';
export type GasFinderStation = EstacionLigera & { distance?: number };

export interface GasFinderCriteria {
  fuel: FuelType;
  province: string;
  brand: string;
  search: string;
  sortBy: GasFinderSort;
  userCoords: { lat: number; lon: number } | null;
  radius: number;
}

/** Criterios que afectan solo al filtrado. */
export type GasFinderFilterCriteria = Omit<GasFinderCriteria, 'sortBy'>;

export type GasFinderSortCriteria = Pick<GasFinderCriteria, 'fuel' | 'sortBy' | 'userCoords'>;

export interface GasFinderStats {
  total: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

/** Distancia en km (un decimal) entre dos coordenadas, por la fórmula de haversine. */
function gasFinderDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * DISTANCE_DECIMALS_FACTOR) / DISTANCE_DECIMALS_FACTOR;
}

function gasFinderMatchesSearch(s: EstacionLigera, query: string): boolean {
  return (
    s.rotulo.toLowerCase().includes(query) ||
    s.direccion.toLowerCase().includes(query) ||
    s.municipio.toLowerCase().includes(query) ||
    s.localidad.toLowerCase().includes(query) ||
    s.cp.includes(query)
  );
}

function gasFinderCompare(a: GasFinderStation, b: GasFinderStation, c: GasFinderSortCriteria): number {
  switch (c.sortBy) {
    case 'price_asc':
      return (a.precios[c.fuel] ?? MISSING_PRICE_ASC) - (b.precios[c.fuel] ?? MISSING_PRICE_ASC);
    case 'price_desc':
      return (b.precios[c.fuel] ?? MISSING_PRICE_DESC) - (a.precios[c.fuel] ?? MISSING_PRICE_DESC);
    case 'distance_asc':
      return c.userCoords ? (a.distance ?? MISSING_DISTANCE) - (b.distance ?? MISSING_DISTANCE) : 0;
    case 'name_asc':
      return a.rotulo.localeCompare(b.rotulo, 'es');
  }
}

/**
 * Filtra por carburante, provincia, marca, texto y radio, sin ordenar.
 * El orden se aplica aparte para que cambiarlo no genere un array nuevo para el mapa.
 */
export function gasFinderFilterStations(
  stations: EstacionLigera[],
  criteria: GasFinderFilterCriteria
): GasFinderStation[] {
  const { fuel, province, brand, search, userCoords, radius } = criteria;
  let list: GasFinderStation[] = stations.filter((s) => (s.precios[fuel] ?? 0) > 0);

  if (province !== 'TODAS') list = list.filter((s) => s.provinciaSlug === province);

  const brandConfig = brand ? BRAND_CONFIG[brand] : undefined;
  if (brandConfig) {
    list = list.filter((s) => matchesBrand(s.rotulo, brandConfig));
  }

  const query = search.trim().toLowerCase();
  if (query) list = list.filter((s) => gasFinderMatchesSearch(s, query));

  if (userCoords) {
    list = list
      .map((s) => ({ ...s, distance: gasFinderDistance(userCoords.lat, userCoords.lon, s.lat, s.lon) }))
      .filter((s) => s.distance <= radius);
  }

  return list;
}

/** Devuelve una copia ordenada según `sortBy`; no modifica la entrada. */
export function gasFinderSortStations(
  stations: GasFinderStation[],
  criteria: GasFinderSortCriteria
): GasFinderStation[] {
  return [...stations].sort((a, b) => gasFinderCompare(a, b, criteria));
}

/** Mínimo, máximo y media del carburante sobre las estaciones filtradas. */
export function gasFinderComputeStats(stations: GasFinderStation[], fuel: FuelType): GasFinderStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (const s of stations) {
    const p = s.precios[fuel];
    if (p !== null && p > 0) {
      min = Math.min(min, p);
      max = Math.max(max, p);
      sum += p;
      count++;
    }
  }

  return {
    total: stations.length,
    min: count > 0 ? min : null,
    max: count > 0 ? max : null,
    avg: count > 0 ? Math.round((sum / count) * PRICE_DECIMALS_FACTOR) / PRICE_DECIMALS_FACTOR : null,
  };
}
