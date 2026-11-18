/**
 * lib/miteco.ts
 * Módulo central de acceso, validación, normalización y agregación de datos
 * del Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO).
 */

import { formatProvinceName } from './provinceNames.ts';

export interface PreciosCombustible {
  gasolina95: number | null;
  diesel: number | null;
  dieselPremium: number | null;
  gasolina98: number | null;
  glp: number | null;
  gnc: number | null;
  gnl: number | null;
  dieselB: number | null;
  adblue: number | null;
}

export type FuelType =
  | 'gasolina95'
  | 'diesel'
  | 'dieselPremium'
  | 'gasolina98'
  | 'glp'
  | 'gnc'
  | 'gnl'
  | 'dieselB'
  | 'adblue';

export interface Gasolinera {
  id: string; // IDEESS oficial
  slug: string;
  rotulo: string;
  direccion: string;
  cp: string;
  localidad: string;
  idMunicipio: string;
  municipio: string;
  municipioSlug: string;
  idProvincia: string;
  provincia: string;
  provinciaSlug: string;
  horario: string;
  lat: number;
  lon: number;
  tipoVenta: string;
  remision: string;
  precios: PreciosCombustible;
}

export interface StatsCombustible {
  min: number | null;
  max: number | null;
  avg: number | null;
  count: number;
  minStationId: string | null;
}

export type StatsPorCombustible = Record<FuelType, StatsCombustible>;

export interface ResumenMunicipio {
  idMunicipio: string;
  municipio: string;
  municipioSlug: string;
  provincia: string;
  provinciaSlug: string;
  totalEstaciones: number;
  minG95: number | null;
  minDiesel: number | null;
  avgG95: number | null;
  avgDiesel: number | null;
}

export interface ResumenProvincia {
  idProvincia: string;
  provincia: string;
  provinciaSlug: string;
  totalEstaciones: number;
  municipiosCount: number;
  minG95: number | null;
  minDiesel: number | null;
  avgG95: number | null;
  avgDiesel: number | null;
}

export interface MitecoSnapshot {
  fechaMiteco: string; // Fecha textual que devuelve la API de MITECO (ej: "16/11/2026 13:06:34")
  estaciones: Gasolinera[];
  estacionesById: Map<string, Gasolinera>;
  provinciasMap: Map<string, { idProvincia: string; provincia: string; provinciaSlug: string; estaciones: Gasolinera[] }>;
  municipiosMap: Map<string, { idMunicipio: string; municipio: string; municipioSlug: string; idProvincia: string; provincia: string; provinciaSlug: string; estaciones: Gasolinera[] }>;
  statsNacionales: StatsPorCombustible;
}

export const FUEL_LABELS: Record<FuelType, string> = {
  gasolina95: 'Gasolina 95 E5',
  diesel: 'Gasóleo A (Diésel)',
  dieselPremium: 'Diésel Premium',
  gasolina98: 'Gasolina 98 E5',
  glp: 'Autogás (GLP)',
  gnc: 'Gas Natural (GNC)',
  gnl: 'Gas Natural Licuado (GNL)',
  dieselB: 'Gasóleo B',
  adblue: 'AdBlue',
};

export const FUEL_SHORT_LABELS: Record<FuelType, string> = {
  gasolina95: 'G95',
  diesel: 'Diésel',
  dieselPremium: 'D+ Premium',
  gasolina98: 'G98',
  glp: 'GLP',
  gnc: 'GNC',
  gnl: 'GNL',
  dieselB: 'Gasóleo B',
  adblue: 'AdBlue',
};

export const MITECO_URL_ESTACIONES =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';
export const MITECO_URL_PROVINCIAS =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Provincias/';

/**
 * Función canónica para generar slugs estables: minúsculas, sin tildes, sin caracteres raros, guiones limpios.
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar diacríticos
    .replace(/[^a-z0-9]+/g, '-') // Caracteres no alfanuméricos a guiones
    .replace(/(^-|-$)/g, ''); // Quitar guiones al principio y final
}

/**
 * Parsea un precio decimal con coma de MITECO y valida que esté entre 0.50 y 3.50 €/L.
 */
export function parseAndValidatePrice(val: unknown): { price: number | null; reason?: string } {
  if (val === null || val === undefined || val === '') {
    return { price: null };
  }
  const str = String(val).trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) {
    return { price: null };
  }
  if (num < 0.50 || num > 3.50) {
    return {
      price: null,
      reason: `Precio fuera de rango válido [0.50 - 3.50 €/l]: ${num} €/l (original: "${val}")`,
    };
  }
  return { price: Math.round(num * 1000) / 1000 };
}

/**
 * Parsea coordenadas geográficas y valida que se encuentren dentro del ámbito territorial de España.
 * Latitud aprox: [27.0, 44.5] (Canarias 27.5°, Península hasta 43.8°)
 * Longitud aprox: [-19.0, 5.0] (Hierro -18.2°, Menorca 4.3°)
 */
export function parseAndValidateCoordinates(latRaw: unknown, lonRaw: unknown): {
  lat: number | null;
  lon: number | null;
  valid: boolean;
  reason?: string;
} {
  if (!latRaw || !lonRaw) {
    return { lat: null, lon: null, valid: false, reason: 'Coordenadas vacías o nulas' };
  }
  const lat = parseFloat(String(latRaw).trim().replace(',', '.'));
  const lon = parseFloat(String(lonRaw).trim().replace(',', '.'));

  if (isNaN(lat) || isNaN(lon)) {
    return { lat: null, lon: null, valid: false, reason: `Coordenadas no numéricas: lat="${latRaw}", lon="${lonRaw}"` };
  }

  if (lat < 27.0 || lat > 44.5 || lon < -19.0 || lon > 5.0) {
    return {
      lat,
      lon,
      valid: false,
      reason: `Coordenadas fuera de España: lat=${lat}, lon=${lon}`,
    };
  }

  return { lat, lon, valid: true };
}

/**
 * Calcula estadísticas para un combustible dado en un conjunto de estaciones.
 */
export function calcularStatsCombustible(estaciones: Gasolinera[], fuel: FuelType): StatsCombustible {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let minStationId: string | null = null;

  for (const s of estaciones) {
    const p = s.precios[fuel];
    if (p !== null && p > 0) {
      if (p < min) {
        min = p;
        minStationId = s.id;
      }
      if (p > max) {
        max = p;
      }
      sum += p;
      count++;
    }
  }

  if (count === 0) {
    return { min: null, max: null, avg: null, count: 0, minStationId: null };
  }

  return {
    min: Math.round(min * 1000) / 1000,
    max: Math.round(max * 1000) / 1000,
    avg: Math.round((sum / count) * 1000) / 1000,
    count,
    minStationId,
  };
}

export function calcularTodasLasStats(estaciones: Gasolinera[]): StatsPorCombustible {
  const fuels: FuelType[] = [
    'gasolina95',
    'diesel',
    'dieselPremium',
    'gasolina98',
    'glp',
    'gnc',
    'gnl',
    'dieselB',
    'adblue',
  ];
  const res = {} as StatsPorCombustible;
  for (const f of fuels) {
    res[f] = calcularStatsCombustible(estaciones, f);
  }
  return res;
}

/**
 * Transforma y valida una respuesta cruda de MITECO a una estructura tipada MitecoSnapshot.
 */
export function processRawMitecoData(
  rawData: { Fecha?: string; ListaEESSPrecio?: any[] },
  provinciasOficiales?: Array<{ IDPovincia?: string; IDProvincia?: string; Provincia?: string }>,
  municipiosOficiales?: Array<{ IDMunicipio?: string; IDProvincia?: string; Municipio?: string }>
): MitecoSnapshot {
  const fechaMiteco = rawData.Fecha || new Date().toLocaleString('es-ES');
  const rawList = Array.isArray(rawData.ListaEESSPrecio) ? rawData.ListaEESSPrecio : [];

  // Mapeos oficiales de ID a nombres limpios si se proporcionan
  const provNameById = new Map<string, string>();
  if (provinciasOficiales) {
    provinciasOficiales.forEach((p) => {
      const id = String(p.IDPovincia || p.IDProvincia || '').trim();
      if (id && p.Provincia) provNameById.set(id, p.Provincia.trim());
    });
  }

  let descartadasSinId = 0;
  let descartadasCoord = 0;
  let preciosDescartadosRango = 0;

  const estaciones: Gasolinera[] = [];
  const estacionesById = new Map<string, Gasolinera>();
  const provinciasMap = new Map<string, { idProvincia: string; provincia: string; provinciaSlug: string; estaciones: Gasolinera[] }>();
  const municipiosMap = new Map<string, { idMunicipio: string; municipio: string; municipioSlug: string; idProvincia: string; provincia: string; provinciaSlug: string; estaciones: Gasolinera[] }>();

  for (const item of rawList) {
    const rawId = item.IDEESS;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      descartadasSinId++;
      continue;
    }
    const id = rawId.trim();

    const coordCheck = parseAndValidateCoordinates(item.Latitud, item['Longitud (WGS84)']);
    if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lon === null) {
      descartadasCoord++;
      continue;
    }

    // Normalizar precios
    const pG95 = parseAndValidatePrice(item['Precio Gasolina 95 E5']);
    const pDiesel = parseAndValidatePrice(item['Precio Gasoleo A']);
    const pDPremium = parseAndValidatePrice(item['Precio Gasoleo Premium']);
    const pG98 = parseAndValidatePrice(item['Precio Gasolina 98 E5']);
    const pGLP = parseAndValidatePrice(item['Precio Gases licuados del petróleo']);
    const pGNC = parseAndValidatePrice(item['Precio Gas Natural Comprimido']);
    const pGNL = parseAndValidatePrice(item['Precio Gas Natural Licuado']);
    const pDieselB = parseAndValidatePrice(item['Precio Gasoleo B']);
    const pAdblue = parseAndValidatePrice(item['Precio Adblue']);

    if (pG95.reason) preciosDescartadosRango++;
    if (pDiesel.reason) preciosDescartadosRango++;
    if (pDPremium.reason) preciosDescartadosRango++;
    if (pG98.reason) preciosDescartadosRango++;
    if (pGLP.reason) preciosDescartadosRango++;
    if (pGNC.reason) preciosDescartadosRango++;
    if (pGNL.reason) preciosDescartadosRango++;
    if (pDieselB.reason) preciosDescartadosRango++;
    if (pAdblue.reason) preciosDescartadosRango++;

    const precios: PreciosCombustible = {
      gasolina95: pG95.price,
      diesel: pDiesel.price,
      dieselPremium: pDPremium.price,
      gasolina98: pG98.price,
      glp: pGLP.price,
      gnc: pGNC.price,
      gnl: pGNL.price,
      dieselB: pDieselB.price,
      adblue: pAdblue.price,
    };

    const idProvincia = String(item.IDProvincia || '').trim();
    const idMunicipio = String(item.IDMunicipio || '').trim();

    const provinciaNombreOficial = (provNameById.get(idProvincia) || item.Provincia || '').trim().toUpperCase();
    const municipioNombre = (item.Municipio || '').trim();

    // El slug se calcula del nombre oficial; el nombre mostrado es el legible.
    const provinciaSlug = slugify(provinciaNombreOficial);
    const provinciaNombre = formatProvinceName(provinciaNombreOficial);
    const municipioSlug = slugify(municipioNombre);
    const rotulo = (item['Rótulo'] || 'GASOLINERA').trim();
    const slug = slugify(`${rotulo}-${municipioNombre}-${id}`);

    const gasolinera: Gasolinera = {
      id,
      slug,
      rotulo,
      direccion: (item['Dirección'] || '').trim(),
      cp: (item['C.P.'] || '').trim(),
      localidad: (item['Localidad'] || '').trim(),
      idMunicipio,
      municipio: municipioNombre,
      municipioSlug,
      idProvincia,
      provincia: provinciaNombre,
      provinciaSlug,
      horario: (item['Horario'] || 'Consultar').trim(),
      lat: coordCheck.lat,
      lon: coordCheck.lon,
      tipoVenta: item['Tipo Venta'] || '',
      remision: item['Remisión'] || '',
      precios,
    };

    estaciones.push(gasolinera);
    estacionesById.set(id, gasolinera);

    // Agrupar por provincia
    if (provinciaSlug) {
      if (!provinciasMap.has(provinciaSlug)) {
        provinciasMap.set(provinciaSlug, {
          idProvincia,
          provincia: provinciaNombre,
          provinciaSlug,
          estaciones: [],
        });
      }
      provinciasMap.get(provinciaSlug)!.estaciones.push(gasolinera);
    }

    // Agrupar por municipio (clave compuesta: provinciaSlug:municipioSlug)
    if (provinciaSlug && municipioSlug) {
      const munKey = `${provinciaSlug}:${municipioSlug}`;
      if (!municipiosMap.has(munKey)) {
        municipiosMap.set(munKey, {
          idMunicipio,
          municipio: municipioNombre,
          municipioSlug,
          idProvincia,
          provincia: provinciaNombre,
          provinciaSlug,
          estaciones: [],
        });
      }
      municipiosMap.get(munKey)!.estaciones.push(gasolinera);
    }
  }

  console.log(`[MITECO Validacion] Total recibidas: ${rawList.length}`);
  console.log(`[MITECO Validacion] Descartadas sin IDEESS: ${descartadasSinId}`);
  console.log(`[MITECO Validacion] Descartadas por coordenadas inválidas fuera de España: ${descartadasCoord}`);
  console.log(`[MITECO Validacion] Precios individuales descartados por estar fuera de [0.50 - 3.50 €/l]: ${preciosDescartadosRango}`);
  console.log(`[MITECO Validacion] Estaciones válidas procesadas: ${estaciones.length}`);
  console.log(`[MITECO Validacion] Provincias con gasolineras: ${provinciasMap.size}, Municipios con gasolineras: ${municipiosMap.size}`);

  const statsNacionales = calcularTodasLasStats(estaciones);

  return {
    fechaMiteco,
    estaciones,
    estacionesById,
    provinciasMap,
    municipiosMap,
    statsNacionales,
  };
}

/**
 * Formatea un número en euros por litro (ej: 1,389 €/l).
 */
export function formatPrice(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  return val.toFixed(3).replace('.', ',') + ' €/l';
}

/**
 * Calcula el ahorro en euros para un depósito típico de 50 litros
 * comparando un precio con respecto a la media o referencia.
 */
export function calculateSavings50L(cheapest: number | null, average: number | null): number | null {
  if (cheapest === null || average === null || cheapest <= 0 || average <= 0) return null;
  const diffPerLiter = average - cheapest;
  if (diffPerLiter <= 0) return 0;
  return Math.round(diffPerLiter * 50 * 100) / 100;
}
