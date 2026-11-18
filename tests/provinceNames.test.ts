import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatProvinceName } from '../src/lib/provinceNames.ts';
import { processRawMitecoData, slugify } from '../src/lib/miteco.ts';

const SNAPSHOT_PATH = path.join(import.meta.dirname, '..', 'data', 'cache', 'miteco-snapshot.json');
const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'miteco-sample.json');
const SNAPSHOT_FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'miteco-snapshot-sample.json');

const EXAMPLES: Array<[string, string]> = [
  ['CIUDAD REAL', 'Ciudad Real'],
  ['CORUÑA (A)', 'A Coruña'],
  ['PALMAS (LAS)', 'Las Palmas'],
  ['BALEARS (ILLES)', 'Illes Balears'],
  ['RIOJA (LA)', 'La Rioja'],
  ['ALICANTE/ALACANT', 'Alicante/Alacant'],
  ['SANTA CRUZ DE TENERIFE', 'Santa Cruz de Tenerife'],
  ['ÁVILA', 'Ávila'],
  ['CASTELLÓN / CASTELLÓ', 'Castellón / Castelló'],
];

test('formatProvinceName cumple los ejemplos del contrato', () => {
  for (const [raw, expected] of EXAMPLES) {
    assert.equal(formatProvinceName(raw), expected);
  }
});

test('formatProvinceName deja igual un nombre en formato mixto', () => {
  assert.equal(formatProvinceName('Illes Balears'), 'Illes Balears');
});

test('formatProvinceName da un nombre legible a todas las provincias de la instantánea', { skip: !fs.existsSync(SNAPSHOT_PATH) }, () => {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  for (const province of snapshot.provincias) {
    const formatted = formatProvinceName(province.Provincia);
    assert.ok(formatted.length > 0);
    assert.doesNotMatch(formatted, /[()]/, `${province.Provincia} conserva paréntesis`);
    assert.doesNotMatch(formatted, /\p{Lu}{2}/u, `${province.Provincia} conserva mayúsculas seguidas`);
    assert.match(formatted, /^\p{Lu}/u, `${province.Provincia} no empieza en mayúscula`);
  }
});

test('provinciaSlug sale del nombre original en mayúsculas y no del formateado', () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const data = processRawMitecoData(raw);
  assert.ok(data.estaciones.length > 0);
  for (const station of data.estaciones) {
    const original = raw.ListaEESSPrecio.find((item: { IDEESS: string }) => item.IDEESS === station.id);
    const upper = String(original.Provincia).trim().toUpperCase();
    assert.equal(station.provinciaSlug, slugify(upper));
    assert.equal(station.provincia, formatProvinceName(upper));
  }
});

test('el nombre formateado llega a estaciones, provincias y municipios', () => {
  const sample = JSON.parse(fs.readFileSync(SNAPSHOT_FIXTURE_PATH, 'utf8'));
  const data = processRawMitecoData(sample.estaciones, sample.provincias);
  assert.ok(data.provinciasMap.size > 0);
  for (const province of data.provinciasMap.values()) {
    assert.equal(province.provincia, formatProvinceName(province.provincia));
    assert.doesNotMatch(province.provincia, /^\p{Lu}{2}/u);
  }
  for (const municipality of data.municipiosMap.values()) {
    assert.equal(data.provinciasMap.get(municipality.provinciaSlug)?.provincia, municipality.provincia);
  }
});
