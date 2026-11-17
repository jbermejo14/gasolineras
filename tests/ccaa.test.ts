import test from 'node:test';
import assert from 'node:assert/strict';
import { COMUNIDADES, findComunidadById, findComunidadBySlug } from '../src/lib/ccaa.ts';

test('hay 19 comunidades con ids y slugs únicos', () => {
  assert.equal(COMUNIDADES.length, 19);
  assert.equal(new Set(COMUNIDADES.map((c) => c.id)).size, 19);
  assert.equal(new Set(COMUNIDADES.map((c) => c.slug)).size, 19);
});

test('los códigos son los de MITECO', () => {
  assert.equal(findComunidadById('07')?.name, 'Castilla-La Mancha');
  assert.equal(findComunidadById('08')?.name, 'Castilla y León');
  assert.equal(findComunidadById('13')?.slug, 'comunidad-de-madrid');
});

test('búsqueda por slug y casos no encontrados', () => {
  assert.equal(findComunidadBySlug('cataluna')?.id, '09');
  assert.equal(findComunidadBySlug('nada'), null);
  assert.equal(findComunidadById('99'), null);
});
