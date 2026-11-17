import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMitecoSnapshot } from '../src/lib/mitecoSnapshot.ts';

const SNAPSHOT_FIXTURE = path.join(import.meta.dirname, 'fixtures', 'miteco-snapshot-sample.json');

test('loadMitecoSnapshot procesa la instantánea con la fecha y las estaciones del fichero', () => {
  const snapshot = loadMitecoSnapshot(SNAPSHOT_FIXTURE);
  assert.equal(snapshot.fechaMiteco, '16/11/2026 13:00:00');
  assert.ok(snapshot.estaciones.length > 0);
  assert.equal(snapshot.estacionesById.size, snapshot.estaciones.length);
  assert.ok(snapshot.provinciasMap.has('madrid'));
});

test('loadMitecoSnapshot falla si falta el fichero y avisa de npm run preparar-datos', () => {
  const missing = path.join(os.tmpdir(), 'gasolineras-sin-instantanea', 'miteco-snapshot.json');
  assert.throws(() => loadMitecoSnapshot(missing), /npm run preparar-datos/);
});

function withTempSnapshot(content: string, run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gasolineras-snapshot-'));
  try {
    const file = path.join(dir, 'miteco-snapshot.json');
    fs.writeFileSync(file, content);
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('loadMitecoSnapshot falla si el fichero no tiene estaciones', () => {
  withTempSnapshot(JSON.stringify({ descargado: '2026-11-16T12:00:00.000Z', provincias: [] }), (file) => {
    assert.throws(() => loadMitecoSnapshot(file), /estaciones/);
  });
});

test('loadMitecoSnapshot falla con un fichero corrupto y avisa de npm run preparar-datos', () => {
  withTempSnapshot('{ no es json', (file) => {
    assert.throws(() => loadMitecoSnapshot(file), /no es JSON válido.*npm run preparar-datos/);
  });
});
