import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAnyPrice,
  listMissingYears,
  listRecentYears,
  loadPartitions,
  mergeStationHistory,
} from '../src/lib/stationHistoryLoader.ts';
import type { StationPartitionFile } from '../src/lib/historicoFormat.ts';

function makePartition(year: number, deltas: (number | null)[] | null): StationPartitionFile {
  return {
    version: 1,
    idProvincia: '28',
    year,
    weeks: [`${year}-01-04`, `${year}-01-11`],
    stations: deltas ? { '100': { gasolina95: deltas } } : {},
  };
}

test('listRecentYears: año anterior y actual', () => {
  assert.deepEqual(listRecentYears(2026), [2025, 2026]);
});

test('listMissingYears: desde 2016 sin los ya pedidos', () => {
  assert.deepEqual(listMissingYears(2026, [2025, 2026]), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(listMissingYears(2017, [2016, 2017]), []);
});

test('loadPartitions: 404 (null) se omite', async () => {
  const files = await loadPartitions([2025, 2026], async (year) => (year === 2025 ? null : makePartition(year, [1500, 5])));
  assert.deepEqual(files.map((file) => file.year), [2026]);
});

test('loadPartitions: respeta el límite de concurrencia', async () => {
  let active = 0;
  let peak = 0;
  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const files = await loadPartitions(years, async (year) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return makePartition(year, [1500, 5]);
  });
  assert.equal(peak, 4);
  assert.equal(files.length, years.length);
});

test('loadPartitions: conserva el orden de los años pedidos', async () => {
  const files = await loadPartitions([2020, 2018, 2019], async (year) => {
    await new Promise((resolve) => setTimeout(resolve, 10 - (year - 2018) * 4));
    return makePartition(year, [1500, 5]);
  });
  assert.deepEqual(files.map((file) => file.year), [2020, 2018, 2019]);
});

test('loadPartitions: propaga el error', async () => {
  await assert.rejects(
    loadPartitions([2025, 2026], async (year) => {
      if (year === 2026) throw new Error('HTTP 500');
      return makePartition(year, [1500, 5]);
    }),
    /HTTP 500/
  );
});

test('mergeStationHistory: une ordenado por año y decodifica', () => {
  const merged = mergeStationHistory([makePartition(2026, [1600, 10]), makePartition(2025, [1500, 5])], '100');
  assert.deepEqual(merged.weeks, ['2025-01-04', '2025-01-11', '2026-01-04', '2026-01-11']);
  assert.deepEqual(merged.series.gasolina95, [1500, 1505, 1600, 1610]);
  assert.deepEqual(merged.series.diesel, [null, null, null, null]);
});

test('mergeStationHistory: partición corrupta lanza RangeError', () => {
  assert.throws(() => mergeStationHistory([makePartition(2025, [1500])], '100'), RangeError);
});

test('hasAnyPrice: detecta datos y ausencia de datos', () => {
  assert.equal(hasAnyPrice(mergeStationHistory([makePartition(2025, [1500, 5])], '100')), true);
  assert.equal(hasAnyPrice(mergeStationHistory([makePartition(2025, null)], '100')), false);
  assert.equal(hasAnyPrice(mergeStationHistory([], '100')), false);
});
