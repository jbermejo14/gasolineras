import fs from 'node:fs';
import path from 'node:path';
import { downloadMitecoSnapshot, loadMitecoSnapshot } from '../src/lib/mitecoSnapshot.ts';
import { buildEstacionesPayload } from '../src/lib/stationPayload.ts';

const STATIONS_JSON_FILE = path.join(process.cwd(), 'public', 'datos', 'estaciones.json');
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_DECIMALS = 2;
const EXIT_CODE_ERROR = 1;

function prepararDatosWriteStations(): { fechaMiteco: string; stations: number; bytes: number } {
  const snapshot = loadMitecoSnapshot();
  const json = JSON.stringify(buildEstacionesPayload(snapshot));
  fs.mkdirSync(path.dirname(STATIONS_JSON_FILE), { recursive: true });
  fs.writeFileSync(STATIONS_JSON_FILE, json);
  return {
    fechaMiteco: snapshot.fechaMiteco,
    stations: snapshot.estaciones.length,
    bytes: Buffer.byteLength(json),
  };
}

async function prepararDatosMain(): Promise<void> {
  await downloadMitecoSnapshot();
  const summary = prepararDatosWriteStations();
  const megabytes = (summary.bytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_DECIMALS);
  console.log(`Datos preparados: fecha MITECO ${summary.fechaMiteco}, ${summary.stations} estaciones, ${STATIONS_JSON_FILE} (${megabytes} MB).`);
}

prepararDatosMain().catch((err) => {
  console.error('No se pudieron preparar los datos de MITECO:', err);
  process.exit(EXIT_CODE_ERROR);
});
