# ⛽ Gasolineras España — SEO Programático con Next.js y MITECO

Aplicación web de **SEO programático** construida con **Next.js (App Router)**, **React 19** y **Tailwind CSS v4**, que consume en tiempo real los datos públicos oficiales del **Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)**.

Genera páginas indexables en el servidor para **52 provincias**, **~3.250 municipios** con gasolineras y más de **11.500 fichas de estaciones de servicio**, todas revalidadas cada **30 minutos**.

---

## 🚀 Arquitectura y Características

1. **SEO Programático Completo**:
   - `/`: Buscador interactivo nacional, mapa y cinta de estadísticas nacionales (mínimo, promedio, máximo y ahorro de depósito de 50L). El buscador descarga las estaciones desde `GET /api/estaciones` (JSON ligero, cacheado 30 minutos) en lugar de incrustarlas en el HTML.
   - Mapa del buscador: muestra **todas** las gasolineras que cumplen los filtros. Con zoom lejano se agrupan en burbujas (número de estaciones y precio mínimo); al acercarse (zoom 15 o más) aparecen todas sueltas con su precio. Solo se pintan las de la zona visible. La agrupación es una rejilla en píxeles propia (`src/lib/stationClustering.ts`), sin dependencias extra.
   - `/provincia/[provincia]`: Las más baratas por combustible, medias provinciales vs nacionales y directorio de municipios.
   - `/provincia/[provincia]/[municipio]`: Gasolineras más baratas hoy en el municipio, tabla ordenada por precio legible sin JavaScript, comparativa frente a la provincia, mapa municipal y municipios cercanos.
   - `/gasolinera/[id]-[slug]`: Ficha técnica de la estación con todos los carburantes disponibles, comparativa de ahorro, horario y mapa "Cómo llegar" con GPS.
   - `404`: Devuelve `notFound()` estricto para cualquier slug inexistente (nunca páginas genéricas).

2. **Módulo Central de Datos (`lib/miteco.ts`)**:
   - Descarga oficial de estaciones terrestres y listados oficiales de provincias y municipios de MITECO.
   - Validación y normalización estricta:
     - Descarta estaciones sin `IDEESS` o con coordenadas fuera del territorio de España.
     - Valida precios únicamente en el rango realista de **[0,50 €/l - 3,50 €/l]**.
     - Utiliza la fecha oficial devuelta por MITECO como fecha de actualización visible.
     - Sistema de fallback: si la API externa falla temporalmente, sirve los últimos datos buenos en caché sin sustituirlos por datos ficticios.

3. **SEO On-Page y Datos Estructurados**:
   - `title`, `description`, canonical absoluto y Open Graph únicos por página generados en el servidor.
   - Microdatos JSON-LD con Schema.org: `BreadcrumbList` en todas las páginas y `GasStation` con `UnitPriceSpecification` en las fichas de estaciones.
   - `sitemap.xml` dinámico autogenerado con más de 14.800 URLs indexables.
   - `robots.txt` configurado.
   - Dominio configurable mediante variable de entorno `NEXT_PUBLIC_SITE_URL` (sin URLs fijas en el código).

4. **Seguridad**:
   - Eliminado el refresco público sin autenticación y CORS abierto.
   - Endpoint de revalidación forzada `POST /api/refresh` protegido mediante token Bearer (`REFRESH_SECRET`).

5. **Rendimiento y Modo Oscuro/Claro**:
   - Logos corporativos optimizados en formato **WebP** servidos con `next/image` (14 marcas, ~160 KB en total).
   - Carga dinámica del mapa Leaflet (`ssr: false`) en componentes cliente independientes.
   - Soporte nativo de Modo Oscuro y Modo Claro con paleta Negro y Naranja persistente en `localStorage`.
   - Diseño adaptado a móvil (desde 360 px): filas de filtros desplazables en horizontal, controles táctiles de 40 px, campos de 16 px para evitar el zoom automático de iOS y mapa al 70 % del alto de pantalla.

El diseño de estos cambios está en [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🛠️ Instalación y Requisitos

- **Node.js**: v22.6 o superior (las pruebas usan `--experimental-strip-types` para ejecutar TypeScript)
- **npm**: 10+

```bash
# Instalar dependencias exactas
npm install
```

---

## ⚙️ Variables de Entorno

Copia el archivo `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Configura las variables según tu entorno:

```env
# Dominio base del sitio (sin barra final)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Secreto para autorizar la recarga manual mediante POST /api/refresh
REFRESH_SECRET=tu-clave-secreta-para-recarga-manual
```

---

## 🧪 Pruebas Unitarias Sin Red

Ejecuta el conjunto de pruebas unitarias (`tests/*.test.js` y `tests/*.test.ts`), basadas en un fixture real reducido de MITECO y en datos mínimos inventados:

```bash
npm test
```

Pruebas cubiertas:
- Normalización y validación de coordenadas y descarte de registros inválidos.
- Validación de rango de precios [0,50 - 3,50 €/l].
- Generación de slugs limpios sin tildes ni caracteres especiales.
- Cálculo de medias y mínimos municipales y provinciales.
- Comprobación de 404 para slugs no registrados.
- Simulación de generación del sitemap.
- Agrupación de estaciones del mapa por rejilla y fusión de burbujas solapadas (`tests/stationClustering.test.ts`).
- Formato ligero de `/api/estaciones` (`tests/stationPayload.test.ts`).
- Filtrado, ordenación y estadísticas del buscador (`tests/gasFinderLogic.test.ts`).

Comprobación de tipos de todo el proyecto:

```bash
npx tsc --noEmit
```

---

## 🏗️ Compilación y Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

---

## 🔒 Refresco Manual Forzado (Protegido)

Para forzar la actualización inmediata de la caché de MITECO sin esperar a la revalidación automática de 30 minutos:

```bash
curl -X POST http://localhost:3000/api/refresh \
  -H "Authorization: Bearer tu-clave-secreta-para-recarga-manual"
```
