import fs from 'node:fs';
import path from 'node:path';
import {
  MITECO_URL_ESTACIONES,
  MITECO_URL_PROVINCIAS,
  processRawMitecoData,
} from './miteco.ts';
import type { MitecoSnapshot } from './miteco.ts';

/** Ruta del fichero instantánea: data/cache/miteco-snapshot.json. */
export const MITECO_SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'cache', 'miteco-snapshot.json');

const MITECO_FETCH_HEADERS = { Accept: 'application/json', 'User-Agent': 'GasolinerasSEO/1.0' };

interface MitecoSnapshotFile {
  descargado: string;
  estaciones: Parameters<typeof processRawMitecoData>[0];
  provincias: Parameters<typeof processRawMitecoData>[1];
}

async function snapshotFetchStations(): Promise<MitecoSnapshotFile['estaciones']> {
  const response = await fetch(MITECO_URL_ESTACIONES, { headers: MITECO_FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(
      `Error HTTP ${response.status} ${response.statusText} al descargar ${MITECO_URL_ESTACIONES}. Comprueba la conexión y vuelve a ejecutar npm run preparar-datos.`
    );
  }
  return (await response.json()) as MitecoSnapshotFile['estaciones'];
}

async function snapshotFetchProvinces(): Promise<MitecoSnapshotFile['provincias']> {
  const response = await fetch(MITECO_URL_PROVINCIAS, { headers: MITECO_FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(
      `Error HTTP ${response.status} ${response.statusText} al descargar ${MITECO_URL_PROVINCIAS}. Comprueba la conexión y vuelve a ejecutar npm run preparar-datos.`
    );
  }
  return (await response.json()) as MitecoSnapshotFile['provincias'];
}

/**
 * Descarga EstacionesTerrestres y Listados/Provincias de MITECO y escribe en `file`
 * { descargado: ISO, estaciones: JSON crudo, provincias: JSON crudo }.
 * Lanza Error con el estado HTTP y la URL si falla la descarga de estaciones o de provincias.
 */
export async function downloadMitecoSnapshot(file: string = MITECO_SNAPSHOT_FILE): Promise<void> {
  const [estaciones, provincias] = await Promise.all([snapshotFetchStations(), snapshotFetchProvinces()]);
  const content: MitecoSnapshotFile = { descargado: new Date().toISOString(), estaciones, provincias };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(content));
}

function snapshotParseFile(file: string): Partial<MitecoSnapshotFile> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<MitecoSnapshotFile>;
  } catch (err) {
    throw new Error(`La instantánea de MITECO (${file}) no es JSON válido: ejecuta npm run preparar-datos.`, { cause: err });
  }
}

/**
 * Lee la instantánea y la procesa con processRawMitecoData.
 * Lanza Error si el fichero falta o no es una instantánea válida.
 */
export function loadMitecoSnapshot(file: string = MITECO_SNAPSHOT_FILE): MitecoSnapshot {
  if (!fs.existsSync(file)) {
    throw new Error(`No existe la instantánea de MITECO (${file}): ejecuta npm run preparar-datos.`);
  }
  const content = snapshotParseFile(file);
  if (!content.estaciones) {
    throw new Error(`La instantánea de MITECO (${file}) no tiene el campo "estaciones": ejecuta npm run preparar-datos.`);
  }
  return processRawMitecoData(content.estaciones, content.provincias);
}

let mitecoSnapshotCache: MitecoSnapshot | null = null;

/**
 * Datos de MITECO de la instantánea del día. Se leen del disco una sola vez por proceso;
 * nunca descarga nada.
 */
export async function getMitecoData(): Promise<MitecoSnapshot> {
  mitecoSnapshotCache ??= loadMitecoSnapshot();
  return mitecoSnapshotCache;
}
