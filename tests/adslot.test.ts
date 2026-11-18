import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { getAdSenseClient, getAdSenseSlot, isValidAdSenseSlot } from '../src/lib/adsense.ts';

const VALID_CLIENT = 'ca-pub-0000000000000000';
const VALID_SLOT = '0000000000';
const MAX_SLOTS_PER_PAGE = 3;
const APP_DIR = join('src', 'app');
const LEGAL_PAGES = ['aviso-legal', 'privacidad', 'cookies'];
const COMPONENT_IMPORT_PATTERN = /from '@\/components\/(\w+)'/g;
const ADSLOT_USAGE_PATTERN = /<AdSlot[\s/>]/g;

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function listPageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listPageFiles(path);
    return name === 'page.tsx' ? [path] : [];
  });
}

/** Cuenta los `<AdSlot` de un fichero y de los componentes locales que importa, sin repetir ficheros. */
function countAdSlots(file: string, visited: Set<string> = new Set()): number {
  if (visited.has(file) || !existsSync(file)) return 0;
  visited.add(file);
  const source = readFileSync(file, 'utf8');
  const own = source.match(ADSLOT_USAGE_PATTERN)?.length ?? 0;
  const imported = [...source.matchAll(COMPONENT_IMPORT_PATTERN)]
    .filter(([, name]) => name !== 'AdSlot')
    .map(([, name]) => join('src', 'components', `${name}.tsx`));
  return own + imported.reduce((sum, path) => sum + countAdSlots(path, visited), 0);
}

describe('configuración de AdSlot', () => {
  const original = {
    client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT,
  };

  afterEach(() => {
    setEnv('NEXT_PUBLIC_ADSENSE_CLIENT', original.client);
    setEnv('NEXT_PUBLIC_ADSENSE_SLOT', original.slot);
  });

  it('sin cliente o sin unidad no hay configuración', () => {
    setEnv('NEXT_PUBLIC_ADSENSE_CLIENT', undefined);
    setEnv('NEXT_PUBLIC_ADSENSE_SLOT', undefined);
    assert.equal(getAdSenseClient(), null);
    assert.equal(getAdSenseSlot(), null);
  });

  it('rechaza unidades inválidas', () => {
    for (const slot of ['', '123456789', '12345678901', '123456789a', ` ${VALID_SLOT}`]) {
      assert.equal(isValidAdSenseSlot(slot), false, slot);
    }
  });

  it('acepta cliente y unidad válidos', () => {
    setEnv('NEXT_PUBLIC_ADSENSE_CLIENT', VALID_CLIENT);
    setEnv('NEXT_PUBLIC_ADSENSE_SLOT', VALID_SLOT);
    assert.equal(getAdSenseClient(), VALID_CLIENT);
    assert.equal(getAdSenseSlot(), VALID_SLOT);
  });
});

describe('marcado de AdSlot', () => {
  const source = readFileSync(join('src', 'components', 'AdSlot.tsx'), 'utf8');

  it('declara los atributos de la unidad y el texto Publicidad', () => {
    for (const fragment of ['className="adsbygoogle"', 'data-ad-client={client}', 'data-ad-slot={slot}', 'data-ad-format="auto"', "'Publicidad'"]) {
      assert.ok(source.includes(fragment), fragment);
    }
  });

  it('no renderiza sin cliente o sin unidad', () => {
    assert.match(source, /if \(!client \|\| !slot\) return null;/);
  });
});

describe('páginas con anuncios', () => {
  it('ninguna página legal ni la 404 usan AdSlot', () => {
    for (const legal of LEGAL_PAGES) {
      assert.equal(countAdSlots(join(APP_DIR, legal, 'page.tsx')), 0, legal);
    }
    assert.equal(countAdSlots(join(APP_DIR, 'not-found.tsx')), 0);
    assert.equal(countAdSlots(join('src', 'components', 'LegalPage.tsx')), 0);
  });

  it(`ninguna página pasa de ${MAX_SLOTS_PER_PAGE} AdSlot`, () => {
    for (const page of listPageFiles(APP_DIR)) {
      assert.ok(countAdSlots(page) <= MAX_SLOTS_PER_PAGE, page);
    }
  });
});
