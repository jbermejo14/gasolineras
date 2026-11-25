import { SITE_NAME } from './site.ts';

/** Longitud máxima del título completo, con la marca que añade la plantilla del layout. */
export const TITLE_MAX_LENGTH = 65;
/** Longitud objetivo del título completo: se prefiere una variante que quepa aquí. */
export const TITLE_TARGET_LENGTH = 60;
export const DESCRIPTION_MIN_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 160;

/** Sufijo que la plantilla del layout añade a cada título: ' | Ododex'. */
export const TITLE_BRAND_SUFFIX = ` | ${SITE_NAME}`;

const TITLE_MAX_BODY = TITLE_MAX_LENGTH - TITLE_BRAND_SUFFIX.length;
const TITLE_TARGET_BODY = TITLE_TARGET_LENGTH - TITLE_BRAND_SUFFIX.length;
const WHITESPACE_RUN = /\s+/g;
const SHORT_NAME_SEPARATORS = /[/,]/;
const SENTENCE_SEPARATOR = ' ';

/** Quita espacios de los extremos y colapsa los repetidos (los rótulos de MITECO traen dobles). */
export function collapseWhitespace(text: string): string {
  return text.replace(WHITESPACE_RUN, ' ').trim();
}

/** Nombre sin la parte cooficial o aclaratoria: 'Castellón / Castelló' → 'Castellón'; 'Etxebarri, Anteiglesia de…' → 'Etxebarri'. */
export function shortPlaceName(name: string): string {
  const first = name.split(SHORT_NAME_SEPARATORS)[0];
  return collapseWhitespace(first);
}

/** Dos nombres de lugar iguales sin distinguir mayúsculas (p. ej. municipio Madrid en la provincia de Madrid). */
export function isSamePlace(a: string, b: string): boolean {
  return collapseWhitespace(a).toLocaleLowerCase('es') === collapseWhitespace(b).toLocaleLowerCase('es');
}

function pickTitleInTier(variants: readonly string[]): string | null {
  const target = variants.find((variant) => variant.length <= TITLE_TARGET_BODY);
  if (target !== undefined) return target;
  return variants.find((variant) => variant.length <= TITLE_MAX_BODY) ?? null;
}

/**
 * Elige el título sin marca. Recorre los niveles en orden; en cada uno prefiere la primera
 * variante que deja el título completo en el objetivo (60) y, si no, la primera que lo deja en
 * el máximo (65). Devuelve null si ninguna cabe: quien llama aporta entonces su último recurso.
 */
export function pickTitle(...tiers: ReadonlyArray<readonly string[]>): string | null {
  for (const tier of tiers) {
    const picked = pickTitleInTier(tier);
    if (picked !== null) return picked;
  }
  return null;
}

/** Une frases con un espacio, descartando las vacías. */
export function joinSentences(...parts: ReadonlyArray<string | null | undefined | false>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(SENTENCE_SEPARATOR);
}

/**
 * Elige la descripción: la primera variante (de más a menos rica) que no pasa de 160 caracteres
 * y, si queda por debajo de 120, le añade frases de relleno en orden mientras quepan.
 * Si ninguna variante cabe devuelve la más corta.
 */
export function fitDescription(variants: readonly string[], fillers: readonly string[]): string {
  const shortest = variants.reduce((best, variant) => (variant.length < best.length ? variant : best));
  let text = variants.find((variant) => variant.length <= DESCRIPTION_MAX_LENGTH) ?? shortest;
  for (const filler of fillers) {
    if (text.length >= DESCRIPTION_MIN_LENGTH) break;
    const extended = joinSentences(text, filler);
    if (extended.length <= DESCRIPTION_MAX_LENGTH) text = extended;
  }
  return text;
}
