import fs from 'node:fs';
import { BASE_PATH } from './site.ts';

/** Variable de entorno con la ruta absoluta de config/red-enlaces.json de ododex-sitio. */
export const RED_ENLACES_ENV = 'ODODEX_RED_ENLACES';

/** Única versión del formato del fichero de red que entiende este módulo. */
export const RED_ENLACES_VERSION = 1;

const TRAILING_SLASHES = /\/+$/;

/** Sección de la red de Ododex (para el pie). */
export interface RedSeccion {
  ruta: string;
  nombre: string;
  descripcion: string;
}

/** Enlace a una página de otra sección; `href` va desde la raíz del dominio. */
export interface RedEnlace {
  seccion: string;
  texto: string;
  href: string;
}

export interface RedEnlacesFile {
  version: number;
  generado: string;
  secciones: RedSeccion[];
  enlaces: Record<string, RedEnlace[]>;
}

const redCache = new Map<string, RedEnlacesFile>();

function parseRedFile(raw: string, filePath: string): RedEnlacesFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`El fichero de red ${filePath} no es JSON válido (${reason}). Regenéralo con scripts/generar-red.mjs de ododex-sitio.`);
  }
  const version = (parsed as { version?: unknown } | null)?.version;
  if (version !== RED_ENLACES_VERSION) {
    throw new Error(`El fichero de red ${filePath} tiene version ${String(version)}; se esperaba ${RED_ENLACES_VERSION}.`);
  }
  return parsed as RedEnlacesFile;
}

/**
 * Lee el fichero de red indicado por la variable ODODEX_RED_ENLACES, con caché en memoria.
 * Devuelve null si la variable no existe o el fichero no existe (sin enlaces, sin error).
 * Lanza Error si el fichero no es JSON válido o su version no es 1.
 */
export function loadRedEnlaces(): RedEnlacesFile | null {
  const filePath = process.env[RED_ENLACES_ENV];
  if (!filePath) return null;
  const cached = redCache.get(filePath);
  if (cached) return cached;
  if (!fs.existsSync(filePath)) return null;
  const file = parseRedFile(fs.readFileSync(filePath, 'utf8'), filePath);
  redCache.set(filePath, file);
  return file;
}

/** Enlaces de una página; clave = ruta desde la raíz del dominio (se ignora la barra final). Lista vacía si no hay. */
export function getRedLinks(pageKey: string): RedEnlace[] {
  const key = pageKey.replace(TRAILING_SLASHES, '');
  return loadRedEnlaces()?.enlaces[key] ?? [];
}

/** Secciones de la red excluyendo la propia (BASE_PATH). Lista vacía si no hay red. */
export function getRedSections(): RedSeccion[] {
  const sections = loadRedEnlaces()?.secciones ?? [];
  return sections.filter((section) => section.ruta !== BASE_PATH);
}

/** Clave de la página de un municipio en el fichero de red. */
export function municipalityRedKey(provinciaSlug: string, municipioSlug: string): string {
  return `${BASE_PATH}/provincia/${provinciaSlug}/${municipioSlug}`;
}

/** Clave de la página de una provincia en el fichero de red. */
export function provinceRedKey(provinciaSlug: string): string {
  return `${BASE_PATH}/provincia/${provinciaSlug}`;
}
