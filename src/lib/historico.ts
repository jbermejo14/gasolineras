import fs from 'node:fs';
import path from 'node:path';
import type { AreaHistoryFile, AreaIndexEntry, AreaKind, HistoryIndexFile } from './historicoFormat';

const HISTORICO_DIR_SEGMENTS = ['data', 'historico'];
const HISTORICO_INDEX_FILE = 'indice.json';
const HISTORICO_AREAS_DIR = 'areas';
const HISTORICO_REGENERATE_HINT = 'Regenera los datos con `npm run historico`.';

const historicoFileCache = new Map<string, unknown>();

function historicoResolvePath(...segments: string[]): string {
  return path.join(process.cwd(), ...HISTORICO_DIR_SEGMENTS, ...segments);
}

/** Lee y cachea un JSON; devuelve null si el fichero no existe y lanza si no es JSON válido. */
function historicoReadJson<T>(filePath: string): T | null {
  if (historicoFileCache.has(filePath)) return historicoFileCache.get(filePath) as T;
  // Solo se cachean ficheros encontrados: así un fichero generado después se detecta sin reiniciar.
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`El fichero ${filePath} no contiene JSON válido (${reason}). ${HISTORICO_REGENERATE_HINT}`);
  }
  historicoFileCache.set(filePath, parsed);
  return parsed as T;
}

/** Índice del histórico, o null si todavía no se ha generado. */
export function getHistoryIndex(): HistoryIndexFile | null {
  const index = historicoReadJson<HistoryIndexFile>(historicoResolvePath(HISTORICO_INDEX_FILE));
  return index && index.weeks.length > 0 ? index : null;
}

/** Áreas del índice de un tipo; lista vacía si no hay índice. */
export function getAreasByKind(kind: AreaKind): AreaIndexEntry[] {
  const index = getHistoryIndex();
  return index ? index.areas.filter((area) => area.kind === kind) : [];
}

/** Histórico completo de un área, o null si el slug no está en el índice o su fichero no existe. */
export function loadAreaHistory(kind: AreaKind, slug: string): AreaHistoryFile | null {
  if (!getAreasByKind(kind).some((area) => area.slug === slug)) return null;
  const file = historicoReadJson<AreaHistoryFile>(historicoResolvePath(HISTORICO_AREAS_DIR, kind, `${slug}.json`));
  return file && file.weeks.length > 0 ? file : null;
}
