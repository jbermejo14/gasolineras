import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_CONFIG, getStationBrand, matchesBrand } from '../src/lib/brands.ts';
import type { BrandInfo } from '../src/lib/brands.ts';

test('getStationBrand reconoce BP como palabra completa', () => {
  assert.equal(getStationBrand('BP'), BRAND_CONFIG.bp);
  assert.equal(getStationBrand('E.S. FRES - BP'), BRAND_CONFIG.bp);
});

test('getStationBrand acepta guion bajo como separador', () => {
  assert.equal(getStationBrand('DISA_SHELL'), BRAND_CONFIG.shell);
});

test('getStationBrand no casa keywords dentro de otras palabras', () => {
  assert.equal(getStationBrand('SUBPRIME OIL'), null);
});

test('getStationBrand ignora mayúsculas', () => {
  assert.equal(getStationBrand('repsol'), BRAND_CONFIG.repsol);
  assert.equal(getStationBrand('E.S. REPSOL'), BRAND_CONFIG.repsol);
});

test('getStationBrand reconoce alias y acentos', () => {
  assert.equal(getStationBrand('CEPSA'), BRAND_CONFIG.moeve);
  assert.equal(getStationBrand('BONÀREA'), BRAND_CONFIG.bonarea);
});

test('getStationBrand devuelve null sin rótulo o sin coincidencia', () => {
  assert.equal(getStationBrand(''), null);
  assert.equal(getStationBrand('GASOLINERA PEPE'), null);
});

test('matchesBrand escapa los caracteres especiales de regex', () => {
  const brand: BrandInfo = { name: 'Prueba', logo: '/logos/prueba.webp', keywords: ['a.b'] };
  assert.equal(matchesBrand('a.b', brand), true);
  assert.equal(matchesBrand('axb', brand), false);
});

test('cada marca tiene el logo /logos/<clave>.webp', () => {
  for (const [key, brand] of Object.entries(BRAND_CONFIG)) {
    assert.equal(brand.logo, `/logos/${key}.webp`);
  }
});
