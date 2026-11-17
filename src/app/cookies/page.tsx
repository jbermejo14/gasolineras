import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getAdSenseClient } from '@/lib/adsense';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

const PATH = '/cookies';
const URL_COOKIES_GOOGLE = 'https://policies.google.com/technologies/cookies?hl=es';

export const metadata: Metadata = {
  title: 'Política de cookies',
  description: `Qué cookies y almacenamiento local usa ${SITE_NAME} y cómo gestionarlos.`,
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl(PATH) }
};

export default function CookiesPage() {
  const adsenseActive = getAdSenseClient() !== null;

  return (
    <LegalPage title="Política de cookies" path={PATH} breadcrumbLabel="Cookies">
      <h2>Qué son las cookies</h2>
      <p>
        Las cookies y tecnologías similares (como el almacenamiento local del navegador) guardan pequeños datos en tu dispositivo. Se regulan en el artículo 22.2 de la LSSI y en la Guía sobre el uso de las cookies de la AEPD.
      </p>

      <h2>Qué usa esta web</h2>
      <ul>
        <li>
          <code>ododex-theme</code> (localStorage): recuerda el tema claro u oscuro que eliges. Es una preferencia pedida por ti, por lo que está exenta de consentimiento. No caduca.
        </li>
        {adsenseActive && (
          <li>
            Cookies de Google AdSense: publicidad y medición, de tercero. Solo se instalan si aceptas en el aviso de consentimiento de Google. Su duración depende de Google.
          </li>
        )}
      </ul>
      {adsenseActive ? (
        <p>
          Más información sobre las cookies de Google en <a href={URL_COOKIES_GOOGLE} target="_blank" rel="noopener noreferrer">policies.google.com</a>.
        </p>
      ) : (
        <p>
          Ahora mismo esta web no muestra publicidad ni usa cookies publicitarias o de medición. Si se activa en el futuro, esta página se actualizará y se pedirá tu consentimiento antes de instalarlas.
        </p>
      )}

      {adsenseActive && (
        <>
          <h2>Cambiar o retirar el consentimiento</h2>
          <p>
            Puedes cambiar tu elección en cualquier momento con el botón «Configurar cookies» del pie de página.
          </p>
        </>
      )}

      <h2>Borrar cookies desde el navegador</h2>
      <p>
        Puedes bloquear o eliminar las cookies y el almacenamiento local desde los ajustes de privacidad de tu navegador. Si borras <code>ododex-theme</code>, la web volverá al tema de tu sistema.
      </p>
    </LegalPage>
  );
}
