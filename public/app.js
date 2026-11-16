/**
 * Gasolineras España - Frontend App
 * Conexión a la API oficial de Transición Ecológica con auto-actualización cada 30 min,
 * soporte de temas (Modo Oscuro / Modo Claro) y logos de marcas oficiales.
 */

// Configuración de logos de marcas
const BRAND_CONFIG = {
  repsol: {
    name: 'Repsol',
    logo: '/logos/repsol.png',
    matches: (str) => str.includes('repsol')
  },
  moeve: {
    name: 'Moeve',
    logo: '/logos/moeve.png',
    matches: (str) => str.includes('moeve') || str.includes('cepsa')
  },
  ballenoil: {
    name: 'Ballenoil',
    logo: '/logos/ballenoil.png',
    matches: (str) => str.includes('ballenoil')
  },
  bonarea: {
    name: 'bonÀrea',
    logo: '/logos/bonarea.png',
    matches: (str) => str.includes('bonarea') || str.includes('bon area') || str.includes('bonàrea')
  },
  alcampo: {
    name: 'Alcampo',
    logo: '/logos/alcampo.png',
    matches: (str) => str.includes('alcampo')
  },
  carrefour: {
    name: 'Carrefour',
    logo: '/logos/carrefour.png',
    matches: (str) => str.includes('carrefour')
  },
  costco: {
    name: 'Costco',
    logo: '/logos/costco.png',
    matches: (str) => str.includes('costco')
  }
};

function getStationBrand(rotulo) {
  if (!rotulo) return null;
  const lower = rotulo.toLowerCase();
  for (const [key, item] of Object.entries(BRAND_CONFIG)) {
    if (item.matches(lower)) {
      return { key, ...item };
    }
  }
  return null;
}

// Estado global de la aplicación
const state = {
  fuel: 'gasolina95',
  provincia: 'TODAS',
  search: '',
  brand: '',
  sortBy: 'price_asc',
  page: 1,
  limit: 48,
  userLat: null,
  userLon: null,
  radius: 15,
  isGeoActive: false,
  view: 'list', // 'list' | 'map'
  theme: 'dark', // 'dark' | 'light'
  mapLayer: 'dark', // 'dark' | 'carto' | 'osm' | 'sat'
  lastUpdate: null,
  nextUpdate: null,
  totalFound: 0,
  minPrice: null,
  stations: [],
  map: null,
  activeTileLayers: [],
  markersLayer: null,
  timerInterval: null
};

// Nombres legibles para combustibles
const FUEL_NAMES = {
  gasolina95: 'Gasolina 95 E5',
  diesel: 'Gasóleo A (Diésel)',
  gasolina98: 'Gasolina 98',
  dieselPremium: 'Diésel Premium',
  glp: 'Autogás GLP',
  gnc: 'Gas Natural Comprimido'
};

// Elementos del DOM
const dom = {
  fuelChips: document.getElementById('fuelChips'),
  brandChips: document.getElementById('brandChips'),
  selectProvince: document.getElementById('selectProvince'),
  selectSort: document.getElementById('selectSort'),
  optSortDistance: document.getElementById('optSortDistance'),
  inputSearch: document.getElementById('inputSearch'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  btnGeo: document.getElementById('btnGeo'),
  geoBtnText: document.getElementById('geoBtnText'),
  radiusControl: document.getElementById('radiusControl'),
  btnCancelGeo: document.getElementById('btnCancelGeo'),
  btnViewList: document.getElementById('btnViewList'),
  btnViewMap: document.getElementById('btnViewMap'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeIconDark: document.getElementById('themeIconDark'),
  themeIconLight: document.getElementById('themeIconLight'),
  themeText: document.getElementById('themeText'),
  mapViewContainer: document.getElementById('mapViewContainer'),
  mapCountBadge: document.getElementById('mapCountBadge'),
  btnMapPeninsula: document.getElementById('btnMapPeninsula'),
  btnMapCanarias: document.getElementById('btnMapCanarias'),
  mapLayerSelector: document.getElementById('mapLayerSelector'),
  listViewContainer: document.getElementById('listViewContainer'),
  stationsGrid: document.getElementById('stationsGrid'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  emptyState: document.getElementById('emptyState'),
  btnResetFilters: document.getElementById('btnResetFilters'),
  paginationContainer: document.getElementById('paginationContainer'),
  btnLoadMore: document.getElementById('btnLoadMore'),
  loadMoreCount: document.getElementById('loadMoreCount'),
  statusLastUpdate: document.getElementById('statusLastUpdate'),
  countdownTimer: document.getElementById('countdownTimer'),
  btnManualRefresh: document.getElementById('btnManualRefresh'),
  refreshIcon: document.getElementById('refreshIcon'),
  statCount: document.getElementById('statCount'),
  statMinPrice: document.getElementById('statMinPrice'),
  statAvgPrice: document.getElementById('statAvgPrice'),
  statMaxPrice: document.getElementById('statMaxPrice'),
  statFilterDesc: document.getElementById('statFilterDesc')
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await loadProvinces();
  await checkStatus();
  await fetchStations(true);
  startCountdownLoop();
});

// Control del tema (Modo Claro / Modo Oscuro)
function initTheme() {
  const savedTheme = localStorage.getItem('gasolineras_theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gasolineras_theme', theme);

  if (theme === 'light') {
    dom.themeIconDark.style.display = 'none';
    dom.themeIconLight.style.display = 'inline-block';
    dom.themeText.textContent = 'Modo Oscuro';
    // Switch to CARTO Positron if currently on dark
    if (state.mapLayer === 'dark') {
      setMapLayer('carto');
    }
  } else {
    dom.themeIconDark.style.display = 'inline-block';
    dom.themeIconLight.style.display = 'none';
    dom.themeText.textContent = 'Modo Claro';
    // Switch to Dark Canvas if currently on carto
    if (state.mapLayer === 'carto') {
      setMapLayer('dark');
    }
  }
}

function toggleTheme() {
  const nextTheme = state.theme === 'light' ? 'dark' : 'light';
  setTheme(nextTheme);
}

// Event Listeners
function setupEventListeners() {
  // Theme toggle
  dom.btnThemeToggle.addEventListener('click', toggleTheme);

  // Fuel type chips
  dom.fuelChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.fuel-chip');
    if (!chip) return;
    document.querySelectorAll('.fuel-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.fuel = chip.dataset.fuel;
    state.page = 1;
    fetchStations(true);
  });

  // Brand filter chips
  if (dom.brandChips) {
    dom.brandChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.brand-chip');
      if (!chip) return;
      document.querySelectorAll('.brand-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.brand = chip.dataset.brand || '';
      state.page = 1;
      fetchStations(true);
    });
  }

  // Province change
  dom.selectProvince.addEventListener('change', (e) => {
    state.provincia = e.target.value;
    state.page = 1;
    fetchStations(true);
  });

  // Sort change
  dom.selectSort.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    state.page = 1;
    fetchStations(true);
  });

  // Search input with debounce
  let searchTimeout = null;
  dom.inputSearch.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    dom.btnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = val;
      state.page = 1;
      fetchStations(true);
    }, 300);
  });

  dom.btnClearSearch.addEventListener('click', () => {
    dom.inputSearch.value = '';
    dom.btnClearSearch.style.display = 'none';
    state.search = '';
    state.page = 1;
    fetchStations(true);
  });

  // Geolocation button
  dom.btnGeo.addEventListener('click', toggleGeolocation);
  dom.btnCancelGeo.addEventListener('click', deactivateGeolocation);

  // Radius buttons
  dom.radiusControl.addEventListener('click', (e) => {
    const btn = e.target.closest('.radius-btn');
    if (!btn) return;
    document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.radius = parseInt(btn.dataset.radius, 10);
    state.page = 1;
    fetchStations(true);
  });

  // View switchers
  dom.btnViewList.addEventListener('click', () => switchView('list'));
  dom.btnViewMap.addEventListener('click', () => switchView('map'));

  // Map toolbar controls (Estilo zbe-map)
  if (dom.btnMapPeninsula) {
    dom.btnMapPeninsula.addEventListener('click', () => {
      if (state.map) state.map.flyTo([40.2, -3.7], 6, { duration: 0.8 });
    });
  }

  if (dom.btnMapCanarias) {
    dom.btnMapCanarias.addEventListener('click', () => {
      if (state.map) state.map.flyTo([28.3, -15.8], 8, { duration: 0.8 });
    });
  }

  if (dom.mapLayerSelector) {
    dom.mapLayerSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.map-layer-btn');
      if (!btn) return;
      setMapLayer(btn.dataset.layer);
    });
  }

  // Load more pagination
  dom.btnLoadMore.addEventListener('click', () => {
    state.page++;
    fetchStations(false);
  });

  // Reset filters button
  dom.btnResetFilters.addEventListener('click', () => {
    state.provincia = 'TODAS';
    state.search = '';
    state.brand = '';
    dom.inputSearch.value = '';
    dom.btnClearSearch.style.display = 'none';
    dom.selectProvince.value = 'TODAS';
    if (dom.brandChips) {
      document.querySelectorAll('.brand-chip').forEach(c => c.classList.remove('active'));
      dom.brandChips.querySelector('[data-brand=""]')?.classList.add('active');
    }
    if (state.isGeoActive) deactivateGeolocation();
    state.page = 1;
    fetchStations(true);
  });

  // Manual refresh
  dom.btnManualRefresh.addEventListener('click', handleManualRefresh);
}

// Cargar lista de provincias
async function loadProvinces() {
  try {
    const res = await fetch('/api/provinces');
    const data = await res.json();
    if (data.provinces && data.provinces.length > 0) {
      data.provinces.forEach(prov => {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        dom.selectProvince.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error al cargar provincias:', err);
  }
}

// Obtener estado y temporizador
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.success) {
      state.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
      state.nextUpdate = data.nextUpdate ? new Date(data.nextUpdate) : null;
      updateHeaderStatus();
    }
  } catch (err) {
    console.error('Error al verificar estado:', err);
  }
}

// Bucle de cuenta atrás
function startCountdownLoop() {
  if (state.timerInterval) clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    if (!state.nextUpdate) return;
    const now = new Date();
    const diff = state.nextUpdate - now;

    if (diff <= 0) {
      dom.countdownTimer.textContent = 'Actualizando...';
      checkStatus().then(() => fetchStations(true));
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      dom.countdownTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }, 1000);
}

function updateHeaderStatus() {
  if (state.lastUpdate) {
    const timeStr = state.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dom.statusLastUpdate.textContent = `Actualizado a las ${timeStr}`;
  } else {
    dom.statusLastUpdate.textContent = 'Sincronizando...';
  }
}

// Forzar actualización manual
async function handleManualRefresh() {
  dom.btnManualRefresh.classList.add('spinning');
  dom.btnManualRefresh.disabled = true;
  dom.statusLastUpdate.textContent = 'Consultando MITECO...';

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const data = await res.json();
    if (data.lastUpdate) {
      state.lastUpdate = new Date(data.lastUpdate);
      state.nextUpdate = new Date(data.nextUpdate);
      updateHeaderStatus();
      await fetchStations(true);
    }
  } catch (err) {
    console.error('Error en actualización manual:', err);
  } finally {
    dom.btnManualRefresh.classList.remove('spinning');
    dom.btnManualRefresh.disabled = false;
  }
}

// Geolocalización
function toggleGeolocation() {
  if (state.isGeoActive) {
    deactivateGeolocation();
    return;
  }

  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización');
    return;
  }

  dom.geoBtnText.textContent = 'Obteniendo GPS...';
  dom.btnGeo.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLat = pos.coords.latitude;
      state.userLon = pos.coords.longitude;
      state.isGeoActive = true;
      dom.btnGeo.disabled = false;
      dom.btnGeo.classList.add('active');
      dom.geoBtnText.textContent = '📍 Mi Ubicación Activa';
      dom.radiusControl.style.display = 'flex';
      dom.optSortDistance.disabled = false;
      state.sortBy = 'distance_asc';
      dom.selectSort.value = 'distance_asc';
      state.page = 1;
      fetchStations(true);
    },
    (err) => {
      console.warn('Error GPS:', err.message);
      dom.btnGeo.disabled = false;
      dom.geoBtnText.textContent = 'Cerca de mí';
      alert('No se pudo acceder a tu ubicación. Por favor permite los permisos de ubicación en tu navegador.');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function deactivateGeolocation() {
  state.isGeoActive = false;
  state.userLat = null;
  state.userLon = null;
  dom.btnGeo.classList.remove('active');
  dom.geoBtnText.textContent = 'Cerca de mí';
  dom.radiusControl.style.display = 'none';
  dom.optSortDistance.disabled = true;
  if (state.sortBy === 'distance_asc') {
    state.sortBy = 'price_asc';
    dom.selectSort.value = 'price_asc';
  }
  state.page = 1;
  fetchStations(true);
}

// Cambiar de vista (Lista / Mapa)
function switchView(viewName) {
  state.view = viewName;
  if (viewName === 'list') {
    dom.btnViewList.classList.add('active');
    dom.btnViewMap.classList.remove('active');
    dom.listViewContainer.style.display = 'flex';
    dom.mapViewContainer.style.display = 'none';
  } else {
    dom.btnViewList.classList.remove('active');
    dom.btnViewMap.classList.add('active');
    dom.listViewContainer.style.display = 'none';
    dom.mapViewContainer.style.display = 'block';
    initOrUpdateMap();
  }
}

// Consulta de gasolineras al backend
async function fetchStations(resetPage = false) {
  if (resetPage) {
    state.page = 1;
    dom.stationsGrid.innerHTML = '';
    dom.loadingIndicator.style.display = 'flex';
    dom.emptyState.style.display = 'none';
  }

  const params = new URLSearchParams({
    fuel: state.fuel,
    provincia: state.provincia,
    search: state.search,
    brand: state.brand,
    sortBy: state.sortBy,
    limit: state.limit,
    page: state.page
  });

  if (state.isGeoActive && state.userLat && state.userLon) {
    params.append('lat', state.userLat);
    params.append('lon', state.userLon);
    params.append('radius', state.radius);
  }

  try {
    const res = await fetch(`/api/gasolineras?${params.toString()}`);
    const data = await res.json();

    dom.loadingIndicator.style.display = 'none';

    if (resetPage) {
      state.stations = data.stations || [];
    } else {
      state.stations = [...state.stations, ...(data.stations || [])];
    }

    state.totalFound = data.stats.totalCount || 0;
    state.minPrice = data.stats.minPrice;

    // Actualizar Ribbon de Estadísticas
    updateStatsRibbon(data.stats);

    // Renderizar tarjetas
    if (resetPage) {
      dom.stationsGrid.innerHTML = '';
    }

    if (state.stations.length === 0) {
      dom.emptyState.style.display = 'flex';
      dom.paginationContainer.style.display = 'none';
    } else {
      dom.emptyState.style.display = 'none';
      renderCards(data.stations || []);

      // Control de paginación
      if (data.page < data.totalPages) {
        dom.paginationContainer.style.display = 'flex';
        const remaining = state.totalFound - state.stations.length;
        dom.loadMoreCount.textContent = `Quedan ${remaining}`;
      } else {
        dom.paginationContainer.style.display = 'none';
      }
    }

    // Actualizar mapa si está visible
    if (state.view === 'map') {
      initOrUpdateMap();
    }
  } catch (err) {
    console.error('Error al obtener gasolineras:', err);
    dom.loadingIndicator.style.display = 'none';
  }
}

// Actualizar barra de estadísticas
function updateStatsRibbon(stats) {
  dom.statCount.textContent = stats.totalCount ? stats.totalCount.toLocaleString('es-ES') : '0';
  
  let filterDesc = state.provincia === 'TODAS' ? 'en toda España' : `en ${state.provincia}`;
  if (state.brand) {
    const brandObj = BRAND_CONFIG[state.brand];
    filterDesc += ` (${brandObj ? brandObj.name : state.brand})`;
  }
  dom.statFilterDesc.textContent = filterDesc;

  if (stats.minPrice) {
    dom.statMinPrice.textContent = `${stats.minPrice.toFixed(3)} €/L`;
  } else {
    dom.statMinPrice.textContent = '-- €/L';
  }

  if (stats.avgPrice) {
    dom.statAvgPrice.textContent = `${stats.avgPrice.toFixed(3)} €/L`;
  } else {
    dom.statAvgPrice.textContent = '-- €/L';
  }

  if (stats.maxPrice) {
    dom.statMaxPrice.textContent = `${stats.maxPrice.toFixed(3)} €/L`;
  } else {
    dom.statMaxPrice.textContent = '-- €/L';
  }
}

// Renderizar tarjetas en la lista
function renderCards(stations) {
  stations.forEach(s => {
    const card = createStationCard(s);
    dom.stationsGrid.appendChild(card);
  });
}

function createStationCard(s) {
  const card = document.createElement('article');
  card.className = 'station-card';

  const currentPrice = s.precios[state.fuel];
  const isCheapest = state.minPrice && currentPrice && currentPrice <= state.minPrice;
  if (isCheapest) {
    card.classList.add('is-cheapest');
  }

  // Comprobar si la estación tiene logo oficial de marca
  const brandInfo = getStationBrand(s.rotulo);

  let brandBadgeHtml = '';
  if (brandInfo) {
    brandBadgeHtml = `
      <div class="brand-logo-pill" title="${escapeHtml(brandInfo.name)}">
        <img src="${brandInfo.logo}" alt="${escapeHtml(brandInfo.name)}" class="brand-logo-img">
        <span class="brand-text-with-logo">${escapeHtml(s.rotulo)}</span>
      </div>
    `;
  } else {
    brandBadgeHtml = `<span class="brand-badge-generic">${escapeHtml(s.rotulo)}</span>`;
  }

  // Precios secundarios disponibles
  const secondaryFuelKeys = Object.keys(s.precios).filter(k => k !== state.fuel && s.precios[k] !== null);
  const secondaryHtml = secondaryFuelKeys.slice(0, 3).map(k => {
    const shortLabel = k === 'gasolina95' ? 'G95' :
                       k === 'diesel' ? 'Diésel' :
                       k === 'gasolina98' ? 'G98' :
                       k === 'dieselPremium' ? 'D+' :
                       k === 'glp' ? 'GLP' : k;
    return `<div class="subfuel-pill">${shortLabel}: <strong>${s.precios[k].toFixed(3)}€</strong></div>`;
  }).join('');

  // Distancia
  let distanceHtml = '';
  if (s.distance !== undefined && s.distance !== null) {
    distanceHtml = `<span class="badge-distance">📍 ${s.distance} km</span>`;
  }

  // Google Maps URL
  const navUrl = s.lat && s.lon 
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}` 
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.rotulo + ' ' + s.direccion + ' ' + s.municipio)}`;

  card.innerHTML = `
    <div class="card-top">
      <div class="brand-badge-wrapper">
        ${brandBadgeHtml}
      </div>
      <div class="card-badges-right">
        ${isCheapest ? '<span class="badge-cheapest">🔥 Más barata</span>' : ''}
        ${distanceHtml}
      </div>
    </div>

    <div class="card-info">
      <h3 class="station-name">${escapeHtml(s.rotulo)}</h3>
      <p class="station-location">${escapeHtml(s.direccion)}, ${escapeHtml(s.municipio)} (${escapeHtml(s.provincia)})</p>
      <div class="station-schedule">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>${escapeHtml(s.horario)}</span>
      </div>
    </div>

    <div class="card-pricing-block">
      <div class="main-price-wrapper">
        <span class="main-price-label">${FUEL_NAMES[state.fuel] || state.fuel}</span>
        <span class="main-price-value">${currentPrice ? currentPrice.toFixed(3) : '--'} <span class="main-price-unit">€/L</span></span>
      </div>
      <div class="secondary-fuels">
        ${secondaryHtml}
      </div>
    </div>

    <div class="card-actions">
      <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="btn-directions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
        <span>Cómo llegar</span>
      </a>
    </div>
  `;

  return card;
}

// Cambiar capa del mapa (Oscuro, CARTO, OSM, Satélite)
function setMapLayer(layerName) {
  state.mapLayer = layerName;

  // Actualizar botones activos
  if (dom.mapLayerSelector) {
    dom.mapLayerSelector.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === layerName);
    });
  }

  if (state.map && window.L) {
    applyTileLayer(state.map, window.L, layerName);
  }
}

// Aplicar capa de mapa según estilo de desktop/pruebas/zbe-map (100% libre, sin API keys)
function applyTileLayer(map, L, layerName) {
  if (state.activeTileLayers && state.activeTileLayers.length > 0) {
    state.activeTileLayers.forEach(layer => {
      try { map.removeLayer(layer); } catch (e) {}
    });
  }
  state.activeTileLayers = [];

  if (layerName === 'carto') {
    // 1. CARTO Positron Minimalista (No key required)
    const cartoLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    );
    cartoLayer.addTo(map);
    state.activeTileLayers.push(cartoLayer);
  } else if (layerName === 'dark') {
    // 2. Esri Dark Gray Canvas (Base + Reference - Libre sin keys, como en zbe-map)
    const darkBase = L.tileLayer(
      'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, OpenStreetMap contributors',
        maxZoom: 16
      }
    );
    const darkRef = L.tileLayer(
      'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16
      }
    );
    darkBase.addTo(map);
    darkRef.addTo(map);
    state.activeTileLayers.push(darkBase, darkRef);
  } else if (layerName === 'osm') {
    // 3. OpenStreetMap Estándar (Libre sin keys)
    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19
      }
    );
    osmLayer.addTo(map);
    state.activeTileLayers.push(osmLayer);
  } else if (layerName === 'sat') {
    // 4. Esri World Imagery Satélite (Libre sin keys)
    const satLayer = L.tileLayer(
      'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, Maxar',
        maxZoom: 18
      }
    );
    satLayer.addTo(map);
    state.activeTileLayers.push(satLayer);
  }
}

// Mapa con Leaflet (Estilo desktop/pruebas/zbe-map, 100% sin keys requeridas)
function initOrUpdateMap() {
  if (!dom.mapViewContainer || typeof window.L === 'undefined') return;

  if (!state.map) {
    // Coordenadas centrales de España como en zbe-map
    state.map = L.map('map', {
      center: [40.2, -3.7],
      zoom: 6,
      minZoom: 5,
      maxZoom: 20,
      zoomControl: false
    });

    // Control de zoom arriba a la derecha (estilo zbe-map)
    L.control.zoom({ position: 'topright' }).addTo(state.map);

    // Cargar capa inicial (dark por defecto en tema oscuro, carto en tema claro)
    applyTileLayer(state.map, window.L, state.mapLayer);

    state.markersLayer = L.layerGroup().addTo(state.map);
  }

  setTimeout(() => {
    state.map.invalidateSize();
  }, 100);

  // Limpiar marcadores anteriores
  state.markersLayer.clearLayers();

  const validStations = state.stations.filter(s => s.lat && s.lon && s.precios[state.fuel]);
  
  if (dom.mapCountBadge) {
    dom.mapCountBadge.textContent = `${validStations.length.toLocaleString('es-ES')} gasolineras`;
  }

  if (validStations.length === 0) return;

  const bounds = [];

  validStations.slice(0, 300).forEach(s => {
    const price = s.precios[state.fuel];
    const isCheapest = state.minPrice && price <= state.minPrice;
    const brandInfo = getStationBrand(s.rotulo);

    // Marcador HTML personalizado negro y naranja con el precio
    const customIcon = L.divIcon({
      className: 'custom-station-pin-wrapper',
      html: `<div class="custom-station-pin ${isCheapest ? 'is-best' : ''}">${price.toFixed(3)}€</div>`,
      iconSize: [60, 24],
      iconAnchor: [30, 12]
    });

    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;

    const logoHtml = brandInfo 
      ? `<img src="${brandInfo.logo}" alt="${escapeHtml(brandInfo.name)}" class="popup-station-img">`
      : '';

    const popupHtml = `
      <div class="popup-station-card">
        <div class="popup-station-header">
          ${logoHtml}
          <h4>${escapeHtml(s.rotulo)}</h4>
        </div>
        <p>${escapeHtml(s.direccion)}, ${escapeHtml(s.municipio)}</p>
        <div class="popup-price-tag">${price.toFixed(3)} €/L</div>
        <p style="font-size:0.75rem; color:var(--text-muted);">Horario: ${escapeHtml(s.horario)}</p>
        <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="popup-directions">
          Cómo llegar &rarr;
        </a>
      </div>
    `;

    const marker = L.marker([s.lat, s.lon], { icon: customIcon })
      .bindPopup(popupHtml);

    state.markersLayer.addLayer(marker);
    bounds.push([s.lat, s.lon]);
  });

  // Si hay ubicación de usuario, añadir marcador de usuario
  if (state.isGeoActive && state.userLat && state.userLon) {
    const userIcon = L.divIcon({
      className: 'user-pin',
      html: `<div style="background:#ff6600; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px #ff6600;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const userMarker = L.marker([state.userLat, state.userLon], { icon: userIcon })
      .bindPopup('<b>Tu ubicación</b>');
    state.markersLayer.addLayer(userMarker);
    bounds.push([state.userLat, state.userLon]);
  }

  // Si se ha filtrado por búsqueda o provincia, ajustar encuadre
  if ((state.provincia !== 'TODAS' || state.search || state.isGeoActive) && bounds.length > 0) {
    state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

// Utilidad para sanitizar texto
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
