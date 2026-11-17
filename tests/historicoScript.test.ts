import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMissingWeeks, parseHistoricoArgs, resolveHistoricoExitCode } from '../scripts/historico.ts';

test('parseHistoricoArgs: sin argumentos usa los valores por defecto', () => {
  assert.deepEqual(parseHistoricoArgs([]), { until: null, upload: false, uploadAll: false });
});

test('parseHistoricoArgs: --hasta con fecha válida', () => {
  assert.equal(parseHistoricoArgs(['--hasta=2020-01-06']).until, '2020-01-06');
});

test('parseHistoricoArgs: --subir activa la subida parcial', () => {
  assert.deepEqual(parseHistoricoArgs(['--subir']), { until: null, upload: true, uploadAll: false });
});

test('parseHistoricoArgs: --subir-todo activa la subida completa', () => {
  assert.deepEqual(parseHistoricoArgs(['--subir-todo']), { until: null, upload: true, uploadAll: true });
});

test('parseHistoricoArgs: combinación de opciones', () => {
  assert.deepEqual(parseHistoricoArgs(['--hasta=2021-03-01', '--subir']), {
    until: '2021-03-01',
    upload: true,
    uploadAll: false,
  });
});

test('parseHistoricoArgs: opción desconocida lanza Error claro', () => {
  assert.throws(() => parseHistoricoArgs(['--otra']), /Opción desconocida: "--otra"/);
});

test('parseHistoricoArgs: fecha mal formada o inexistente lanza Error', () => {
  assert.throws(() => parseHistoricoArgs(['--hasta=06-01-2020']), /Fecha inválida/);
  assert.throws(() => parseHistoricoArgs(['--hasta=2020-02-30']), /Fecha inválida/);
  assert.throws(() => parseHistoricoArgs(['--hasta=']), /Fecha inválida/);
});

test('findMissingWeeks: devuelve las semanas sin caché en orden', () => {
  const weeks = ['2016-01-04', '2016-01-11', '2016-01-18'];
  assert.deepEqual(findMissingWeeks(weeks, ['2016-01-11']), ['2016-01-04', '2016-01-18']);
});

test('findMissingWeeks: caché completa o vacía', () => {
  const weeks = ['2016-01-04', '2016-01-11'];
  assert.deepEqual(findMissingWeeks(weeks, new Set(weeks)), []);
  assert.deepEqual(findMissingWeeks(weeks, []), weeks);
  assert.deepEqual(findMissingWeeks([], ['2016-01-04']), []);
});

test('findMissingWeeks: ignora fechas en caché que no están en las semanas', () => {
  assert.deepEqual(findMissingWeeks(['2016-01-04'], ['1999-01-01']), ['2016-01-04']);
});

test('resolveHistoricoExitCode: 0 sin fallos, 1 con semanas o subidas fallidas', () => {
  assert.equal(resolveHistoricoExitCode(0, 0), 0);
  assert.equal(resolveHistoricoExitCode(2, 0), 1);
  assert.equal(resolveHistoricoExitCode(0, 1), 1);
});
