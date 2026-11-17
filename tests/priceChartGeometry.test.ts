import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChartGeometry, formatPriceLabel } from '../src/lib/priceChartGeometry.ts';
import type { ChartInput } from '../src/lib/priceChartGeometry.ts';

const PADDING = { top: 10, right: 20, bottom: 30, left: 50 };

function chartInput(overrides: Partial<ChartInput> = {}): ChartInput {
  return {
    weeks: ['2022-01-03', '2022-01-10', '2022-01-17', '2022-01-24', '2022-01-31'],
    series: [{ fuel: 'gasolina95', values: [1500, 1600, 1700, 1600, 1500] }],
    width: 400,
    height: 240,
    padding: PADDING,
    ...overrides,
  };
}

test('formatPriceLabel usa coma y dos decimales', () => {
  assert.equal(formatPriceLabel(1500), '1,50 €');
  assert.equal(formatPriceLabel(1459), '1,46 €');
});

test('escalas en los bordes: mínimo abajo, máximo arriba, primera y última semana en los extremos', () => {
  const geometry = buildChartGeometry(chartInput());
  const first = geometry.pointAt(0, 'gasolina95');
  const last = geometry.pointAt(4, 'gasolina95');
  const peak = geometry.pointAt(2, 'gasolina95');
  assert.equal(first?.x, PADDING.left);
  assert.equal(last?.x, 400 - PADDING.right);
  const ticks = geometry.yTicks;
  assert.equal(ticks[0].y, 240 - PADDING.bottom);
  assert.equal(ticks[ticks.length - 1].y, PADDING.top);
  assert.equal(ticks[0].value, 1500);
  assert.equal(ticks[ticks.length - 1].value, 1700);
  assert.equal(first?.y, 240 - PADDING.bottom);
  assert.equal(peak?.y, PADDING.top);
});

test('un valor null corta la línea con un nuevo M', () => {
  const geometry = buildChartGeometry(
    chartInput({ series: [{ fuel: 'diesel', values: [1500, 1600, null, 1700, 1600] }] })
  );
  const d = geometry.paths[0].d;
  assert.equal(geometry.paths[0].fuel, 'diesel');
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal((d.match(/L/g) ?? []).length, 2);
  assert.equal(geometry.pointAt(2, 'diesel'), null);
});

test('serie toda null: path vacío y dominio por defecto', () => {
  const geometry = buildChartGeometry(
    chartInput({ series: [{ fuel: 'diesel', values: [null, null, null, null, null] }] })
  );
  assert.equal(geometry.paths[0].d, '');
  assert.ok(geometry.yTicks.length >= 4);
});

test('ticks Y redondos, entre 4 y 6, múltiplos de 50 y ordenados', () => {
  const inputs = [
    [1459, 1480],
    [1100, 2150],
    [1300, 1300],
    [900, 2200],
  ];
  for (const [low, high] of inputs) {
    const geometry = buildChartGeometry(
      chartInput({ series: [{ fuel: 'gasolina95', values: [low, high, low, high, low] }] })
    );
    const ticks = geometry.yTicks;
    assert.ok(ticks.length >= 4 && ticks.length <= 6, `${low}-${high}: ${ticks.length} marcas`);
    assert.ok(ticks.every((tick) => tick.value % 50 === 0));
    assert.ok(ticks[0].value <= low && ticks[ticks.length - 1].value >= high);
    for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i].y < ticks[i - 1].y);
  }
});

test('indexAtX en bordes, centro y fuera de rango', () => {
  const geometry = buildChartGeometry(chartInput());
  assert.equal(geometry.indexAtX(PADDING.left), 0);
  assert.equal(geometry.indexAtX(400 - PADDING.right), 4);
  assert.equal(geometry.indexAtX((PADDING.left + 400 - PADDING.right) / 2), 2);
  assert.equal(geometry.indexAtX(-100), 0);
  assert.equal(geometry.indexAtX(10_000), 4);
});

test('una sola semana no divide por cero', () => {
  const geometry = buildChartGeometry(
    chartInput({ weeks: ['2022-01-03'], series: [{ fuel: 'diesel', values: [1500] }] })
  );
  assert.equal(geometry.indexAtX(200), 0);
  assert.equal(geometry.pointAt(0, 'diesel')?.x, PADDING.left);
});

test('xTicks: meses abreviados si el rango es menor de 18 meses', () => {
  const geometry = buildChartGeometry(
    chartInput({
      weeks: ['2022-01-03', '2022-02-07', '2022-03-07', '2022-04-04'],
      series: [{ fuel: 'diesel', values: [1500, 1500, 1500, 1500] }],
      width: 800,
    })
  );
  assert.deepEqual(
    geometry.xTicks.map((tick) => tick.label),
    ['ene', 'feb', 'mar', 'abr']
  );
});

test('xTicks: años si el rango es de 18 meses o más', () => {
  const geometry = buildChartGeometry(
    chartInput({
      weeks: ['2020-06-01', '2021-01-04', '2022-01-03', '2022-12-26'],
      series: [{ fuel: 'diesel', values: [1500, 1500, 1500, 1500] }],
      width: 800,
    })
  );
  assert.deepEqual(
    geometry.xTicks.map((tick) => tick.label),
    ['2020', '2021', '2022']
  );
});

test('RangeError si el tamaño no supera el relleno', () => {
  assert.throws(() => buildChartGeometry(chartInput({ width: 70 })), RangeError);
  assert.throws(() => buildChartGeometry(chartInput({ height: 40 })), RangeError);
});
