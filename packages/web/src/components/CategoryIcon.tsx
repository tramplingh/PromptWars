import type { EquipmentCategory } from '@lablink/shared';
import { Cpu, Dna, Hammer, Microscope, MonitorCog, Waves } from 'lucide-react';

const ICONS: Record<EquipmentCategory, { icon: typeof Cpu; className: string }> = {
  Electronics: { icon: Waves, className: 'bg-sky-100 text-sky-700' },
  'Embedded & IoT': { icon: Cpu, className: 'bg-emerald-100 text-emerald-700' },
  Computing: { icon: MonitorCog, className: 'bg-brand-100 text-brand-700' },
  Fabrication: { icon: Hammer, className: 'bg-orange-100 text-orange-700' },
  Biotech: { icon: Dna, className: 'bg-pink-100 text-pink-700' },
  'Imaging & Optics': { icon: Microscope, className: 'bg-violet-100 text-violet-700' },
};

export function CategoryIcon({
  category,
  size = 'md',
}: {
  category: EquipmentCategory;
  size?: 'md' | 'lg';
}) {
  const { icon: Icon, className } = ICONS[category];
  const box = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-xl';
  return (
    <span className={`grid shrink-0 place-items-center ${box} ${className}`}>
      <Icon aria-hidden="true" className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} />
    </span>
  );
}
