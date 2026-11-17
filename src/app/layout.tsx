import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getMitecoData, getSiteUrl } from '@/lib/miteco';

export const revalidate = 1800; // 30 minutos ISR

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/**
 * Fija el tema antes de pintar para evitar el parpadeo: primero la elección guardada
 * y, si no hay, la preferencia del sistema. El try/catch cubre un localStorage no disponible.
 * Además de data-theme pone la clase dark/light, que es la que usa Tailwind.
 */
const THEME_SCRIPT = `
  (function() {
    var theme = null;
    try {
      var saved = localStorage.getItem('ododex-theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
      if (!theme) {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
    } catch (e) {
      theme = 'light';
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  })();
`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: 'Precios de Gasolineras en España Hoy | Actualizado cada 30 min (MITECO)',
      template: '%s | Gasolineras España (MITECO)',
    },
    description:
      'Consulta el precio de la gasolina 95, diésel y GLP en más de 11.500 gasolineras de España con datos oficiales del Ministerio para la Transición Ecológica actualizados cada 30 minutos.',
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      type: 'website',
      locale: 'es_ES',
      url: siteUrl,
      siteName: 'Gasolineras España',
      title: 'Precios de Gasolineras en España Hoy en Tiempo Real',
      description:
        'Encuentra las gasolineras más baratas por provincia, municipio y código postal con datos oficiales de MITECO.',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let fechaMiteco = '';
  try {
    const data = await getMitecoData();
    fechaMiteco = data.fechaMiteco;
  } catch (e) {
    // ignore
  }

  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
        <Header fechaMiteco={fechaMiteco} />
        <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 py-4 md:py-8">{children}</main>
        <Footer fechaMiteco={fechaMiteco} />
      </body>
    </html>
  );
}
