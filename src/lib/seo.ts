export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function getGasStationSchema(station: {
  id: string;
  rotulo: string;
  direccion: string;
  cp: string;
  localidad: string;
  municipio: string;
  provincia: string;
  horario: string;
  lat: number;
  lon: number;
  url: string;
  precios: Record<string, number | null>;
}) {
  const priceSpecs = Object.entries(station.precios)
    .filter(([_, price]) => typeof price === 'number' && price > 0)
    .map(([fuel, price]) => ({
      '@type': 'UnitPriceSpecification',
      price: price as number,
      priceCurrency: 'EUR',
      unitCode: 'LTR',
      name: fuel,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: `${station.rotulo} - ${station.municipio}`,
    identifier: station.id,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.direccion,
      addressLocality: station.municipio,
      postalCode: station.cp,
      addressRegion: station.provincia,
      addressCountry: 'ES',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.lat,
      longitude: station.lon,
    },
    openingHours: station.horario === 'L-D: 24H' ? 'Mo-Su 00:00-24:00' : station.horario,
    url: station.url,
    priceRange: '€€',
    makesOffer: priceSpecs,
  };
}
