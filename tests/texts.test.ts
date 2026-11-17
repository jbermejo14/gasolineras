import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
// La web se regenera una vez al día: no puede prometer datos en tiempo real.
const REALTIME_PROMISE = /tiempo real|en directo|30 minutos/i;

function textsSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return textsSourceFiles(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

test('ningún .ts/.tsx de src promete datos en tiempo real', () => {
  for (const file of textsSourceFiles(SOURCE_DIR)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), REALTIME_PROMISE, `${file} promete tiempo real: los datos se actualizan una vez al día`);
  }
});

test('el detector reconoce las promesas prohibidas', () => {
  assert.match('Hoy en Tiempo Real', REALTIME_PROMISE);
  assert.match('comparadas en directo', REALTIME_PROMISE);
  assert.match('cada 30 minutos', REALTIME_PROMISE);
});
