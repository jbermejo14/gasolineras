import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getRedLinks, getRedSections, loadRedEnlaces, municipalityRedKey, provinceRedKey, RED_ENLACES_ENV } from '../src/lib/red.ts';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'red-test-'));
const MADRID_KEY = '/es/gasolineras/provincia/madrid/madrid';
const NETWORK_FILE = {
  version: 1,
  generado: '2026-11-19T18:00:00.000Z',
  secciones: [
    { ruta: '/es/gasolineras', nombre: 'Gasolineras', descripcion: 'Precios' },
    { ruta: '/es/multas', nombre: 'Multas', descripcion: 'Radares' },
  ],
  enlaces: {
    [MADRID_KEY]: [{ seccion: '/es/puntos-recarga', texto: 'Recarga en Madrid', href: '/es/puntos-recarga/provincia/madrid/madrid' }],
  },
};

function writeTempFile(name: string, content: string): string {
  const file = path.join(TEMP_DIR, name);
  fs.writeFileSync(file, content);
  return file;
}

afterEach(() => {
  delete process.env[RED_ENLACES_ENV];
});

test('sin variable de entorno no hay red', () => {
  assert.equal(loadRedEnlaces(), null);
  assert.deepEqual(getRedLinks(MADRID_KEY), []);
  assert.deepEqual(getRedSections(), []);
});

test('fichero inexistente: sin red y sin error', () => {
  process.env[RED_ENLACES_ENV] = path.join(TEMP_DIR, 'no-existe.json');
  assert.equal(loadRedEnlaces(), null);
});

test('JSON roto lanza un error claro', () => {
  process.env[RED_ENLACES_ENV] = writeTempFile('roto.json', '{ no es json');
  assert.throws(() => loadRedEnlaces(), /no es JSON válido/);
});

test('versión distinta de 1 lanza un error claro', () => {
  process.env[RED_ENLACES_ENV] = writeTempFile('version.json', JSON.stringify({ ...NETWORK_FILE, version: 2 }));
  assert.throws(() => loadRedEnlaces(), /version 2/);
});

test('devuelve los enlaces de una ruta, con o sin barra final', () => {
  process.env[RED_ENLACES_ENV] = writeTempFile('ok.json', JSON.stringify(NETWORK_FILE));
  assert.equal(getRedLinks(MADRID_KEY).length, 1);
  assert.equal(getRedLinks(`${MADRID_KEY}/`)[0].texto, 'Recarga en Madrid');
  assert.deepEqual(getRedLinks('/es/gasolineras/provincia/otra'), []);
});

test('las secciones excluyen la propia', () => {
  process.env[RED_ENLACES_ENV] = writeTempFile('secciones.json', JSON.stringify(NETWORK_FILE));
  assert.deepEqual(getRedSections().map((s) => s.ruta), ['/es/multas']);
});

test('el fichero se cachea en memoria', () => {
  const file = writeTempFile('cache.json', JSON.stringify(NETWORK_FILE));
  process.env[RED_ENLACES_ENV] = file;
  const first = loadRedEnlaces();
  fs.writeFileSync(file, '{ roto');
  assert.equal(loadRedEnlaces(), first);
});

test('las claves de provincia y municipio llevan la ruta base', () => {
  assert.equal(provinceRedKey('madrid'), '/es/gasolineras/provincia/madrid');
  assert.equal(municipalityRedKey('madrid', 'madrid'), MADRID_KEY);
});
