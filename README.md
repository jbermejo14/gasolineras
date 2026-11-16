# ⛽ Precios Gasolineras España (MITECO)

Aplicación web moderna y minimalista con diseño en **negro y naranja** que consume la API pública oficial del **Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)**, mostrando los precios en tiempo real de más de 11.500 estaciones de servicio en toda España y auto-actualizándose cada **30 minutos**.

---

## 🚀 Características

- ⚡ **Auto-actualización cada 30 minutos**: Temporizador en vivo visible en la cabecera que sincroniza los precios automáticamente desde la API de MITECO en segundo plano, con opción de actualización manual forzada.
- 🎨 **Diseño en Negro y Naranja**: Interfaz limpia, minimalista, de alto contraste (fondo oscuro profundo con acentos y distintivos en naranja brillante).
- 🏷️ **Selector de Combustibles**:
  - Gasolina 95 E5
  - Diésel / Gasóleo A
  - Gasolina 98 E5
  - Diésel Plus / Premium
  - Autogás GLP
  - Gas Natural (GNC)
- 🔍 **Búsqueda y Filtros Avanzados**:
  - Filtro por Provincia (las 52 provincias de España).
  - Búsqueda por texto (marca como Repsol, Cepsa, Plenoil, BP, calle, localidad o código postal).
  - Ordenación: Más baratas primero, más caras, más cercanas o alfabético.
- 📍 **Geolocalización ("Cerca de mí")**: Localiza estaciones con GPS y permite definir radio de búsqueda (5 km, 15 km, 30 km o 50 km).
- 🗺️ **Vista Dual (Lista y Mapa)**:
  - **Modo Lista**: Tarjetas con precios destacados, distintivo "Más barata", horarios y enlace directo a Google Maps ("Cómo llegar").
  - **Modo Mapa**: Mapa interactivo Leaflet con tema oscuro y pines naranja con el precio visible directamente.
- 📊 **Panel de Estadísticas**: Muestra precio mínimo, promedio y máximo para el filtro actual.

---

## 🛠️ Instalación y Uso

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar la aplicación**:
   ```bash
   npm start
   ```

3. Abrir en el navegador:
   ```
   http://localhost:3005
   ```
