import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAdsTxt, isValidAdSenseClient } from '../src/lib/adsense.ts';

const VALID_CLIENT = 'ca-pub-1234567890123456';

describe('isValidAdSenseClient', () => {
  it('acepta ca-pub- con 16 dígitos', () => {
    assert.equal(isValidAdSenseClient(VALID_CLIENT), true);
  });

  it('rechaza vacío, longitudes erróneas, prefijo erróneo y texto extra', () => {
    assert.equal(isValidAdSenseClient(''), false);
    assert.equal(isValidAdSenseClient('ca-pub-123456789012345'), false);
    assert.equal(isValidAdSenseClient('ca-pub-12345678901234567'), false);
    assert.equal(isValidAdSenseClient('pub-1234567890123456'), false);
    assert.equal(isValidAdSenseClient('ca-pub-123456789012345a'), false);
    assert.equal(isValidAdSenseClient(` ${VALID_CLIENT}`), false);
    assert.equal(isValidAdSenseClient(`${VALID_CLIENT}\n`), false);
  });
});

describe('buildAdsTxt', () => {
  it('genera la línea DIRECT con pub- sin el prefijo ca-', () => {
    assert.equal(buildAdsTxt(VALID_CLIENT), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });

  it('lanza error claro con un identificador no válido', () => {
    assert.throws(() => buildAdsTxt('placeholder'), /Identificador de AdSense no válido/);
  });
});
