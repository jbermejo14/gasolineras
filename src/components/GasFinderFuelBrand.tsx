import Image from 'next/image';
import { FuelType, FUEL_LABELS } from '@/lib/miteco';
import { BRAND_CONFIG } from '@/lib/brands';
import { assetPath } from '@/lib/site';

const FUEL_OPTIONS: FuelType[] = ['gasolina95', 'diesel', 'gasolina98', 'dieselPremium', 'glp', 'gnc'];

const ACTIVE = 'bg-[var(--on-accent-bg)] text-[var(--on-accent-text)]';
const INACTIVE =
  'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--orange-border)]';
// Una sola línea desplazable en móvil; en pantallas anchas se reparte en varias.
const ROW = 'flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-visible';

interface GasFinderFuelBrandProps {
  fuel: FuelType;
  brand: string;
  onFuelChange: (fuel: FuelType) => void;
  onBrandChange: (brand: string) => void;
}

export function GasFinderFuelBrand({ fuel, brand, onFuelChange, onBrandChange }: GasFinderFuelBrandProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
      <span className="text-xs uppercase tracking-wider font-extrabold text-[var(--text-muted)] block mb-3">
        1. Selecciona tipo de carburante
      </span>
      <div className={ROW}>
        {FUEL_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => onFuelChange(f)}
            className={`shrink-0 whitespace-nowrap min-h-10 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              fuel === f ? `${ACTIVE} shadow-md shadow-[var(--orange-glow)]` : INACTIVE
            }`}
          >
            {FUEL_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-dim)] block mb-2">
          Marcas destacadas:
        </span>
        <div className={ROW}>
          <button
            onClick={() => onBrandChange('')}
            className={`shrink-0 whitespace-nowrap min-h-10 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              brand === '' ? ACTIVE : INACTIVE
            }`}
          >
            Todas
          </button>
          {Object.entries(BRAND_CONFIG).map(([key, item]) => (
            <button
              key={key}
              onClick={() => onBrandChange(brand === key ? '' : key)}
              className={`shrink-0 whitespace-nowrap min-h-10 inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                brand === key
                  ? ACTIVE
                  : 'bg-white border border-[var(--border-color)] text-neutral-900 hover:border-[var(--orange-border)]'
              }`}
            >
              <Image src={assetPath(item.logo)} alt={item.name} width={36} height={18} className="h-4 w-auto object-contain" />
              <span className="text-[11px] font-bold">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
