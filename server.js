const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MITECO_API_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache
let cachedStations = [];
let cachedProvinces = [];
let lastUpdate = null;
let nextUpdate = null;
let isUpdating = false;
let updateError = null;

function parseCoord(val) {
  if (!val) return null;
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parsePrice(val) {
  if (!val) return null;
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) || num <= 0 ? null : num;
}

function normalizeStation(s) {
  return {
    id: s['IDEESS'] || `${s['Latitud']}_${s['Longitud (WGS84)']}`,
    rotulo: (s['Rótulo'] || 'GASOLINERA').trim(),
    direccion: (s['Dirección'] || '').trim(),
    cp: (s['C.P.'] || '').trim(),
    localidad: (s['Localidad'] || '').trim(),
    municipio: (s['Municipio'] || '').trim(),
    provincia: (s['Provincia'] || '').trim().toUpperCase(),
    horario: (s['Horario'] || 'Consultar').trim(),
    lat: parseCoord(s['Latitud']),
    lon: parseCoord(s['Longitud (WGS84)']),
    tipoVenta: s['Tipo Venta'] || '',
    remision: s['Remisión'] || '',
    precios: {
      gasolina95: parsePrice(s['Precio Gasolina 95 E5']),
      diesel: parsePrice(s['Precio Gasoleo A']),
      dieselPremium: parsePrice(s['Precio Gasoleo Premium']),
      gasolina98: parsePrice(s['Precio Gasolina 98 E5']),
      glp: parsePrice(s['Precio Gases licuados del petróleo']),
      gnc: parsePrice(s['Precio Gas Natural Comprimido']),
      gnl: parsePrice(s['Precio Gas Natural Licuado']),
      dieselB: parsePrice(s['Precio Gasoleo B']),
      adblue: parsePrice(s['Precio Adblue'])
    }
  };
}

// Haversine formula to compute distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// Fetch prices from MITECO API
async function fetchGasStations() {
  if (isUpdating) return;
  isUpdating = true;
  updateError = null;
  console.log(`[${new Date().toLocaleTimeString()}] Consultando API de Transición Ecológica...`);

  try {
    const response = await fetch(MITECO_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GasolinerasApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP de MITECO: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawStations = data.ListaEESSPrecio || [];

    cachedStations = rawStations.map(normalizeStation);

    // Extract sorted unique provinces
    const provSet = new Set();
    cachedStations.forEach(s => {
      if (s.provincia) provSet.add(s.provincia);
    });
    cachedProvinces = Array.from(provSet).sort((a, b) => a.localeCompare(b, 'es'));

    lastUpdate = new Date();
    nextUpdate = new Date(lastUpdate.getTime() + REFRESH_INTERVAL_MS);

    console.log(`[${new Date().toLocaleTimeString()}] Datos actualizados con éxito: ${cachedStations.length} gasolineras procesadas.`);
    console.log(`[${new Date().toLocaleTimeString()}] Próxima actualización automática: ${nextUpdate.toLocaleTimeString()}`);
  } catch (err) {
    console.error('Error al actualizar gasolineras:', err.message);
    updateError = err.message;
  } finally {
    isUpdating = false;
  }
}

// API Routes

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    lastUpdate,
    nextUpdate,
    updateIntervalMinutes: 30,
    totalStations: cachedStations.length,
    isUpdating,
    updateError
  });
});

// Provinces endpoint
app.get('/api/provinces', (req, res) => {
  res.json({
    success: true,
    provinces: cachedProvinces
  });
});

// Gas stations search / filter endpoint
app.get('/api/gasolineras', (req, res) => {
  const {
    fuel = 'gasolina95',
    provincia = '',
    municipio = '',
    search = '',
    brand = '',
    lat = null,
    lon = null,
    radius = null,
    sortBy = 'price_asc',
    limit = '50',
    page = '1'
  } = req.query;

  const userLat = lat ? parseFloat(lat) : null;
  const userLon = lon ? parseFloat(lon) : null;
  const maxRadius = radius ? parseFloat(radius) : null;

  let results = cachedStations;

  // Filter by fuel availability
  if (fuel && fuel !== 'all') {
    results = results.filter(s => s.precios[fuel] !== null && s.precios[fuel] > 0);
  }

  // Filter by province
  if (provincia && provincia !== 'TODAS') {
    const provNorm = provincia.trim().toUpperCase();
    results = results.filter(s => s.provincia === provNorm);
  }

  // Filter by municipality
  if (municipio) {
    const munNorm = municipio.trim().toLowerCase();
    results = results.filter(s => s.municipio.toLowerCase().includes(munNorm));
  }

  // Filter by search keyword (name, address, postal code, municipality)
  if (search) {
    const q = search.trim().toLowerCase();
    results = results.filter(s =>
      s.rotulo.toLowerCase().includes(q) ||
      s.direccion.toLowerCase().includes(q) ||
      s.municipio.toLowerCase().includes(q) ||
      s.localidad.toLowerCase().includes(q) ||
      s.cp.includes(q)
    );
  }

  // Filter by brand
  if (brand) {
    const b = brand.trim().toLowerCase();
    if (b === 'moeve') {
      results = results.filter(s => {
        const r = s.rotulo.toLowerCase();
        return r.includes('moeve') || r.includes('cepsa');
      });
    } else if (b === 'bonarea') {
      results = results.filter(s => {
        const r = s.rotulo.toLowerCase();
        return r.includes('bonarea') || r.includes('bon area') || r.includes('bonàrea');
      });
    } else {
      results = results.filter(s => s.rotulo.toLowerCase().includes(b));
    }
  }

  // Distance calculation & radius filter
  if (userLat !== null && userLon !== null && !isNaN(userLat) && !isNaN(userLon)) {
    results = results.map(s => {
      const distance = calculateDistance(userLat, userLon, s.lat, s.lon);
      return { ...s, distance };
    });

    if (maxRadius && !isNaN(maxRadius) && maxRadius > 0) {
      results = results.filter(s => s.distance !== null && s.distance <= maxRadius);
    }
  }

  // Calculate statistics for the filtered dataset
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let priceSum = 0;
  let priceCount = 0;

  if (fuel && fuel !== 'all') {
    for (const s of results) {
      const p = s.precios[fuel];
      if (p !== null && p > 0) {
        if (p < minPrice) minPrice = p;
        if (p > maxPrice) maxPrice = p;
        priceSum += p;
        priceCount++;
      }
    }
  }

  const stats = {
    totalCount: results.length,
    minPrice: priceCount > 0 ? minPrice : null,
    maxPrice: priceCount > 0 ? maxPrice : null,
    avgPrice: priceCount > 0 ? parseFloat((priceSum / priceCount).toFixed(3)) : null
  };

  // Sorting
  results.sort((a, b) => {
    if (sortBy === 'price_asc' && fuel && fuel !== 'all') {
      const pA = a.precios[fuel] ?? 999;
      const pB = b.precios[fuel] ?? 999;
      return pA - pB;
    }
    if (sortBy === 'price_desc' && fuel && fuel !== 'all') {
      const pA = a.precios[fuel] ?? -1;
      const pB = b.precios[fuel] ?? -1;
      return pB - pA;
    }
    if (sortBy === 'distance_asc') {
      const dA = a.distance ?? 999999;
      const dB = b.distance ?? 999999;
      return dA - dB;
    }
    if (sortBy === 'name_asc') {
      return a.rotulo.localeCompare(b.rotulo, 'es');
    }
    return 0;
  });

  // Pagination
  const parsedLimit = limit === 'all' ? results.length : Math.max(1, parseInt(limit, 10) || 50);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const paginatedStations = results.slice(startIndex, startIndex + parsedLimit);

  res.json({
    success: true,
    stats,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(results.length / parsedLimit) || 1,
    stations: paginatedStations
  });
});

// Force manual refresh
app.post('/api/refresh', async (req, res) => {
  if (isUpdating) {
    return res.json({ success: false, message: 'La actualización ya está en curso' });
  }
  await fetchGasStations();
  res.json({
    success: !updateError,
    message: updateError ? `Error: ${updateError}` : 'Actualización completada',
    lastUpdate,
    nextUpdate,
    totalStations: cachedStations.length
  });
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server and initialize timer
app.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`⛽ Servidor Gasolineras iniciado en http://localhost:${PORT}`);
  console.log(`⏱️  Actualización programada cada 30 minutos`);
  console.log(`======================================================\n`);

  await fetchGasStations();

  // Set recurring interval for 30 minutes
  setInterval(fetchGasStations, REFRESH_INTERVAL_MS);
});
