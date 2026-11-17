import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as clustering from '../src/lib/stationClustering.ts';

const { padBounds, filterPointsInBounds, shouldCluster, clusterPoints, mergeOverlappingClusters, minNonNull } =
  clustering;

const fakeProject = (lat: number, lon: number) => ({ x: lon * 100, y: -lat * 100 });
const CELL = 64;

test('padBounds amplía por cada lado', () => {
  const result = padBounds({ south: 0, west: 0, north: 10, east: 20 }, 0.5);
  assert.deepEqual(result, { south: -5, west: -10, north: 15, east: 30 });
});

test('padBounds lanza RangeError con ratio negativo', () => {
  assert.throws(() => padBounds({ south: 0, west: 0, north: 1, east: 1 }, -0.1), RangeError);
  assert.throws(() => padBounds({ south: 0, west: 0, north: 1, east: 1 }, Number.NaN), RangeError);
});

test('padBounds con ratio 0 devuelve los mismos límites', () => {
  const bounds = { south: 1, west: 2, north: 3, east: 4 };
  assert.deepEqual(padBounds(bounds, 0), bounds);
});

test('clusterPoints usa Math.floor con píxeles negativos', () => {
  const [cluster] = clusterPoints([{ lat: 0.1, lon: -0.1 }], fakeProject, CELL);
  assert.equal(cluster.key, '-1:-1');
});

test('filterPointsInBounds incluye bordes, excluye fuera y conserva orden', () => {
  const bounds = { south: 0, west: 0, north: 10, east: 10 };
  const points = [
    { lat: 10, lon: 10, n: 'a' },
    { lat: 11, lon: 5, n: 'fuera' },
    { lat: 0, lon: 0, n: 'b' },
    { lat: 5, lon: -1, n: 'fuera2' },
    { lat: 5, lon: 5, n: 'c' },
  ];
  assert.deepEqual(filterPointsInBounds(points, bounds).map((p: { n: string }) => p.n), ['a', 'b', 'c']);
});

test('shouldCluster respeta el zoom máximo', () => {
  assert.equal(shouldCluster(14), true);
  assert.equal(shouldCluster(15), false);
});

test('clusterPoints agrupa puntos de la misma celda', () => {
  const points = [
    { lat: -0.1, lon: 0.1 },
    { lat: -0.3, lon: 0.3 },
  ];
  const clusters = clusterPoints(points, fakeProject, CELL);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 2);
  assert.equal(clusters[0].lat, -0.2);
  assert.equal(clusters[0].lon, 0.2);
  assert.deepEqual(clusters[0].bounds, { south: -0.3, west: 0.1, north: -0.1, east: 0.3 });
  assert.equal(clusters[0].key, '0:0');
});

test('clusterPoints separa celdas distintas en orden de aparición', () => {
  const points = [
    { lat: 0, lon: 5 },
    { lat: 0, lon: 0 },
  ];
  const clusters = clusterPoints(points, fakeProject, CELL);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].members[0], points[0]);
  assert.equal(clusters[1].members[0], points[1]);
});

test('clusterPoints con lista vacía devuelve []', () => {
  assert.deepEqual(clusterPoints([], fakeProject, CELL), []);
});

test('clusterPoints lanza RangeError con celda 0', () => {
  assert.throws(() => clusterPoints([{ lat: 0, lon: 0 }], fakeProject, 0), RangeError);
});

const MIN_SEPARATION = 56;
const FLOAT_TOLERANCE = 1e-9;

type TestPoint = { lat: number; lon: number };

/** Construye un grupo de prueba con clave propia; cada punto es [lat, lon]. */
function makeTestCluster(key: string, coordinates: Array<[number, number]>) {
  const members: TestPoint[] = coordinates.map(([lat, lon]) => ({ lat, lon }));
  const clusters = clusterPoints(members, fakeProject, Number.MAX_SAFE_INTEGER);
  assert.equal(clusters.length, 1, 'makeTestCluster: los puntos deben caer en una sola celda');
  return { ...clusters[0], key };
}

test('mergeOverlappingClusters fusiona grupos cercanos y conserva la key del mayor', () => {
  const big = makeTestCluster('big', [[0, 0], [0, 0]]);
  const small = makeTestCluster('small', [[0.1, 0.3]]);
  const merged = mergeOverlappingClusters([small, big], fakeProject, MIN_SEPARATION);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].key, 'big');
  assert.equal(merged[0].count, 3);
  assert.equal(merged[0].members.length, 3);
  assert.ok(Math.abs(merged[0].lat - 0.1 / 3) < FLOAT_TOLERANCE);
  assert.ok(Math.abs(merged[0].lon - 0.1) < FLOAT_TOLERANCE);
  assert.deepEqual(merged[0].bounds, { south: 0, west: 0, north: 0.1, east: 0.3 });
});

test('mergeOverlappingClusters no fusiona grupos alejados', () => {
  const left = makeTestCluster('left', [[0, 0]]);
  const right = makeTestCluster('right', [[0, 1]]);
  const merged = mergeOverlappingClusters([left, right], fakeProject, MIN_SEPARATION);
  assert.deepEqual(merged.map((cluster: { key: string }) => cluster.key), ['left', 'right']);
});

test('mergeOverlappingClusters deja que el grupo con más count absorba, aunque llegue después', () => {
  const first = makeTestCluster('first', [[0, 0]]);
  const second = makeTestCluster('second', [[0, 0.1], [0, 0.1]]);
  const merged = mergeOverlappingClusters([first, second], fakeProject, MIN_SEPARATION);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].key, 'second');
});

test('mergeOverlappingClusters usa el centroide actualizado en las comparaciones siguientes', () => {
  const big = makeTestCluster('big', [[0, 0], [0, 0], [0, 0]]);
  const near = makeTestCluster('near', [[0, 0.5]]);
  const chained = makeTestCluster('chained', [[0, 0.8]]);
  // near (x=50) se fusiona con big y el centroide pasa a x=12.5; chained (x=80) queda a 67,5 px: no se fusiona.
  const merged = mergeOverlappingClusters([big, near, chained], fakeProject, MIN_SEPARATION);
  assert.deepEqual(merged.map((cluster: { key: string }) => cluster.key), ['big', 'chained']);
});

test('mergeOverlappingClusters con lista vacía devuelve []', () => {
  assert.deepEqual(mergeOverlappingClusters([], fakeProject, MIN_SEPARATION), []);
});

test('mergeOverlappingClusters no muta la entrada', () => {
  const big = makeTestCluster('big', [[0, 0], [0, 0]]);
  const small = makeTestCluster('small', [[0, 0.1]]);
  const input = [small, big];
  const snapshot = structuredClone(input);
  mergeOverlappingClusters(input, fakeProject, MIN_SEPARATION);
  assert.deepEqual(input, snapshot);
  assert.equal(input[0], small);
});

test('mergeOverlappingClusters lanza RangeError con separación negativa o NaN', () => {
  const cluster = makeTestCluster('a', [[0, 0]]);
  assert.throws(() => mergeOverlappingClusters([cluster], fakeProject, -1), RangeError);
  assert.throws(() => mergeOverlappingClusters([cluster], fakeProject, Number.NaN), RangeError);
});

test('mergeOverlappingClusters con separación 0 no fusiona posiciones distintas', () => {
  const a = makeTestCluster('a', [[0, 0]]);
  const b = makeTestCluster('b', [[0, 0.01]]);
  assert.equal(mergeOverlappingClusters([a, b], fakeProject, 0).length, 2);
});

test('minNonNull', () => {
  assert.equal(minNonNull([null, 1.5, 1.2]), 1.2);
  assert.equal(minNonNull([null]), null);
  assert.equal(minNonNull([]), null);
});
