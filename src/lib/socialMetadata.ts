import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from './site.ts';

/** Ruta de la imagen social (dentro de public/), común a todas las páginas. */
export const SOCIAL_IMAGE_PATH = '/brand/ododex-og.png';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_ALT = 'Precio de gasolineras en España · Ododex';
export const SOCIAL_LOCALE = 'es_ES';

export interface SocialMetadataInput {
  title: string;
  description: string;
  /** Ruta interna de la página, sin BASE_PATH ('/' para la portada). */
  path: string;
}

/**
 * Open Graph y Twitter Card de una página con la imagen de marca. Next sustituye `openGraph`
 * entero cuando una página lo define, por eso cada `generateMetadata` debe usar esta función
 * en vez de repetir un objeto sin `images`. El título va sin la marca: la aporta `siteName`.
 */
export function buildSocialMetadata(input: SocialMetadataInput): Pick<Metadata, 'openGraph' | 'twitter'> {
  const { title, description, path } = input;
  const image = absoluteUrl(SOCIAL_IMAGE_PATH);
  return {
    openGraph: {
      type: 'website',
      locale: SOCIAL_LOCALE,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: image, width: SOCIAL_IMAGE_WIDTH, height: SOCIAL_IMAGE_HEIGHT, alt: SOCIAL_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
