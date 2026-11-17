import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getTitular, valorOPendiente, type Titular } from '@/lib/legal';
import { getSiteUrl } from '@/lib/miteco';
import { SITE_NAME } from '@/lib/site';

const PATH = '/aviso-legal';
const URL_MITECO = 'https://www.miteco.gob.es';

export const metadata: Metadata = {
  title: 'Aviso legal',
  description: `Aviso legal e información del titular de ${SITE_NAME} conforme al artículo 10 de la LSSI.`,
  robots: { index: false, follow: true },
  alternates: { canonical: `${getSiteUrl()}${PATH}` }
};

export default function AvisoLegalPage() {
  const titular = getTitular();
  const dato = (campo: keyof Titular) => valorOPendiente(titular, campo);

  return (
    <LegalPage title="Aviso legal" path={PATH}>
      <h2>Datos del titular</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI), se informa de que el titular de este sitio web es:
      </p>
      <ul>
        <li>Titular: {dato('nombre')}</li>
        <li>NIF: {dato('nif')}</li>
        <li>Domicilio: {dato('domicilio')}</li>
        <li>Correo electrónico de contacto: {dato('email')}</li>
        {titular.tipo === 'empresa' && <li>Datos del Registro Mercantil: {dato('registroMercantil')}</li>}
      </ul>

      <h2>Objeto del sitio</h2>
      <p>
        {SITE_NAME} es un comparador de precios de carburantes en las gasolineras de España que además muestra la evolución histórica de esos precios.
      </p>

      <h2>Fuente de los datos</h2>
      <p>
        Los precios proceden del Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO) y se reutilizan conforme a la normativa de reutilización de la información del sector público, citando la fuente y la fecha de los datos. Fuente: <a href={URL_MITECO} target="_blank" rel="noopener noreferrer">miteco.gob.es</a>.
      </p>
      <p>
        {SITE_NAME} es un sitio independiente: no tiene ninguna vinculación con el Ministerio ni cuenta con su respaldo.
      </p>

      <h2>Exactitud de los precios</h2>
      <p>
        Los precios son los que las estaciones de servicio comunican a MITECO y pueden no coincidir con los del surtidor. Antes de repostar, comprueba el precio en la propia estación. El histórico muestra el precio de cada lunes, no la variación diaria.
      </p>

      <h2>Limitación de responsabilidad</h2>
      <p>
        El titular procura que los datos se muestren tal como se publican, pero no garantiza su exactitud ni su actualización. No se responsabiliza de las decisiones tomadas ni de los perjuicios derivados de su uso.
      </p>

      <h2>Marcas y logotipos</h2>
      <p>
        Los nombres y logotipos de las marcas de gasolineras pertenecen a sus respectivos titulares y se usan únicamente para identificar cada estación. Su aparición no implica relación comercial ni respaldo alguno.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los textos, el diseño, el código y demás contenidos propios del sitio son propiedad del titular y están protegidos por la normativa de propiedad intelectual. No se permite su reproducción, distribución o transformación sin permiso expreso, salvo para uso personal y citando la fuente.
      </p>

      <h2>Mapas</h2>
      <p>
        Los mapas muestran datos de © OpenStreetMap contributors e imágenes de Esri, con sus respectivas licencias y condiciones de uso.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Este aviso se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa aplicable.
      </p>
    </LegalPage>
  );
}
