import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as clustering from '../src/lib/stationClustering.ts';

const { padBounds, filterPointsInBounds, shouldCluster, clusterPoints, minNonNull } = clustering;

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

test('minNonNull', () => {
  assert.equal(minNonNull([null, 1.5, 1.2]), 1.2);
  assert.equal(minNonNull([null]), null);
  assert.equal(minNonNull([]), null);
});
