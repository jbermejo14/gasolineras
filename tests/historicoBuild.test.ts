import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AreaHistoryAccumulator,
  buildProvinceTable,
  buildStationPartitionsForYear,
  buildWeekSnapshot,
} from '../src/lib/historicoBuild.ts';
import { decodeDeltaSeries } from '../src/lib/historicoFormat.ts';
import type { WeekSnapshot, WeekStationRecord } from '../src/lib/historicoFormat.ts';

const LISTING = [
  { IDPovincia: '28', IDCCAA: '13', Provincia: 'MADRID', CCAA: 'Madrid' },
  { IDPovincia: '08', IDCCAA: '09', Provincia: 'BARCELONA', CCAA: 'Cataluña' },
  { IDPovincia: '01', IDCCAA: '16', Provincia: 'ARABA/ÁLAVA', CCAA: 'País Vasco' },
];

function station(
  id: string,
  overrides: Partial<WeekStationRecord> & { g95?: number | null; diesel?: number | null } = {}
): WeekStationRecord {
  return {
    id,
    idProvincia: overrides.idProvincia ?? '28',
    idCCAA: overrides.idCCAA ?? '13',
    rotulo: overrides.rotulo ?? 'REPSOL',
    prices: {
      gasolina95: overrides.g95 ?? null,
      diesel: overrides.diesel ?? null,
      gasolina98: null,
      dieselPremium: null,
    },
  };
}

function snapshot(date: string, stations: WeekStationRecord[]): WeekSnapshot {
  return { date, stations };
}

test('buildWeekSnapshot convierte precios, descarta sin IDEESS y anula inválidos', () => {
  const raw = JSON.parse(readFileSync('tests/fixtures/miteco-sample.json', 'utf8'));
  const result = buildWeekSnapshot(raw, '2026-11-16');
  assert.equal(result.date, '2026-11-16');
  assert.deepEqual(
    result.stations.map((s) => s.id),
    ['1001', '1002', '1003', '2001', '9998', '9997', '1004']
  );
  const first = result.stations[0];
  assert.deepEqual(first.prices, { gasolina95: 1500, diesel: 1450, gasolina98: 1650, dieselPremium: 1550 });
  assert.equal(first.idProvincia, '28');
  assert.equal(first.rotulo, 'REPSOL');
  const crazy = result.stations.find((s) => s.id === '1004');
  assert.deepEqual(crazy?.prices, { gasolina95: null, diesel: null, gasolina98: null, dieselPremium: null });
  assert.equal(result.stations[1].prices.gasolina98, null);
});

test('buildWeekSnapshot tolera respuesta vacía', () => {
  assert.deepEqual(buildWeekSnapshot({}, '2016-01-04').stations, []);
});

test('buildProvinceTable genera nombre, slug y comunidad', () => {
  const table = buildProvinceTable(LISTING);
  assert.deepEqual(table.get('28'), {
    idProvincia: '28',
    name: 'Madrid',
    slug: 'madrid',
    comunidadSlug: 'comunidad-de-madrid',
  });
  assert.equal(table.get('01')?.name, 'Araba/Álava');
  assert.equal(table.get('01')?.slug, 'araba-alava');
  const unknown = buildProvinceTable([{ IDPovincia: '99', IDCCAA: '77', Provincia: 'X' }]);
  assert.equal(unknown.get('99')?.comunidadSlug, null);
});

test('el acumulador calcula media redondeada, mínimo y recuento', () => {
  const weeks = ['2016-01-04', '2016-01-11'];
  const acc = new AreaHistoryAccumulator(weeks, buildProvinceTable(LISTING));
  acc.addWeek(
    snapshot('2016-01-04', [
      station('a', { g95: 1000, diesel: 1100 }),
      station('b', { g95: 1001 }),
      station('c', { g95: null }),
    ])
  );
  const { index, areas } = acc.build();
  const spain = areas.find((file) => file.area.kind === 'espana');
  assert.ok(spain);
  assert.deepEqual(spain.area.series.gasolina95.avg, [1001, null]);
  assert.deepEqual(spain.area.series.gasolina95.min, [1000, null]);
  assert.deepEqual(spain.area.series.gasolina95.count, [2, 0]);
  assert.deepEqual(spain.area.series.diesel.avg, [1100, null]);
  assert.deepEqual(spain.area.series.gasolina98.count, [0, 0]);
  assert.deepEqual(index.weeks, weeks);
  assert.equal(index.version, 1);
});

test('semana sin snapshot queda en null y 0', () => {
  const acc = new AreaHistoryAccumulator(['2016-01-04', '2016-01-11'], buildProvinceTable(LISTING));
  acc.addWeek(snapshot('2016-01-11', [station('a', { g95: 1200 })]));
  const spain = acc.build().areas[0];
  assert.deepEqual(spain.area.series.gasolina95.avg, [null, 1200]);
  assert.deepEqual(spain.area.series.gasolina95.count, [0, 1]);
});

test('marca por rótulo; provincia y comunidad desconocidas solo cuentan en España y marca', () => {
  const acc = new AreaHistoryAccumulator(['2016-01-04'], buildProvinceTable(LISTING));
  acc.addWeek(
    snapshot('2016-01-04', [
      station('a', { g95: 1000, rotulo: 'REPSOL' }),
      station('b', { g95: 2000, rotulo: 'CEPSA / MOEVE', idProvincia: '77', idCCAA: '88' }),
      station('c', { g95: 3000, rotulo: 'SIN MARCA CONOCIDA XYZ' }),
    ])
  );
  const { index, areas } = acc.build();
  const find = (kind: string, slug: string) =>
    areas.find((file) => file.area.kind === kind && file.area.slug === slug);
  assert.deepEqual(find('espana', 'espana')?.area.series.gasolina95.count, [3]);
  assert.deepEqual(find('marca', 'repsol')?.area.series.gasolina95.avg, [1000]);
  assert.deepEqual(find('marca', 'moeve')?.area.series.gasolina95.avg, [2000]);
  assert.deepEqual(find('comunidad', 'comunidad-de-madrid')?.area.series.gasolina95.count, [2]);
  assert.deepEqual(find('provincia', 'madrid')?.area.series.gasolina95.avg, [2000]);
  assert.equal(find('provincia', 'madrid')?.area.parentSlug, 'comunidad-de-madrid');
  assert.equal(index.areas.length, areas.length);
});

test('las áreas sin datos se omiten y el orden del índice es el definido', () => {
  const acc = new AreaHistoryAccumulator(['2016-01-04'], buildProvinceTable(LISTING));
  acc.addWeek(
    snapshot('2016-01-04', [
      station('a', { g95: 1000 }),
      station('b', { g95: 1000, idProvincia: '08', idCCAA: '09', rotulo: 'BONAREA' }),
      station('c', { g95: 1000, idProvincia: '01', idCCAA: '16' }),
    ])
  );
  const keys = acc.build().index.areas.map((area) => `${area.kind}:${area.slug}`);
  assert.deepEqual(keys, [
    'espana:espana',
    'comunidad:cataluna',
    'comunidad:comunidad-de-madrid',
    'comunidad:pais-vasco',
    'provincia:araba-alava',
    'provincia:barcelona',
    'provincia:madrid',
    'marca:repsol',
    'marca:bonarea',
  ]);
});

test('addWeek lanza RangeError con fecha ajena o repetida', () => {
  const acc = new AreaHistoryAccumulator(['2016-01-04'], new Map());
  assert.throws(() => acc.addWeek(snapshot('2016-01-11', [])), RangeError);
  acc.addWeek(snapshot('2016-01-04', []));
  assert.throws(() => acc.addWeek(snapshot('2016-01-04', [])), RangeError);
});

test('particiones: gasolinera presente en parte del año y carburante omitido', () => {
  const weeks = ['2016-01-04', '2016-01-11', '2016-01-18', '2016-01-25'];
  const snapshots = [
    snapshot('2016-01-04', [station('a', { g95: 1000 })]),
    snapshot('2016-01-18', [
      station('a', { g95: 1010 }),
      station('b', { g95: 900, diesel: 950, idProvincia: '08' }),
    ]),
  ];
  const partitions = buildStationPartitionsForYear(2016, weeks, snapshots);
  assert.deepEqual(
    partitions.map((p) => p.idProvincia),
    ['08', '28']
  );
  const madrid = partitions[1];
  assert.equal(madrid.year, 2016);
  assert.deepEqual(madrid.weeks, weeks);
  assert.deepEqual(Object.keys(madrid.stations.a), ['gasolina95']);
  assert.deepEqual(madrid.stations.a.gasolina95, [1000, null, 1010, null]);
  const barcelona = partitions[0];
  assert.deepEqual(decodeDeltaSeries(barcelona.stations.b.diesel ?? []), [null, null, 950, null]);
  assert.equal(barcelona.stations.b.gasolina98, undefined);
});

test('particiones: RangeError con fecha ajena al año', () => {
  assert.throws(
    () => buildStationPartitionsForYear(2016, ['2016-01-04'], [snapshot('2016-01-11', [])]),
    RangeError
  );
});
