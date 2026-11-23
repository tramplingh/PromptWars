import type { EquipmentCategory } from '@lablink/shared';
import { Cpu, Dna, Hammer, Microscope, MonitorCog, Waves } from 'lucide-react';

const ICONS: Record<EquipmentCategory, { icon: typeof Cpu; className: string }> = {
  Electronics: { icon: Waves, className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  'Embedded & IoT': { icon: Cpu, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  Computing: { icon: MonitorCog, className: 'bg-brand-50 text-brand-700 ring-brand-200' },
  Fabrication: { icon: Hammer, className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  Biotech: { icon: Dna, className: 'bg-pink-50 text-pink-700 ring-pink-200' },
  'Imaging & Optics': {
    icon: Microscope,
    className: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
};

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-lg', icon: 'h-5 w-5' },
  lg: { box: 'h-14 w-14 rounded-xl', icon: 'h-7 w-7' },
} as const;

export function CategoryIcon({
  category,
  size = 'md',
}: {
  category: EquipmentCategory;
  size?: keyof typeof SIZES;
}) {
  const { icon: Icon, className } = ICONS[category];
  const s = SIZES[size];
  return (
    <span className={`grid shrink-0 place-items-center ring-1 ring-inset ${s.box} ${className}`}>
      <Icon aria-hidden="true" className={s.icon} />
    </span>
  );
}
