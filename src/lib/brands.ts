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
  galp: {
    name: 'Galp',
    logo: '/logos/galp.webp',
    keywords: ['galp'],
  },
  bp: {
    name: 'BP',
    logo: '/logos/bp.webp',
    keywords: ['bp'],
  },
  shell: {
    name: 'Shell',
    logo: '/logos/shell.webp',
    keywords: ['shell'],
  },
  plenergy: {
    name: 'Plenergy',
    logo: '/logos/plenergy.webp',
    keywords: ['plenergy'],
  },
  petroprix: {
    name: 'Petroprix',
    logo: '/logos/petroprix.webp',
    keywords: ['petroprix'],
  },
  eroski: {
    name: 'Eroski',
    logo: '/logos/eroski.webp',
    keywords: ['eroski'],
  },
  tamoil: {
    name: 'Tamoil',
    logo: '/logos/tamoil.webp',
    keywords: ['tamoil'],
  },
};

const BRAND_REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const BRAND_WORD_CHAR = '[\\p{L}\\p{N}]';

function brandKeywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(BRAND_REGEX_SPECIAL_CHARS, '\\$&');
  return new RegExp(`(?<!${BRAND_WORD_CHAR})${escaped}(?!${BRAND_WORD_CHAR})`, 'iu');
}

/**
 * Indica si alguna keyword de la marca aparece en el rótulo como palabra
 * completa, sin distinguir mayúsculas. Separador = cualquier carácter que no
 * sea letra ni número Unicode.
 */
export function matchesBrand(rotulo: string, brand: BrandInfo): boolean {
  // Con `includes`, "bp" casaría dentro de otras palabras (p. ej. "SUBPRIME").
  return brand.keywords.some((keyword) => brandKeywordRegex(keyword).test(rotulo));
}

export function getStationBrand(rotulo: string): BrandInfo | null {
  if (!rotulo) return null;
  for (const item of Object.values(BRAND_CONFIG)) {
    if (matchesBrand(rotulo, item)) {
      return item;
    }
  }
  return null;
}
