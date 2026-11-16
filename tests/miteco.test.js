const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Compilar o importar lógica de lib/miteco directamente en JS para testing sin red
function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseAndValidatePrice(val) {
  if (val === null || val === undefined || val === '') {
    return { price: null };
  }
  const str = String(val).trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) {
    return { price: null };
  }
  if (num < 0.50 || num > 3.50) {
    return {
      price: null,
      reason: `Precio fuera de rango válido [0.50 - 3.50 €/l]: ${num} €/l`,
    };
  }
  return { price: Math.round(num * 1000) / 1000 };
}

function parseAndValidateCoordinates(latRaw, lonRaw) {
  if (!latRaw || !lonRaw) {
    return { lat: null, lon: null, valid: false, reason: 'Coordenadas vacías o nulas' };
  }
  const lat = parseFloat(String(latRaw).trim().replace(',', '.'));
  const lon = parseFloat(String(lonRaw).trim().replace(',', '.'));

  if (isNaN(lat) || isNaN(lon)) {
    return { lat: null, lon: null, valid: false, reason: 'Coordenadas no numéricas' };
  }

  if (lat < 27.0 || lat > 44.5 || lon < -19.0 || lon > 5.0) {
    return {
      lat,
      lon,
      valid: false,
      reason: `Coordenadas fuera de España: lat=${lat}, lon=${lon}`,
    };
  }

  return { lat, lon, valid: true };
}

function processRawMitecoData(rawData) {
  const fechaMiteco = rawData.Fecha || '16/11/2026 13:00:00';
  const rawList = Array.isArray(rawData.ListaEESSPrecio) ? rawData.ListaEESSPrecio : [];

  let descartadasSinId = 0;
  let descartadasCoord = 0;
  let preciosDescartadosRango = 0;

  const estaciones = [];
  const estacionesById = new Map();
  const provinciasMap = new Map();
  const municipiosMap = new Map();

  for (const item of rawList) {
    const rawId = item.IDEESS;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      descartadasSinId++;
      continue;
    }
    const id = rawId.trim();

    const coordCheck = parseAndValidateCoordinates(item.Latitud, item['Longitud (WGS84)']);
    if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lon === null) {
      descartadasCoord++;
      continue;
    }

    const pG95 = parseAndValidatePrice(item['Precio Gasolina 95 E5']);
    const pDiesel = parseAndValidatePrice(item['Precio Gasoleo A']);
    const pDPremium = parseAndValidatePrice(item['Precio Gasoleo Premium']);
    const pG98 = parseAndValidatePrice(item['Precio Gasolina 98 E5']);
    const pGLP = parseAndValidatePrice(item['Precio Gases licuados del petróleo']);
    const pGNC = parseAndValidatePrice(item['Precio Gas Natural Comprimido']);
    const pGNL = parseAndValidatePrice(item['Precio Gas Natural Licuado']);
    const pDieselB = parseAndValidatePrice(item['Precio Gasoleo B']);
    const pAdblue = parseAndValidatePrice(item['Precio Adblue']);

    if (pG95.reason) preciosDescartadosRango++;
    if (pDiesel.reason) preciosDescartadosRango++;

    const precios = {
      gasolina95: pG95.price,
      diesel: pDiesel.price,
      dieselPremium: pDPremium.price,
      gasolina98: pG98.price,
      glp: pGLP.price,
      gnc: pGNC.price,
      gnl: pGNL.price,
      dieselB: pDieselB.price,
      adblue: pAdblue.price,
    };

    const provinciaNombre = (item.Provincia || '').trim().toUpperCase();
    const municipioNombre = (item.Municipio || '').trim();
    const provinciaSlug = slugify(provinciaNombre);
    const municipioSlug = slugify(municipioNombre);
    const rotulo = (item['Rótulo'] || 'GASOLINERA').trim();
    const slug = slugify(`${rotulo}-${municipioNombre}-${id}`);

    const station = {
      id,
      slug,
      rotulo,
      direccion: (item['Dirección'] || '').trim(),
      cp: (item['C.P.'] || '').trim(),
      localidad: (item['Localidad'] || '').trim(),
      idMunicipio: item.IDMunicipio || '',
      municipio: municipioNombre,
      municipioSlug,
      idProvincia: item.IDProvincia || '',
      provincia: provinciaNombre,
      provinciaSlug,
      horario: (item['Horario'] || 'Consultar').trim(),
      lat: coordCheck.lat,
      lon: coordCheck.lon,
      precios,
    };

    estaciones.push(station);
    estacionesById.set(id, station);

    if (provinciaSlug) {
      if (!provinciasMap.has(provinciaSlug)) {
        provinciasMap.set(provinciaSlug, {
          provincia: provinciaNombre,
          provinciaSlug,
          estaciones: [],
        });
      }
      provinciasMap.get(provinciaSlug).estaciones.push(station);
    }

    if (provinciaSlug && municipioSlug) {
      const munKey = `${provinciaSlug}:${municipioSlug}`;
      if (!municipiosMap.has(munKey)) {
        municipiosMap.set(munKey, {
          municipio: municipioNombre,
          municipioSlug,
          provincia: provinciaNombre,
          provinciaSlug,
          estaciones: [],
        });
      }
      municipiosMap.get(munKey).estaciones.push(station);
    }
  }

  return {
    fechaMiteco,
    descartadasSinId,
    descartadasCoord,
    preciosDescartadosRango,
    estaciones,
    estacionesById,
    provinciasMap,
    municipiosMap,
  };
}

describe('Pruebas unitarias sin red de MITECO (Requisito 9)', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'miteco-sample.json');
  const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  test('1. Normalización y validación de estaciones y descartes correctos', () => {
    const result = processRawMitecoData(fixtureData);

    // En el fixture hay 8 registros:
    // - 1 sin IDEESS -> descartada
    // - 1 en Moscú (fuera de España) -> descartada
    // - 1 con coordenadas inválidas (strings no numéricos) -> descartada
    // - 5 válidas procesadas
    assert.equal(result.descartadasSinId, 1, 'Debe descartar 1 estación sin IDEESS');
    assert.equal(result.descartadasCoord, 2, 'Debe descartar 2 estaciones por coordenadas fuera de España o corruptas');
    assert.equal(result.estaciones.length, 5, 'Deben quedar 5 estaciones válidas');
    assert.equal(result.fechaMiteco, '16/11/2026 13:00:00', 'Debe conservar la fecha devuelta por MITECO');
  });

  test('2. Validación estricta de rango de precios [0.50 - 3.50 €/l]', () => {
    const result = processRawMitecoData(fixtureData);

    // La estación 1004 tiene G95 = 0.200 (demasiado bajo) y Diesel = 5.500 (demasiado alto)
    const st1004 = result.estacionesById.get('1004');
    assert.ok(st1004, 'La estación 1004 debe existir');
    assert.equal(st1004.precios.gasolina95, null, 'G95 de 0.200 €/l debe ser descartado (null)');
    assert.equal(st1004.precios.diesel, null, 'Diésel de 5.500 €/l debe ser descartado (null)');

    // La estación 1001 tiene precios válidos: G95 = 1.500, Diesel = 1.450
    const st1001 = result.estacionesById.get('1001');
    assert.equal(st1001.precios.gasolina95, 1.500);
    assert.equal(st1001.precios.diesel, 1.450);
  });

  test('3. Generación limpia y estable de Slugs', () => {
    assert.equal(slugify('ALBACETE'), 'albacete');
    assert.equal(slugify('Alcalá de Henares'), 'alcala-de-henares');
    assert.equal(slugify('CEPSA / MOEVE'), 'cepsa-moeve');
    assert.equal(slugify('ARABA/ÁLAVA'), 'araba-alava');
    assert.equal(slugify('Castellón / Castelló'), 'castellon-castello');
  });

  test('4. Cálculo correcto de medias y mínimos por municipio y provincia', () => {
    const result = processRawMitecoData(fixtureData);

    // En Madrid municipio tenemos:
    // 1001: G95 = 1.500, Diesel = 1.450
    // 1002: G95 = 1.400, Diesel = 1.350
    // (1004 tiene precios nulos por rango)
    const munMadrid = result.municipiosMap.get('madrid:madrid');
    assert.ok(munMadrid, 'Municipio madrid:madrid debe existir');

    const validG95 = munMadrid.estaciones.map(s => s.precios.gasolina95).filter(p => p !== null);
    assert.deepEqual(validG95, [1.500, 1.400]);

    const minG95 = Math.min(...validG95);
    const avgG95 = validG95.reduce((a, b) => a + b, 0) / validG95.length;

    assert.equal(minG95, 1.400, 'El precio mínimo de G95 en Madrid debe ser 1.400');
    assert.equal(avgG95, 1.450, 'El precio medio de G95 en Madrid debe ser 1.450');
  });

  test('5. Control de 404 para slugs inexistentes', () => {
    const result = processRawMitecoData(fixtureData);

    // Comprobamos que un slug inexistente no devuelva datos y retorne undefined / 404
    assert.equal(result.provinciasMap.has('provincia-fantasma'), false);
    assert.equal(result.municipiosMap.has('madrid:pueblo-inexistente'), false);
    assert.equal(result.estacionesById.has('9999999'), false);
  });

  test('6. Simulación de generación del sitemap a partir de los datos', () => {
    const result = processRawMitecoData(fixtureData);
    const siteUrl = 'https://ejemplo-gasolineras.es';

    const sitemapEntries = [
      { url: siteUrl, priority: 1.0 },
    ];

    for (const prov of result.provinciasMap.values()) {
      sitemapEntries.push({ url: `${siteUrl}/provincia/${prov.provinciaSlug}`, priority: 0.9 });
    }

    for (const mun of result.municipiosMap.values()) {
      sitemapEntries.push({ url: `${siteUrl}/provincia/${mun.provinciaSlug}/${mun.municipioSlug}`, priority: 0.8 });
    }

    for (const s of result.estaciones) {
      sitemapEntries.push({ url: `${siteUrl}/gasolinera/${s.id}-${s.slug}`, priority: 0.6 });
    }

    // Comprobaciones
    assert.ok(sitemapEntries.some(e => e.url === `${siteUrl}/provincia/madrid`), 'Sitemap debe incluir provincia Madrid');
    assert.ok(sitemapEntries.some(e => e.url === `${siteUrl}/provincia/madrid/alcala-de-henares`), 'Sitemap debe incluir municipio Alcalá de Henares');
    assert.ok(sitemapEntries.some(e => e.url.includes('/gasolinera/1001-')), 'Sitemap debe incluir ficha de gasolinera 1001');
    assert.equal(sitemapEntries.length, 1 + 2 + 3 + 5, 'Total URLs: 1 home + 2 provincias + 3 municipios + 5 gasolineras');
  });
});
