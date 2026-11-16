import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getMitecoData, getSiteUrl } from '@/lib/miteco';

export const revalidate = 1800; // 30 minutos ISR

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
    <html lang="es" data-theme="dark" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
        <Header fechaMiteco={fechaMiteco} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8">{children}</main>
        <Footer fechaMiteco={fechaMiteco} />
      </body>
    </html>
  );
}
