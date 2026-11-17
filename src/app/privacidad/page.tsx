import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getTitular, valorOPendiente, type Titular } from '@/lib/legal';
import { getAdSenseClient } from '@/lib/adsense';
import { getSiteUrl } from '@/lib/miteco';
import { SITE_NAME } from '@/lib/site';

const PATH = '/privacidad';
const URL_AEPD = 'https://www.aepd.es';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: `Cómo trata ${SITE_NAME} los datos personales conforme al RGPD.`,
  robots: { index: false, follow: true },
  alternates: { canonical: `${getSiteUrl()}${PATH}` }
};

export default function PrivacidadPage() {
  const titular = getTitular();
  const dato = (campo: keyof Titular) => valorOPendiente(titular, campo);
  const adsenseActive = getAdSenseClient() !== null;

  return (
    <LegalPage title="Política de privacidad" path={PATH} breadcrumbLabel="Privacidad">
      <h2>Responsable del tratamiento</h2>
      <p>
        Responsable: {dato('nombre')}, con NIF {dato('nif')} y domicilio en {dato('domicilio')}. Contacto: {dato('email')}.
      </p>

      <h2>Qué datos se tratan</h2>
      <p>
        Esta web no tiene registro de usuarios ni formularios, y no recoge datos personales directamente.
      </p>
      <ul>
        <li>
          «Cerca de mí»: si pulsas este botón, el navegador te pide permiso para conocer tu ubicación. Se usa solo en tu navegador para calcular distancias a las gasolineras y no se envía a ningún servidor.
        </li>
        <li>
          Correo electrónico: si escribes al titular, se usan tu mensaje y tu dirección para responderte. La base jurídica es tu solicitud o el interés legítimo.
        </li>
      </ul>

      <h2>Datos técnicos que reciben terceros</h2>
      <p>
        Al cargar la página, tu navegador descarga recursos de terceros y estos reciben tu dirección IP y datos técnicos como el navegador o el idioma. La base jurídica es el interés legítimo en el funcionamiento de la web{adsenseActive ? ' y, en el caso de la publicidad, tu consentimiento' : ''}.
      </p>
      <ul>
        <li>Proveedores de teselas del mapa: OpenStreetMap y Esri, al mostrar mapas.</li>
        <li>Cloudflare R2, donde se almacena el histórico de precios por gasolinera, al consultar la ficha de una estación.</li>
        <li>El proveedor de alojamiento, que puede registrar la IP por motivos de seguridad.</li>
        {adsenseActive && (
          <li>
            Google AdSense (Google Ireland Ltd.), que puede instalar cookies y tratar datos del dispositivo solo si das tu consentimiento. Consulta la política de cookies.
          </li>
        )}
      </ul>

      {adsenseActive && (
        <>
          <h2>Transferencias internacionales</h2>
          <p>
            Google puede transferir datos a Estados Unidos con cláusulas contractuales tipo de la Comisión Europea y, cuando aplica, bajo el Marco de Privacidad de Datos UE-EE. UU.
          </p>
        </>
      )}

      <h2>Plazos de conservación</h2>
      <p>
        Los correos se conservan el tiempo necesario para atender tu consulta y, después, durante los plazos legales de posible responsabilidad. Los datos técnicos los conserva cada tercero según su propia política.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad escribiendo a {dato('email')}, indicando el derecho que ejercitas.
        {adsenseActive && ' Puedes retirar el consentimiento en cualquier momento desde el botón «Configurar cookies» del pie de página.'}
      </p>

      <h2>Reclamaciones</h2>
      <p>
        Si crees que se han vulnerado tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (AEPD): <a href={URL_AEPD} target="_blank" rel="noopener noreferrer">aepd.es</a>.
      </p>
    </LegalPage>
  );
}
