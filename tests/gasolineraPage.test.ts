import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PAGE_PATH = path.join(import.meta.dirname, '..', 'src', 'app', 'gasolinera', '[slug]', 'page.tsx');

test('la ficha de gasolinera no muestra importes con toFixed sin coma', () => {
  const source = fs.readFileSync(PAGE_PATH, 'utf8');
  const offending = source.split('\n').filter((line) => line.includes('toFixed(') && !line.includes(".replace('.', ',')"));
  assert.deepEqual(offending, [], 'usa formatEuros, formatPrice o formatKm en vez de toFixed');
});

test('la ficha pasa los importes por formatEuros y usa SITE_NAME en openGraph', () => {
  const source = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.match(source, /formatEuros\(price \* TANK_LITERS\)/);
  assert.match(source, /siteName: SITE_NAME/);
});
