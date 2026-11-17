import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as payload from '../src/lib/stationPayload.ts';
import type { Gasolinera } from '../src/lib/miteco';

const { toEstacionLigera, buildEstacionesPayload } = payload;

const EXPECTED_KEYS = [
  'id', 'slug', 'rotulo', 'direccion', 'cp', 'localidad', 'municipio',
  'provincia', 'provinciaSlug', 'horario', 'lat', 'lon', 'precios',
].sort();

function makeStation(id: string): Gasolinera {
  return {
    id,
    slug: `slug-${id}`,
    rotulo: 'TEST',
    direccion: 'Calle 1',
    cp: '28001',
    localidad: 'Madrid',
    idMunicipio: '1',
    municipio: 'Madrid',
    municipioSlug: 'madrid',
    idProvincia: '28',
    provincia: 'MADRID',
    provinciaSlug: 'madrid',
    horario: 'L-D 24H',
    lat: 40.4,
    lon: -3.7,
    tipoVenta: 'P',
    remision: 'dm',
    precios: {
      gasolina95: 1.5, diesel: 1.4, dieselPremium: null, gasolina98: null, glp: null,
      gnc: null, gnl: null, dieselB: null, adblue: null,
    },
  };
}

test('toEstacionLigera devuelve exactamente las 13 claves', () => {
  const result = toEstacionLigera(makeStation('1'));
  assert.deepEqual(Object.keys(result).sort(), EXPECTED_KEYS);
});

test('toEstacionLigera copia cada valor de su campo', () => {
  const station = makeStation('7');
  const result = toEstacionLigera(station);
  for (const key of EXPECTED_KEYS) {
    assert.deepEqual(result[key as keyof typeof result], station[key as keyof Gasolinera], key);
  }
});

test('buildEstacionesPayload conserva fecha, número y orden', () => {
  const estaciones = [makeStation('3'), makeStation('1'), makeStation('2')];
  const result = buildEstacionesPayload({ fechaMiteco: '16/11/2026 13:06:34', estaciones });
  assert.equal(result.fechaMiteco, '16/11/2026 13:06:34');
  assert.deepEqual(result.estaciones.map((s: { id: string }) => s.id), ['3', '1', '2']);
});
