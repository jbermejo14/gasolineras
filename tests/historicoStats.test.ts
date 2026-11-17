import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AreaFuelSeries, AreaHistory, AreaKind, FuelSeries } from '../src/lib/historicoFormat.ts';
import { buildAreaIntro, formatIsoDateEs, formatMilliEuro, summarizeSeries } from '../src/lib/historicoStats.ts';

const WEEK_MILLIS = 7 * 86_400_000;
const FIRST_MONDAY = Date.UTC(2020, 0, 6);

function weeksFrom(count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(FIRST_MONDAY + i * WEEK_MILLIS).toISOString().slice(0, 10));
}

function fuelSeries(avg: FuelSeries): AreaFuelSeries {
  return { avg, min: avg, count: avg.map((v) => (v === null ? 0 : 1)) };
}

function makeArea(kind: AreaKind, name: string, g95: FuelSeries, diesel: FuelSeries): AreaHistory {
  const empty = fuelSeries(g95.map(() => null));
  return {
    kind,
    slug: name.toLowerCase(),
    name,
    series: {
      gasolina95: fuelSeries(g95),
      diesel: fuelSeries(diesel),
      gasolina98: empty,
      dieselPremium: empty,
    },
  };
}

describe('summarizeSeries', () => {
  it('serie vacía: todo null y sin medias', () => {
    const summary = summarizeSeries([], []);
    assert.deepEqual(summary, {
      latest: null,
      yearAgo: null,
      changePct: null,
      max: null,
      min: null,
      yearlyAverages: [],
    });
  });

  it('ignora nulls al final y calcula último, máximo y mínimo', () => {
    const weeks = weeksFrom(4);
    const summary = summarizeSeries(weeks, [1500, 1600, 1400, null]);
    assert.deepEqual(summary.latest, { date: weeks[2], value: 1400 });
    assert.deepEqual(summary.max, { date: weeks[1], value: 1600 });
    assert.deepEqual(summary.min, { date: weeks[2], value: 1400 });
  });

  it('empates: gana la primera fecha', () => {
    const weeks = weeksFrom(4);
    const summary = summarizeSeries(weeks, [1500, 1700, 1700, 1500]);
    assert.equal(summary.max?.date, weeks[1]);
    assert.equal(summary.min?.date, weeks[0]);
  });

  it('yearAgo y changePct con un decimal', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1500;
    values[7] = 1400;
    const summary = summarizeSeries(weeks, values);
    assert.deepEqual(summary.yearAgo, { date: weeks[7], value: 1400 });
    assert.equal(summary.changePct, 7.1);
  });

  it('yearAgo elige el valor más cercano a 52 semanas dentro de ±2', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1000;
    values[5] = 900;
    values[8] = 950;
    assert.equal(summarizeSeries(weeks, values).yearAgo?.date, weeks[8]);
  });

  it('yearAgo ausente si no hay valor entre 50 y 54 semanas', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1000;
    values[0] = 900;
    values[20] = 950;
    const summary = summarizeSeries(weeks, values);
    assert.equal(summary.yearAgo, null);
    assert.equal(summary.changePct, null);
  });

  it('medias anuales de los valores no nulos', () => {
    const weeks = ['2020-12-21', '2020-12-28', '2021-01-04', '2021-01-11'];
    const summary = summarizeSeries(weeks, [1000, null, 1100, 1201]);
    assert.deepEqual(summary.yearlyAverages, [
      { year: 2020, avg: 1000, weeks: 1 },
      { year: 2021, avg: 1151, weeks: 2 },
    ]);
  });
});

describe('formatos', () => {
  it('formatMilliEuro', () => {
    assert.equal(formatMilliEuro(1459), '1,459 €/l');
    assert.equal(formatMilliEuro(990), '0,990 €/l');
  });

  it('formatIsoDateEs', () => {
    assert.equal(formatIsoDateEs('2022-07-04'), '4 de julio de 2022');
    assert.equal(formatIsoDateEs('2016-01-04'), '4 de enero de 2016');
    assert.equal(formatIsoDateEs('2023-12-25'), '25 de diciembre de 2023');
  });

  it('formatIsoDateEs rechaza fechas inválidas', () => {
    assert.throws(() => formatIsoDateEs('04/07/2022'), RangeError);
    assert.throws(() => formatIsoDateEs('2022-13-01'), RangeError);
  });
});

describe('buildAreaIntro', () => {
  const weeks = weeksFrom(60);
  const g95 = weeks.map((_, i) => (i === 7 ? 1400 : i === 30 ? 1800 : 1500));
  const diesel = weeks.map((_, i) => (i === 7 ? 1600 : 1500));
  const spain = makeArea(
    'espana',
    'España',
    weeks.map(() => 1450),
    weeks.map(() => 1500),
  );

  it('incluye cifras de G95 y Diésel, variación y máximo con fecha', () => {
    const area = makeArea('provincia', 'Madrid', g95, diesel);
    const intro = buildAreaIntro(area, weeks, spain);
    assert.match(intro, /provincia de Madrid/);
    assert.ok(intro.includes('1,500 €/l'));
    assert.ok(intro.includes(formatIsoDateEs(weeks[59])));
    assert.ok(intro.includes('1,800 €/l'));
    assert.ok(intro.includes(formatIsoDateEs(weeks[30])));
    assert.ok(intro.includes('un 7,1 % más'));
    assert.ok(intro.includes('un 6,2 % menos'));
    assert.ok(intro.includes('5,0 céntimos por encima de la media nacional'));
    assert.ok(intro.includes('en la media nacional'));
  });

  it('no menciona España cuando el área es España', () => {
    const area = makeArea('espana', 'España', g95, diesel);
    const intro = buildAreaIntro(area, weeks, spain);
    assert.ok(!intro.includes('nacional'));
    assert.ok(!intro.includes('céntimos'));
  });

  it('varía según el tipo de área', () => {
    const comunidad = buildAreaIntro(makeArea('comunidad', 'Galicia', g95, diesel), weeks, null);
    const marca = buildAreaIntro(makeArea('marca', 'Repsol', g95, diesel), weeks, null);
    assert.match(comunidad, /comunidad de Galicia/);
    assert.match(marca, /gasolineras Repsol/);
    assert.ok(!comunidad.includes('nacional'));
  });

  it('omite un carburante sin datos sin romper la frase', () => {
    const none = weeks.map(() => null);
    const intro = buildAreaIntro(makeArea('provincia', 'Soria', g95, none), weeks, spain);
    assert.ok(intro.includes('gasolina 95'));
    assert.ok(!intro.includes('diésel'));
    assert.ok(!intro.includes('undefined'));
  });

  it('sin datos de ningún carburante devuelve una frase neutra', () => {
    const none = weeks.map(() => null);
    const intro = buildAreaIntro(makeArea('provincia', 'Soria', none, none), weeks, spain);
    assert.match(intro, /todavía no hay datos/);
  });
});
