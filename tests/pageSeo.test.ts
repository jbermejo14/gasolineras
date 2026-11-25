import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { loadMitecoSnapshot, MITECO_SNAPSHOT_FILE } from '../src/lib/mitecoSnapshot.ts';
import type { Gasolinera, MitecoSnapshot } from '../src/lib/miteco.ts';
import { buildMunicipalityMetadata, buildProvinceMetadata, buildStationMetadata } from '../src/lib/pageMetadata.ts';
import {
  buildMunicipalityDescription,
  buildProvinceDescription,
  buildStationDescription,
  buildStationTitle,
} from '../src/lib/pageSeoText.ts';
import { buildHistoricoMetadata } from '../src/lib/historicoPageMeta.ts';
import { getAreasByKind } from '../src/lib/historico.ts';
import type { AreaKind } from '../src/lib/historicoFormat.ts';
import { HOME_DESCRIPTION, HOME_SOCIAL_TITLE, HOME_TITLE } from '../src/lib/homeSeoText.ts';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  TITLE_BRAND_SUFFIX,
  TITLE_MAX_LENGTH,
  TITLE_TARGET_LENGTH,
  fitDescription,
  pickTitle,
  shortPlaceName,
} from '../src/lib/seoText.ts';
import { SOCIAL_IMAGE_ALT, SOCIAL_IMAGE_HEIGHT, SOCIAL_IMAGE_WIDTH, buildSocialMetadata } from '../src/lib/socialMetadata.ts';
import { BASE_PATH, SITE_NAME, absoluteUrl } from '../src/lib/site.ts';

const SNAPSHOT_FIXTURE = path.join(import.meta.dirname, 'fixtures', 'miteco-snapshot-sample.json');
const APP_DIR = path.join(import.meta.dirname, '..', 'src', 'app');
const HISTORY_KINDS: AreaKind[] = ['comunidad', 'provincia', 'marca'];
const ENGLISH_PRICE = /\d\.\d{3} ?€/;
const MAX_REPORTED_FAILURES = 5;

interface SocialImage {
  url: string;
  width: number;
  height: number;
}
interface OpenGraphShape {
  url?: string;
  title?: string;
  description?: string;
  images?: SocialImage[];
}
interface TwitterShape {
  card?: string;
  title?: string;
  description?: string;
  images?: string[];
}

// Datos reales del repo; si no se ha ejecutado npm run preparar-datos se usa la muestra de pruebas.
const snapshot: MitecoSnapshot = loadMitecoSnapshot(
  fs.existsSync(MITECO_SNAPSHOT_FILE) ? MITECO_SNAPSHOT_FILE : SNAPSHOT_FIXTURE
);

function titleOf(metadata: Metadata): string {
  assert.equal(typeof metadata.title, 'string');
  return metadata.title as string;
}

function socialProblems(label: string, metadata: Metadata, canonical: string): string[] {
  const problems: string[] = [];
  const image = absoluteUrl('/brand/ododex-og.png');
  const title = titleOf(metadata);
  const description = metadata.description ?? '';
  const og = metadata.openGraph as OpenGraphShape | undefined;
  const twitter = metadata.twitter as TwitterShape | undefined;
  if (og?.images?.[0]?.url !== image) problems.push(`${label}: falta la imagen Open Graph`);
  if (og?.images?.[0]?.width !== SOCIAL_IMAGE_WIDTH || og?.images?.[0]?.height !== SOCIAL_IMAGE_HEIGHT) {
    problems.push(`${label}: la imagen Open Graph no mide 1200x630`);
  }
  if (og?.url !== canonical) problems.push(`${label}: og:url distinta de la canonical`);
  if (og?.title !== title || og?.description !== description) problems.push(`${label}: Open Graph con textos distintos`);
  if (twitter?.card !== 'summary_large_image' || twitter.images?.[0] !== image) {
    problems.push(`${label}: falta la Twitter Card con imagen`);
  }
  if (twitter?.title !== title || twitter?.description !== description) {
    problems.push(`${label}: Twitter con textos distintos`);
  }
  return problems;
}

/** Devuelve los mensajes de fallo de los metadatos de una página, o [] si cumple todo. */
function metadataProblems(label: string, metadata: Metadata, canonical: string): string[] {
  const problems: string[] = [];
  const title = titleOf(metadata);
  const description = metadata.description ?? '';
  const fullTitle = `${title}${TITLE_BRAND_SUFFIX}`;
  if (title.includes(SITE_NAME)) problems.push(`${label}: marca duplicada en "${title}"`);
  if (fullTitle.length > TITLE_MAX_LENGTH) problems.push(`${label}: título de ${fullTitle.length} caracteres "${fullTitle}"`);
  if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
    problems.push(`${label}: descripción de ${description.length} caracteres "${description}"`);
  }
  if (ENGLISH_PRICE.test(description)) problems.push(`${label}: precio sin formato español "${description}"`);
  if ((metadata.alternates?.canonical as string | undefined) !== canonical) problems.push(`${label}: canonical cambiada`);
  problems.push(...socialProblems(label, metadata, canonical));
  return problems;
}

function assertNoProblems(problems: string[]): void {
  assert.deepEqual(problems.slice(0, MAX_REPORTED_FAILURES), [], `${problems.length} problemas en total`);
}

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test('buildSocialMetadata incluye imagen con basePath, tamaño, alt y Twitter Card grande', () => {
  const social = buildSocialMetadata({ title: 'T', description: 'D', path: '/provincia/madrid' });
  const expectedImage = `${absoluteUrl('/')}/brand/ododex-og.png`;
  assert.ok(expectedImage.includes(BASE_PATH));
  assert.deepEqual(social.openGraph, {
    type: 'website',
    locale: 'es_ES',
    url: absoluteUrl('/provincia/madrid'),
    siteName: SITE_NAME,
    title: 'T',
    description: 'D',
    images: [{ url: expectedImage, width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT }],
  });
  assert.deepEqual(social.twitter, {
    card: 'summary_large_image',
    title: 'T',
    description: 'D',
    images: [expectedImage],
  });
});

test('la portada cumple los límites de título y descripción', () => {
  assert.ok(HOME_TITLE.length <= TITLE_MAX_LENGTH, HOME_TITLE);
  assert.ok(HOME_TITLE.endsWith(TITLE_BRAND_SUFFIX));
  assert.ok(HOME_DESCRIPTION.length >= DESCRIPTION_MIN_LENGTH && HOME_DESCRIPTION.length <= DESCRIPTION_MAX_LENGTH);
  assert.ok(HOME_SOCIAL_TITLE.length > 0);
});

test('pickTitle prefiere el objetivo, luego el máximo y devuelve null si nada cabe', () => {
  const target = TITLE_TARGET_LENGTH - TITLE_BRAND_SUFFIX.length;
  const max = TITLE_MAX_LENGTH - TITLE_BRAND_SUFFIX.length;
  const fitsMax = 'x'.repeat(max);
  const fitsTarget = 'y'.repeat(target);
  assert.equal(pickTitle([fitsMax, fitsTarget]), fitsTarget);
  assert.equal(pickTitle([fitsMax]), fitsMax);
  assert.equal(pickTitle(['z'.repeat(max + 1)]), null);
  assert.equal(pickTitle(['z'.repeat(max + 1)], [fitsTarget]), fitsTarget);
});

test('fitDescription elige la variante que cabe y rellena si se queda corta', () => {
  const long = 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1);
  const medium = 'b'.repeat(DESCRIPTION_MIN_LENGTH);
  assert.equal(fitDescription([long, medium], ['relleno']), medium);
  const short = 'c'.repeat(DESCRIPTION_MIN_LENGTH - 5);
  const padded = fitDescription([short], ['d'.repeat(DESCRIPTION_MAX_LENGTH), 'relleno útil']);
  assert.equal(padded, `${short} relleno útil`);
});

test('shortPlaceName quita la parte cooficial', () => {
  assert.equal(shortPlaceName('Castellón / Castelló'), 'Castellón');
  assert.equal(shortPlaceName('Araba/Álava'), 'Araba');
  assert.equal(shortPlaceName('Etxebarri, Anteiglesia de San Esteban'), 'Etxebarri');
  assert.equal(shortPlaceName('Madrid'), 'Madrid');
});

test('la ficha con el rótulo más largo cabe sin truncar ni repetir la marca', () => {
  const station = [...snapshot.estaciones].sort((a, b) => b.rotulo.length - a.rotulo.length)[0];
  const metadata = buildStationMetadata(station);
  assertNoProblems(metadataProblems(station.id, metadata, absoluteUrl(`/gasolinera/${station.id}-${station.slug}`)));
});

test('una gasolinera sin precios de gasolina 95 ni diésel genera descripción válida', () => {
  const description = buildStationDescription({
    rotulo: 'BALLENOIL',
    direccion: 'CALLE MAYOR, 1',
    municipio: 'Teruel',
    horario: 'L-D: 24H',
    gasolina95: null,
    diesel: null,
  });
  assert.ok(description.length >= DESCRIPTION_MIN_LENGTH && description.length <= DESCRIPTION_MAX_LENGTH, description);
  assert.doesNotMatch(description, /--/);
});

test('los precios de la descripción de una ficha usan coma decimal', () => {
  const description = buildStationDescription({
    rotulo: 'REPSOL',
    direccion: 'CALLE MAYOR, 1',
    municipio: 'Teruel',
    horario: 'L-D: 24H',
    gasolina95: 1.459,
    diesel: 1.399,
  });
  assert.match(description, /Gasolina 95: 1,459 €\/l/);
  assert.match(description, /Diésel: 1,399 €\/l/);
  assert.equal(buildStationTitle({ rotulo: 'REPSOL', municipio: 'Teruel' }), 'Gasolinera REPSOL en Teruel: precios hoy');
});

test('todas las provincias reales cumplen título, descripción e imágenes sociales', () => {
  const problems = [...snapshot.provinciasMap.values()].flatMap((province) =>
    metadataProblems(
      province.provinciaSlug,
      buildProvinceMetadata(province),
      absoluteUrl(`/provincia/${province.provinciaSlug}`)
    )
  );
  assertNoProblems(problems);
});

test('todos los municipios reales cumplen título, descripción e imágenes sociales', () => {
  const problems = [...snapshot.municipiosMap.values()].flatMap((municipality) =>
    metadataProblems(
      `${municipality.provinciaSlug}/${municipality.municipioSlug}`,
      buildMunicipalityMetadata(municipality),
      absoluteUrl(`/provincia/${municipality.provinciaSlug}/${municipality.municipioSlug}`)
    )
  );
  assertNoProblems(problems);
});

test('todas las gasolineras reales cumplen título, descripción e imágenes sociales', () => {
  const problems = snapshot.estaciones.flatMap((station: Gasolinera) =>
    metadataProblems(station.id, buildStationMetadata(station), absoluteUrl(`/gasolinera/${station.id}-${station.slug}`))
  );
  assertNoProblems(problems);
});

test('el histórico (España y todas las áreas) cumple título, descripción e imágenes sociales', () => {
  const targets: Array<[AreaKind, string]> = [['espana', 'espana']];
  for (const kind of HISTORY_KINDS) {
    targets.push(...getAreasByKind(kind).map((area): [AreaKind, string] => [kind, area.slug]));
  }
  assert.ok(targets.length > 1, 'faltan datos de histórico en data/historico');
  const problems = targets.flatMap(([kind, slug]) => {
    const canonical = absoluteUrl(kind === 'espana' ? '/historico' : `/historico/${kind}/${slug}`);
    return metadataProblems(`${kind}/${slug}`, buildHistoricoMetadata(kind, slug), canonical);
  });
  assertNoProblems(problems);
});

test('ninguna página de src/app redefine openGraph a mano: usan buildSocialMetadata', () => {
  const offenders = collectSourceFiles(APP_DIR).filter((file) => /openGraph\s*:/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('la descripción de municipio escribe los precios en minúscula tras los dos puntos', () => {
  const description = buildMunicipalityDescription('Getafe', 'Madrid', { count: 12, minG95: 1.459, minDiesel: 1.399 });
  assert.match(description, /con precios oficiales: gasolina 95 desde /);
});

test('la descripción de provincia concuerda en singular y pone mayúscula a la frase de precios', () => {
  const one = buildProvinceDescription('Soria', { count: 1, minG95: 1.459, minDiesel: null });
  assert.match(one, /: 1 gasolinera comparada\./);
  assert.match(one, /\. Gasolina 95 desde /);
  const many = buildProvinceDescription('Soria', { count: 3, minG95: 1.459, minDiesel: null });
  assert.match(many, /: 3 gasolineras comparadas\./);
});
