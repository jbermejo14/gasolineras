import type { NextConfig } from "next";

// Debe coincidir con BASE_PATH de src/lib/site.ts (lo comprueba tests/site.test.ts).
// No se importa de allí porque Next compila este fichero a ESM y no resuelve
// importaciones TypeScript sin extensión.
const BASE_PATH = "/es/gasolineras";

// Exportación estática: el sitio se publica como ficheros en Cloudflare (ver ../ododex-sitio).
// El optimizador de imágenes necesita servidor, así que las imágenes se sirven tal cual.
const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  output: "export",
  // Tailwind se compila por PostCSS (postcss.config.mjs) y el build usa webpack: en Windows
  // con Control de Aplicaciones los binarios nativos de Tailwind y SWC están bloqueados y
  // Turbopack no tiene alternativa WASM. Mismo arreglo que ../multas-dgt.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
