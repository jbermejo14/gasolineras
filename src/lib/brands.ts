export interface BrandInfo {
  name: string;
  logo: string;
  keywords: string[];
}

export const BRAND_CONFIG: Record<string, BrandInfo> = {
  repsol: {
    name: 'Repsol',
    logo: '/logos/repsol.webp',
    keywords: ['repsol'],
  },
  moeve: {
    name: 'Moeve',
    logo: '/logos/moeve.webp',
    keywords: ['moeve', 'cepsa'],
  },
  ballenoil: {
    name: 'Ballenoil',
    logo: '/logos/ballenoil.webp',
    keywords: ['ballenoil'],
  },
  bonarea: {
    name: 'bonÀrea',
    logo: '/logos/bonarea.webp',
    keywords: ['bonarea', 'bon area', 'bonàrea'],
  },
  alcampo: {
    name: 'Alcampo',
    logo: '/logos/alcampo.webp',
    keywords: ['alcampo'],
  },
  carrefour: {
    name: 'Carrefour',
    logo: '/logos/carrefour.webp',
    keywords: ['carrefour'],
  },
  costco: {
    name: 'Costco',
    logo: '/logos/costco.webp',
    keywords: ['costco'],
  },
};

export function getStationBrand(rotulo: string): BrandInfo | null {
  if (!rotulo) return null;
  const lower = rotulo.toLowerCase();
  for (const item of Object.values(BRAND_CONFIG)) {
    if (item.keywords.some((k) => lower.includes(k))) {
      return item;
    }
  }
  return null;
}
