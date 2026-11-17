import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_FUELS,
  decodeDeltaSeries,
  encodeDeltaSeries,
  isoToMitecoDate,
  listMondays,
  mergeStationPartitions,
  milliToPrice,
  priceToMilli,
  yearOfIso,
  type StationPartitionFile,
} from '../src/lib/historicoFormat.ts';

test('conversión de precios', () => {
  assert.equal(priceToMilli(1.459), 1459);
  assert.equal(milliToPrice(1459), 1.459);
});

test('listMondays incluye el inicio y termina en el último lunes', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 4))), ['2016-01-04']);
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 20))), [
    '2016-01-04',
    '2016-01-11',
    '2016-01-18',
  ]);
});

test('listMondays cruza el año y falla si el inicio no es lunes', () => {
  const mondays = listMondays('2016-12-19', new Date(Date.UTC(2017, 0, 10)));
  assert.deepEqual(mondays, ['2016-12-19', '2016-12-26', '2017-01-02', '2017-01-09']);
  assert.throws(() => listMondays('2016-01-05', new Date(Date.UTC(2016, 1, 1))), RangeError);
});

test('listMondays devuelve vacío si toDate es anterior', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2015, 11, 31))), []);
});

test('isoToMitecoDate y yearOfIso', () => {
  assert.equal(isoToMitecoDate('2016-01-04'), '04-01-2016');
  assert.equal(yearOfIso('2017-01-02'), 2017);
});

test('delta: ida y vuelta con nulls al principio, en medio y al final', () => {
  const series = [null, 1459, 1460, null, null, 1500, 1490, null];
  const encoded = encodeDeltaSeries(series);
  assert.deepEqual(encoded, [null, 1459, 1, null, null, 1500, -10, null]);
  assert.deepEqual(decodeDeltaSeries(encoded), series);
  assert.deepEqual(decodeDeltaSeries(encodeDeltaSeries([])), []);
});

function buildPartition(year: number, weeks: string[], stations: StationPartitionFile['stations']) {
  const file: StationPartitionFile = { version: 1, idProvincia: '28', year, weeks, stations };
  return file;
}

test('mergeStationPartitions: años desordenados, ausencia y carburante omitido', () => {
  const y2016 = buildPartition(2016, ['2016-12-19', '2016-12-26'], {
    A: { gasolina95: [1400, 5], diesel: [1300, null] },
  });
  const y2017 = buildPartition(2017, ['2017-01-02', '2017-01-09'], {
    A: { gasolina95: [1410, 2] },
  });
  const y2018 = buildPartition(2018, ['2018-01-01'], { B: { diesel: [1000] } });

  const merged = mergeStationPartitions([y2018, y2017, y2016], 'A');
  assert.deepEqual(merged.weeks, ['2016-12-19', '2016-12-26', '2017-01-02', '2017-01-09', '2018-01-01']);
  assert.deepEqual(merged.series.gasolina95, [1400, 1405, 1410, 1412, null]);
  assert.deepEqual(merged.series.diesel, [1300, null, null, null, null]);
  assert.deepEqual(Object.keys(merged.series).sort(), [...HISTORY_FUELS].sort());
  assert.deepEqual(merged.series.dieselPremium, [null, null, null, null, null]);
});

test('listMondays con toDate a las 23:59 UTC incluye ese día si es lunes y no cuenta el domingo', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 11, 23, 59))), [
    '2016-01-04',
    '2016-01-11',
  ]);
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 10, 23, 59))), ['2016-01-04']);
});

test('listMondays falla si toDate es Invalid Date', () => {
  assert.throws(() => listMondays('2016-01-04', new Date(Number.NaN)), RangeError);
});

test('fechas imposibles o con formato erróneo lanzan RangeError', () => {
  assert.throws(() => isoToMitecoDate('04-01-2016'), RangeError);
  assert.throws(() => isoToMitecoDate('2016-02-31'), RangeError);
  assert.throws(() => yearOfIso('2016-13-45'), RangeError);
  assert.throws(() => listMondays('2016-02-31', new Date(Date.UTC(2016, 5, 1))), RangeError);
  assert.equal(yearOfIso('2016-02-29'), 2016);
  assert.throws(() => yearOfIso('2017-02-29'), RangeError);
});

test('mergeStationPartitions sin ficheros devuelve series vacías', () => {
  const merged = mergeStationPartitions([], 'A');
  assert.deepEqual(merged.weeks, []);
  for (const fuel of HISTORY_FUELS) assert.deepEqual(merged.series[fuel], []);
});

test('mergeStationPartitions: null al final de un año y valor al inicio del siguiente', () => {
  const y2016 = buildPartition(2016, ['2016-12-19', '2016-12-26'], { A: { diesel: [1300, null] } });
  const y2017 = buildPartition(2017, ['2017-01-02', '2017-01-09'], { A: { diesel: [1500, 3] } });
  assert.deepEqual(mergeStationPartitions([y2016, y2017], 'A').series.diesel, [1300, null, 1500, 1503]);
});

test('mergeStationPartitions falla si una serie no mide lo que las semanas', () => {
  const broken = buildPartition(2016, ['2016-12-19', '2016-12-26'], { A: { diesel: [1300] } });
  assert.throws(() => mergeStationPartitions([broken], 'A'), RangeError);
});
