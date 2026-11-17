import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gasFinderComputeStats,
  gasFinderFilterStations,
  gasFinderSortStations,
} from '../src/components/GasFinderLogic.ts';
import type { GasFinderCriteria, GasFinderStation } from '../src/components/GasFinderLogic.ts';
import type { EstacionLigera } from '../src/lib/stationPayload';

const MADRID = { lat: 40.4168, lon: -3.7038 };
const BASE_CRITERIA: GasFinderCriteria = {
  fuel: 'gasolina95',
  province: 'TODAS',
  brand: '',
  search: '',
  sortBy: 'price_asc',
  userCoords: null,
  radius: 15,
};

function makeStation(id: string, overrides: Partial<EstacionLigera> = {}): EstacionLigera {
  return {
    id,
    slug: `slug-${id}`,
    rotulo: 'GENERICA',
    direccion: 'Calle Mayor 1',
    cp: '28001',
    localidad: 'Madrid',
    municipio: 'Madrid',
    provincia: 'Madrid',
    provinciaSlug: 'madrid',
    horario: '24H',
    lat: MADRID.lat,
    lon: MADRID.lon,
    precios: { gasolina95: 1.5 },
    ...overrides,
  } as EstacionLigera;
}

function ids(list: GasFinderStation[]): string[] {
  return list.map((s) => s.id);
}

function filter(stations: EstacionLigera[], overrides: Partial<GasFinderCriteria>): string[] {
  return ids(gasFinderFilterStations(stations, { ...BASE_CRITERIA, ...overrides }));
}

test('filtra por combustible y excluye precio null o 0', () => {
  const stations = [
    makeStation('a'),
    makeStation('b', { precios: { gasolina95: null } } as Partial<EstacionLigera>),
    makeStation('c', { precios: { gasolina95: 0 } } as Partial<EstacionLigera>),
    makeStation('d', { precios: { diesel: 1.4 } } as Partial<EstacionLigera>),
  ];
  assert.deepEqual(filter(stations, {}), ['a']);
  assert.deepEqual(filter(stations, { fuel: 'diesel' }), ['d']);
});

test('filtra por provincia', () => {
  const stations = [makeStation('a'), makeStation('b', { provinciaSlug: 'sevilla' })];
  assert.deepEqual(filter(stations, { province: 'sevilla' }), ['b']);
  assert.deepEqual(filter(stations, { province: 'TODAS' }), ['a', 'b']);
});

test('filtra por marca con sus palabras clave y respeta marca desconocida', () => {
  const stations = [
    makeStation('a', { rotulo: 'REPSOL' }),
    makeStation('b', { rotulo: 'CEPSA Norte' }),
    makeStation('c'),
  ];
  assert.deepEqual(filter(stations, { brand: 'repsol' }), ['a']);
  assert.deepEqual(filter(stations, { brand: 'moeve' }), ['b']);
  assert.deepEqual(filter(stations, { brand: 'no-existe' }), ['a', 'b', 'c']);
});

test('busca en rótulo, dirección, municipio, localidad y código postal', () => {
  const stations = [
    makeStation('rot', { rotulo: 'Zeta Oil' }),
    makeStation('dir', { direccion: 'Avenida Zeta' }),
    makeStation('mun', { municipio: 'Villazeta' }),
    makeStation('loc', { localidad: 'Zetaville' }),
    makeStation('cp', { cp: '99999' }),
    makeStation('none'),
  ];
  assert.deepEqual(filter(stations, { search: '  ZETA ' }), ['rot', 'dir', 'mun', 'loc']);
  assert.deepEqual(filter(stations, { search: '99999' }), ['cp']);
});

test('filtra por radio GPS y añade la distancia', () => {
  const stations = [makeStation('near'), makeStation('far', { lat: 41.6488, lon: -0.8891 })];
  const result = gasFinderFilterStations(stations, { ...BASE_CRITERIA, userCoords: MADRID, radius: 15 });
  assert.deepEqual(ids(result), ['near']);
  assert.equal(result[0].distance, 0);
  assert.deepEqual(filter(stations, { userCoords: MADRID, radius: 500 }), ['near', 'far']);
});

test('filtrar no ordena la entrada', () => {
  const stations = [
    makeStation('b', { precios: { gasolina95: 1.9 } } as Partial<EstacionLigera>),
    makeStation('a', { precios: { gasolina95: 1.1 } } as Partial<EstacionLigera>),
  ];
  assert.deepEqual(filter(stations, { sortBy: 'price_asc' }), ['b', 'a']);
});

test('ordena por cada criterio', () => {
  const stations: GasFinderStation[] = [
    makeStation('b', { rotulo: 'Beta', precios: { gasolina95: 1.5 } } as Partial<EstacionLigera>),
    makeStation('a', { rotulo: 'Alfa', precios: { gasolina95: 1.9 } } as Partial<EstacionLigera>),
    makeStation('c', { rotulo: 'Ceta', precios: { gasolina95: 1.1 } } as Partial<EstacionLigera>),
  ];
  stations[0].distance = 3;
  stations[1].distance = 1;
  stations[2].distance = 2;
  const sort = (sortBy: GasFinderCriteria['sortBy'], userCoords = null as GasFinderCriteria['userCoords']) =>
    ids(gasFinderSortStations(stations, { fuel: 'gasolina95', sortBy, userCoords }));

  assert.deepEqual(sort('price_asc'), ['c', 'b', 'a']);
  assert.deepEqual(sort('price_desc'), ['a', 'b', 'c']);
  assert.deepEqual(sort('name_asc'), ['a', 'b', 'c']);
  assert.deepEqual(sort('distance_asc', MADRID), ['a', 'c', 'b']);
  assert.deepEqual(sort('distance_asc'), ['b', 'a', 'c']);
});

test('ordenar no muta la entrada y devuelve otra copia', () => {
  const stations: GasFinderStation[] = [
    makeStation('b', { precios: { gasolina95: 1.9 } } as Partial<EstacionLigera>),
    makeStation('a', { precios: { gasolina95: 1.1 } } as Partial<EstacionLigera>),
  ];
  const sorted = gasFinderSortStations(stations, { fuel: 'gasolina95', sortBy: 'price_asc', userCoords: null });
  assert.deepEqual(ids(stations), ['b', 'a']);
  assert.deepEqual(ids(sorted), ['a', 'b']);
  assert.notEqual(sorted, stations);
});

test('estadísticas: mínimo, máximo, media y total', () => {
  const stations: GasFinderStation[] = [
    makeStation('a', { precios: { gasolina95: 1.2 } } as Partial<EstacionLigera>),
    makeStation('b', { precios: { gasolina95: 1.5 } } as Partial<EstacionLigera>),
    makeStation('c', { precios: { gasolina95: null } } as Partial<EstacionLigera>),
  ];
  assert.deepEqual(gasFinderComputeStats(stations, 'gasolina95'), { total: 3, min: 1.2, max: 1.5, avg: 1.35 });
});

test('estadísticas: null si no hay precios', () => {
  assert.deepEqual(gasFinderComputeStats([], 'gasolina95'), { total: 0, min: null, max: null, avg: null });
});
