import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Gasolinera, PreciosCombustible } from '../src/lib/miteco.ts';
import {
  distanceKm,
  formatEuros,
  formatKm,
  stationLabel,
  municipalityRank,
  nearbyStations,
  NEARBY_LIMIT,
  NEARBY_MAX_KM,
  stationSummary,
} from '../src/lib/stationInsights.ts';

const NO_PRICES: PreciosCombustible = {
  gasolina95: null,
  diesel: null,
  dieselPremium: null,
  gasolina98: null,
  glp: null,
  gnc: null,
  gnl: null,
  dieselB: null,
  adblue: null,
};

/** Un grado de latitud son unos 111 km: sirve para colocar estaciones a distancias conocidas. */
const KM_PER_LAT_DEGREE = 111.19;

function makeStation(id: string, prices: Partial<PreciosCombustible>, northKm = 0): Gasolinera {
  return {
    id,
    slug: `est-${id}`,
    rotulo: `REPSOL ${id}`,
    direccion: 'CALLE X',
    cp: '13300',
    localidad: 'VALDEPEÑAS',
    idMunicipio: '1',
    municipio: 'Valdepeñas',
    municipioSlug: 'valdepenas',
    idProvincia: '13',
    provincia: 'Ciudad Real',
    provinciaSlug: 'ciudad-real',
    horario: 'L-D: 24H',
    lat: 38.76 + northKm / KM_PER_LAT_DEGREE,
    lon: -3.38,
    tipoVenta: 'P',
    remision: 'dm',
    precios: { ...NO_PRICES, ...prices },
  };
}

test('distanceKm: cero entre el mismo punto y ~111 km por grado de latitud', () => {
  const origin = { lat: 40, lon: -3 };
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(Math.abs(distanceKm(origin, { lat: 41, lon: -3 }) - KM_PER_LAT_DEGREE) < 0.5);
});

test('formatEuros usa dos decimales y coma', () => {
  assert.equal(formatEuros(81.7), '81,70 €');
  assert.equal(formatEuros(4.4), '4,40 €');
  assert.equal(formatEuros(0), '0,00 €');
});

test('municipalityRank ordena de barata a cara y los empates comparten puesto', () => {
  const a = makeStation('1', { diesel: 1.4 });
  const b = makeStation('2', { diesel: 1.5 });
  const c = makeStation('3', { diesel: 1.5 });
  const d = makeStation('4', { diesel: 1.6 });
  const all = [a, b, c, d];
  assert.deepEqual(municipalityRank(a, all, 'diesel'), { position: 1, total: 4 });
  assert.deepEqual(municipalityRank(b, all, 'diesel'), { position: 2, total: 4 });
  assert.deepEqual(municipalityRank(c, all, 'diesel'), { position: 2, total: 4 });
  assert.deepEqual(municipalityRank(d, all, 'diesel'), { position: 4, total: 4 });
});

test('municipalityRank ignora estaciones sin precio y devuelve null si la propia no lo tiene', () => {
  const a = makeStation('1', { diesel: 1.4 });
  const noDiesel = makeStation('2', { gasolina95: 1.5 });
  assert.deepEqual(municipalityRank(a, [a, noDiesel], 'diesel'), { position: 1, total: 1 });
  assert.equal(municipalityRank(noDiesel, [a, noDiesel], 'diesel'), null);
});

test('nearbyStations ordena por distancia, excluye la propia, respeta radio y límite', () => {
  const origin = makeStation('0', {});
  const near = makeStation('1', {}, 2);
  const mid = makeStation('2', {}, 5);
  const far = makeStation('3', {}, NEARBY_MAX_KM + 5);
  const result = nearbyStations(origin, [far, mid, origin, near]);
  assert.deepEqual(result.map((entry) => entry.station.id), ['1', '2']);
  assert.ok(result[0].km < result[1].km);

  const many = Array.from({ length: NEARBY_LIMIT + 4 }, (_, i) => makeStation(`m${i}`, {}, i + 1));
  assert.equal(nearbyStations(origin, many).length, NEARBY_LIMIT);
  assert.equal(nearbyStations(origin, many, { limit: 2 }).length, 2);
  assert.equal(nearbyStations(origin, many, { maxKm: 3.5 }).length, 3);
});

test('stationSummary caso general: puesto en diésel y gasolina 95 y coste de 50 litros', () => {
  const me = makeStation('1', { diesel: 1.5, gasolina95: 1.6 });
  const others = [
    makeStation('2', { diesel: 1.4, gasolina95: 1.5 }),
    makeStation('3', { diesel: 1.45, gasolina95: 1.7 }),
  ];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Es la gasolinera más cara de las 3 de Valdepeñas en diésel y la 2\.ª en gasolina 95\./);
  assert.match(text, /Llenar 50 litros de diésel cuesta 75,00 €, 2,50 € más que la media del municipio\./);
  assert.match(text, /En gasolina 95, 50 litros cuestan 80,00 €, igual que la media./);
});

test('stationSummary: la más barata y menos que la media', () => {
  const me = makeStation('1', { diesel: 1.3, gasolina95: 1.6 });
  const other = makeStation('2', { diesel: 1.5, gasolina95: 1.5 });
  const text = stationSummary(me, [me, other]);
  assert.match(text, /^Es la gasolinera más barata de las 2 de Valdepeñas en diésel y la más cara en gasolina 95\./);
  assert.match(text, /5,00 € menos que la media del municipio/);
});

test('stationSummary: única estación del municipio', () => {
  const me = makeStation('1', { diesel: 1.934, gasolina95: 1.6 });
  const text = stationSummary(me, [me]);
  assert.match(text, /^Es la única gasolinera de Valdepeñas con precio publicado hoy\./);
  assert.match(text, /Llenar 50 litros de diésel cuesta 96,70 €\./);
  assert.doesNotMatch(text, /media/);
});

test('stationSummary: sin diésel se omite esa parte', () => {
  const me = makeStation('1', { gasolina95: 1.6 });
  const other = makeStation('2', { diesel: 1.4, gasolina95: 1.7 });
  const text = stationSummary(me, [me, other]);
  assert.doesNotMatch(text, /diésel/);
  assert.match(text, /^Es la gasolinera más barata de las 2 de Valdepeñas en gasolina 95\./);
});

test('stationSummary: sin diésel ni gasolina 95 nombra los combustibles que vende', () => {
  const me = makeStation('1', { glp: 0.9, adblue: 1.1 });
  const other = makeStation('2', { diesel: 1.4 });
  const text = stationSummary(me, [me, other]);
  assert.match(text, /no publica hoy precio de diésel ni de gasolina 95/);
  assert.match(text, /Autogás \(GLP\), AdBlue/);
  assert.doesNotMatch(text, /Llenar/);
});

test('stationSummary: sin ningún precio lo dice', () => {
  const me = makeStation('1', {});
  assert.match(stationSummary(me, [me]), /ni de ningún otro combustible/);
});

test('stationSummary no mezcla puntos decimales en los importes', () => {
  const me = makeStation('1', { diesel: 1.4, gasolina95: 1.5 });
  const other = makeStation('2', { diesel: 1.5, gasolina95: 1.6 });
  assert.doesNotMatch(stationSummary(me, [me, other]), /\d\.\d/);
});

test('stationSummary: empate con todas las estaciones del municipio', () => {
  const me = makeStation('1', { diesel: 1.5, gasolina95: 1.6 });
  const others = [makeStation('2', { diesel: 1.5, gasolina95: 1.6 }), makeStation('3', { diesel: 1.5, gasolina95: 1.6 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /Tiene el mismo precio de diésel que las otras 2 de Valdepeñas\./);
  assert.doesNotMatch(text, /más barata/);
});

test('stationSummary: empate en el primer puesto', () => {
  const me = makeStation('1', { diesel: 1.4, gasolina95: 1.6 });
  const others = [makeStation('2', { diesel: 1.4, gasolina95: 1.5 }), makeStation('3', { diesel: 1.6, gasolina95: 1.7 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /Comparte el precio de diésel más bajo de Valdepeñas con otras 1\./);
  assert.doesNotMatch(text, /gasolinera más barata de las 3 de Valdepeñas en diésel/);
});

test('stationSummary: última posición sin empate es la más cara', () => {
  const me = makeStation('1', { diesel: 1.7, gasolina95: 1.8 });
  const others = [makeStation('2', { diesel: 1.4, gasolina95: 1.5 }), makeStation('3', { diesel: 1.6, gasolina95: 1.7 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Es la gasolinera más cara de las 3 de Valdepeñas en diésel y la más cara en gasolina 95\./);
});

test('stationSummary: puesto intermedio sin empate', () => {
  const me = makeStation('1', { diesel: 1.5, gasolina95: 1.6 });
  const others = [
    makeStation('2', { diesel: 1.4, gasolina95: 1.5 }),
    makeStation('3', { diesel: 1.45, gasolina95: 1.7 }),
    makeStation('4', { diesel: 1.6, gasolina95: 1.8 }),
  ];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Es la 3\.ª gasolinera más barata de las 4 de Valdepeñas en diésel y la 2\.ª en gasolina 95\./);
});

test('formatKm usa un decimal y coma', () => {
  assert.equal(formatKm(2.34), '2,3 km');
  assert.equal(formatKm(0), '0,0 km');
});

test('stationLabel sustituye rótulos ilegibles por la dirección y limpia espacios', () => {
  const label = (rotulo: string) => stationLabel({ ...makeStation('1', {}), rotulo });
  for (const unreadable of ['Nº 10.935', '7267', 'NO HAY', 'NO ROTULO', '', '   ']) {
    assert.equal(label(unreadable), 'Gasolinera en CALLE X');
  }
  assert.equal(label('BP  POLIGONO   CREVILLENTE'), 'BP POLIGONO CREVILLENTE');
  assert.equal(label('REPSOL'), 'REPSOL');
});
