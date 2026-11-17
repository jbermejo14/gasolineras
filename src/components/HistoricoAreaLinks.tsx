import Link from 'next/link';
import type { AreaIndexEntry, AreaKind } from '@/lib/historicoFormat';
import { getAreasByKind } from '@/lib/historico';
import { buildHistoricoPath } from '@/lib/historicoPageMeta';

interface HistoricoAreaLinksProps {
  kind: AreaKind;
  slug: string;
  name: string;
  parentSlug?: string;
}

interface HistoricoLink {
  label: string;
  href: string;
}

interface HistoricoLinkGroup {
  title: string;
  links: HistoricoLink[];
}

const HISTORICO_LINKS_SPAIN_GROUP: HistoricoLinkGroup = {
  title: 'Ámbito nacional',
  links: [{ label: 'España', href: buildHistoricoPath('espana', 'espana') }],
};

function historicoLinksOf(entries: AreaIndexEntry[]): HistoricoLink[] {
  return entries.map((entry) => ({ label: entry.name, href: buildHistoricoPath(entry.kind, entry.slug) }));
}

function historicoLinksProvinciaGroups(props: HistoricoAreaLinksProps): HistoricoLinkGroup[] {
  const community = getAreasByKind('comunidad').filter((area) => area.slug === props.parentSlug);
  return [
    { title: 'Comunidad autónoma', links: historicoLinksOf(community) },
    HISTORICO_LINKS_SPAIN_GROUP,
    { title: 'Precios de hoy', links: [{ label: `Gasolineras en ${props.name}`, href: `/provincia/${props.slug}` }] },
  ];
}

/** Grupos de enlaces relacionados según el tipo de área (contrato H6). */
function historicoLinksGroups(props: HistoricoAreaLinksProps): HistoricoLinkGroup[] {
  switch (props.kind) {
    case 'espana':
      return [
        { title: 'Por comunidad autónoma', links: historicoLinksOf(getAreasByKind('comunidad')) },
        { title: 'Por marca', links: historicoLinksOf(getAreasByKind('marca')) },
      ];
    case 'comunidad':
      return [
        {
          title: `Provincias de ${props.name}`,
          links: historicoLinksOf(getAreasByKind('provincia').filter((area) => area.parentSlug === props.slug)),
        },
        HISTORICO_LINKS_SPAIN_GROUP,
      ];
    case 'provincia':
      return historicoLinksProvinciaGroups(props);
    case 'marca':
      return [
        { title: 'Otras marcas', links: historicoLinksOf(getAreasByKind('marca').filter((area) => area.slug !== props.slug)) },
        HISTORICO_LINKS_SPAIN_GROUP,
      ];
  }
}

/** Sección H2 de enlaces internos relacionados; los grupos vacíos no se pintan. */
export function HistoricoAreaLinks(props: HistoricoAreaLinksProps) {
  const groups = historicoLinksGroups(props).filter((group) => group.links.length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Histórico de precios relacionado</h2>
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-muted)]">{group.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="min-h-10 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex items-center text-xs font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] break-words"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
