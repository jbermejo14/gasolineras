import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { AwsClient } from 'aws4fetch';
import {
  HISTORY_START_DATE,
  isoToMitecoDate,
  listMondays,
  yearOfIso,
} from '../src/lib/historicoFormat.ts';
import type { WeekSnapshot } from '../src/lib/historicoFormat.ts';
import {
  AreaHistoryAccumulator,
  buildProvinceTable,
  buildStationPartitionsForYear,
  buildWeekSnapshot,
} from '../src/lib/historicoBuild.ts';
import { MITECO_URL_PROVINCIAS } from '../src/lib/miteco.ts';

const MITECO_URL_HISTORICO_BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist';
const MITECO_USER_AGENT = 'GasolinerasSEO/1.0';
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const FETCH_TIMEOUT_MS = 120_000;
const DOWNLOAD_CONCURRENCY = 2;
const RETRY_DELAYS_SECONDS = [5, 15, 45];
const MILLIS_PER_SECOND = 1000;
const ENV_FILE = '.env.local';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

const OPTION_UNTIL_PREFIX = '--hasta=';
const OPTION_UPLOAD = '--subir';
const OPTION_UPLOAD_ALL = '--subir-todo';

const DATA_DIR = path.join('data', 'historico');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const INDEX_FILE = path.join(DATA_DIR, 'indice.json');
const AREAS_DIR = path.join(DATA_DIR, 'areas');
const STATIONS_DIR = path.join('public', 'historico-estaciones');
const CACHE_EXTENSION = '.json.gz';

const R2_VARIABLES = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;
const R2_KEY_PREFIX = 'estaciones';
const R2_CACHE_CONTROL = 'public, max-age=86400';

export interface HistoricoArgs {
  /** Fecha ISO límite (incluida) o null para usar hoy. */
  until: string | null;
  upload: boolean;
  uploadAll: boolean;
}

interface HistoricoR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface HistoricoDownloadReport {
  downloaded: string[];
  failed: string[];
}

interface HistoricoUploadReport {
  uploaded: number;
  failed: number;
}

interface HistoricoWrittenPartition {
  idProvincia: string;
  year: number;
  file: string;
}

function historicoIsValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, ISO_DATE_LENGTH) === value;
}

/** Interpreta los argumentos de línea de comandos; lanza Error con un mensaje claro si no son válidos. */
export function parseHistoricoArgs(argv: readonly string[]): HistoricoArgs {
  const args: HistoricoArgs = { until: null, upload: false, uploadAll: false };
  for (const arg of argv) {
    if (arg === OPTION_UPLOAD) {
      args.upload = true;
    } else if (arg === OPTION_UPLOAD_ALL) {
      args.upload = true;
      args.uploadAll = true;
    } else if (arg.startsWith(OPTION_UNTIL_PREFIX)) {
      const value = arg.slice(OPTION_UNTIL_PREFIX.length);
      if (!historicoIsValidIsoDate(value)) {
        throw new Error(
          `Fecha inválida en ${OPTION_UNTIL_PREFIX}: "${value}". Usa el formato yyyy-mm-dd, por ejemplo 2020-01-06.`
        );
      }
      args.until = value;
    } else {
      throw new Error(
        `Opción desconocida: "${arg}". Opciones válidas: ${OPTION_UNTIL_PREFIX}yyyy-mm-dd, ${OPTION_UPLOAD}, ${OPTION_UPLOAD_ALL}.`
      );
    }
  }
  return args;
}

/** Semanas (en el orden recibido) que no están en la caché. */
export function findMissingWeeks(weeks: readonly string[], cachedDates: Iterable<string>): string[] {
  const cached = new Set(cachedDates);
  return weeks.filter((week) => !cached.has(week));
}

function historicoLoadEnvFile(): void {
  if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

function historicoReadR2Config(): HistoricoR2Config {
  for (const name of R2_VARIABLES) {
    if (!process.env[name]) {
      throw new Error(
        `Falta la variable de entorno ${name}, necesaria para subir a R2. Defínela en el entorno o en ${ENV_FILE}.`
      );
    }
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID as string,
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    bucket: process.env.R2_BUCKET as string,
  };
}

function historicoErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function historicoSleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * MILLIS_PER_SECOND));
}

/** Ejecuta la operación con reintentos y esperas crecientes; relanza el último error. */
async function historicoWithRetries<T>(label: string, operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= RETRY_DELAYS_SECONDS.length) throw error;
      const delay = RETRY_DELAYS_SECONDS[attempt];
      console.warn(`${label}: fallo (${historicoErrorMessage(error)}). Reintento ${attempt + 1} en ${delay} s.`);
      await historicoSleep(delay);
    }
  }
}

async function historicoFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': MITECO_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.json();
}

async function historicoFetchProvinceListing(): Promise<Record<string, unknown>[]> {
  const listing = await historicoWithRetries('Listado de provincias', () => historicoFetchJson(MITECO_URL_PROVINCIAS));
  if (!Array.isArray(listing) || listing.length === 0) {
    throw new Error('MITECO devolvió un listado de provincias vacío o con formato inesperado.');
  }
  return listing as Record<string, unknown>[];
}

async function historicoFetchWeek(date: string): Promise<WeekSnapshot> {
  const raw = (await historicoFetchJson(`${MITECO_URL_HISTORICO_BASE}/${isoToMitecoDate(date)}`)) as {
    ListaEESSPrecio?: unknown[];
  } | null;
  if (!raw || !Array.isArray(raw.ListaEESSPrecio) || raw.ListaEESSPrecio.length === 0) {
    throw new Error('respuesta sin ListaEESSPrecio o vacía');
  }
  return buildWeekSnapshot(raw, date);
}

function historicoCacheFile(date: string): string {
  return path.join(CACHE_DIR, `${date}${CACHE_EXTENSION}`);
}

/** Escribe a un fichero temporal y lo renombra: un corte a mitad no deja un fichero corrupto. */
function historicoWriteFileAtomic(file: string, content: Buffer): void {
  const temporary = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

function historicoWriteJson(file: string, value: unknown): void {
  historicoWriteFileAtomic(file, Buffer.from(JSON.stringify(value)));
}

function historicoSaveSnapshot(snapshot: WeekSnapshot): void {
  historicoWriteFileAtomic(historicoCacheFile(snapshot.date), zlib.gzipSync(JSON.stringify(snapshot)));
}

function historicoLoadSnapshot(date: string): WeekSnapshot {
  const file = historicoCacheFile(date);
  try {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as WeekSnapshot;
  } catch (error) {
    throw new Error(
      `La caché ${file} está corrupta o ilegible (${historicoErrorMessage(error)}). ` +
        'Borra ese fichero y vuelve a ejecutar npm run historico.'
    );
  }
}

function historicoListCachedDates(): string[] {
  if (!fs.existsSync(CACHE_DIR)) return [];
  return fs
    .readdirSync(CACHE_DIR)
    .filter((name) => name.endsWith(CACHE_EXTENSION))
    .map((name) => name.slice(0, -CACHE_EXTENSION.length));
}

/** Cola simple: `limit` trabajadores toman elementos de la lista hasta agotarla. */
async function historicoRunQueue<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const runWorker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
}

async function historicoDownloadWeeks(missing: readonly string[]): Promise<HistoricoDownloadReport> {
  const report: HistoricoDownloadReport = { downloaded: [], failed: [] };
  let finished = 0;
  await historicoRunQueue(missing, DOWNLOAD_CONCURRENCY, async (date) => {
    try {
      const snapshot = await historicoWithRetries(date, () => historicoFetchWeek(date));
      historicoSaveSnapshot(snapshot);
      report.downloaded.push(date);
      const count = snapshot.stations.length.toLocaleString('es-ES');
      console.log(`[${++finished}/${missing.length}] ${date} ok (${count} gasolineras)`);
    } catch (error) {
      report.failed.push(date);
      console.error(`[${++finished}/${missing.length}] ${date} FALLO: ${historicoErrorMessage(error)}`);
    }
  });
  report.downloaded.sort();
  report.failed.sort();
  return report;
}

/** Escribe el índice y los ficheros por área (solo sobrescribe); devuelve cuántos ficheros escribió. */
function historicoBuildAreaFiles(
  weeks: readonly string[],
  provinces: ReturnType<typeof buildProvinceTable>,
  cached: ReadonlySet<string>
): number {
  const accumulator = new AreaHistoryAccumulator(weeks, provinces);
  for (const week of weeks) {
    if (cached.has(week)) accumulator.addWeek(historicoLoadSnapshot(week));
  }
  const { index, areas } = accumulator.build();
  historicoWriteJson(INDEX_FILE, index);
  for (const file of areas) {
    historicoWriteJson(path.join(AREAS_DIR, file.area.kind, `${file.area.slug}.json`), file);
  }
  return areas.length + 1;
}

function historicoGroupWeeksByYear(weeks: readonly string[]): Map<number, string[]> {
  const byYear = new Map<number, string[]>();
  for (const week of weeks) {
    const year = yearOfIso(week);
    byYear.set(year, [...(byYear.get(year) ?? []), week]);
  }
  return byYear;
}

/** Escribe las particiones año a año, con solo los snapshots de ese año en memoria. */
function historicoBuildPartitionFiles(
  weeks: readonly string[],
  cached: ReadonlySet<string>
): HistoricoWrittenPartition[] {
  const written: HistoricoWrittenPartition[] = [];
  for (const [year, weeksOfYear] of historicoGroupWeeksByYear(weeks)) {
    const snapshots = weeksOfYear.filter((week) => cached.has(week)).map(historicoLoadSnapshot);
    for (const partition of buildStationPartitionsForYear(year, weeksOfYear, snapshots)) {
      const file = path.join(STATIONS_DIR, partition.idProvincia, `${year}.json`);
      historicoWriteJson(file, partition);
      written.push({ idProvincia: partition.idProvincia, year, file });
    }
  }
  return written;
}

async function historicoUploadPartition(
  client: AwsClient,
  config: HistoricoR2Config,
  partition: HistoricoWrittenPartition
): Promise<void> {
  const key = `${R2_KEY_PREFIX}/${partition.idProvincia}/${partition.year}.json`;
  const url = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;
  const response = await client.fetch(url, {
    method: 'PUT',
    body: fs.readFileSync(partition.file),
    headers: { 'Content-Type': 'application/json', 'Cache-Control': R2_CACHE_CONTROL },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
}

/** Sube secuencialmente; un fallo se informa y se sigue. */
async function historicoUploadPartitions(
  config: HistoricoR2Config,
  partitions: readonly HistoricoWrittenPartition[]
): Promise<HistoricoUploadReport> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const report: HistoricoUploadReport = { uploaded: 0, failed: 0 };
  for (const [position, partition] of partitions.entries()) {
    const progress = `[subida ${position + 1}/${partitions.length}] ${partition.idProvincia}/${partition.year}.json`;
    try {
      await historicoUploadPartition(client, config, partition);
      report.uploaded++;
      console.log(`${progress} ok`);
    } catch (error) {
      report.failed++;
      console.error(`${progress} FALLO: ${historicoErrorMessage(error)}`);
    }
  }
  return report;
}

function historicoSelectPartitionsToUpload(
  args: HistoricoArgs,
  partitions: readonly HistoricoWrittenPartition[],
  downloaded: readonly string[]
): HistoricoWrittenPartition[] {
  if (args.uploadAll) return [...partitions];
  const downloadedYears = new Set(downloaded.map(yearOfIso));
  return partitions.filter((partition) => downloadedYears.has(partition.year));
}

function historicoPrintSummary(
  report: HistoricoDownloadReport,
  filesWritten: number,
  upload: HistoricoUploadReport | null
): void {
  const failedDates = report.failed.length > 0 ? ` (${report.failed.join(', ')})` : '';
  console.log('\nResumen');
  console.log(`- Semanas descargadas: ${report.downloaded.length}`);
  console.log(`- Semanas fallidas: ${report.failed.length}${failedDates}`);
  console.log(`- Ficheros escritos: ${filesWritten}`);
  if (upload) console.log(`- Ficheros subidos a R2: ${upload.uploaded} (fallidos: ${upload.failed})`);
}

/** Código de salida: fallo si falló alguna semana o alguna subida, para que un cron lo detecte. */
export function resolveHistoricoExitCode(failedWeeks: number, failedUploads: number): number {
  return failedWeeks > 0 || failedUploads > 0 ? EXIT_FAILURE : EXIT_OK;
}

async function historicoMain(): Promise<number> {
  const args = parseHistoricoArgs(process.argv.slice(2));
  historicoLoadEnvFile();
  const r2Config = args.upload ? historicoReadR2Config() : null;

  const until = args.until ? new Date(`${args.until}T00:00:00Z`) : new Date();
  const weeks = listMondays(HISTORY_START_DATE, until);
  const cachedDates = new Set(historicoListCachedDates());
  const missing = findMissingWeeks(weeks, cachedDates);
  console.log(`${weeks.length} semanas en total, ${missing.length} por descargar.`);

  const provinces = buildProvinceTable(await historicoFetchProvinceListing());
  const report = await historicoDownloadWeeks(missing);

  console.log('Construyendo agregados por área...');
  for (const date of report.downloaded) cachedDates.add(date);
  const areaFiles = historicoBuildAreaFiles(weeks, provinces, cachedDates);
  console.log('Construyendo particiones por gasolinera...');
  const partitions = historicoBuildPartitionFiles(weeks, cachedDates);

  let upload: HistoricoUploadReport | null = null;
  if (r2Config) {
    const selected = historicoSelectPartitionsToUpload(args, partitions, report.downloaded);
    upload = await historicoUploadPartitions(r2Config, selected);
  }
  historicoPrintSummary(report, areaFiles + partitions.length, upload);
  return resolveHistoricoExitCode(report.failed.length, upload?.failed ?? 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  historicoMain().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`Error: ${historicoErrorMessage(error)}`);
      process.exitCode = EXIT_FAILURE;
    }
  );
}
