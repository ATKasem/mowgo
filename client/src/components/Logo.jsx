// MowGo logo — unified across web, Android, iOS
// 'icon' = leaf icon only (for app headers, tabs)
// 'full'  = leaf + MowGo + "Lawn Care Scheduling" (for hero, footer)
// 'text'  = leaf + MowGo text only

const sizes = {
  'icon-xs': 'w-5 h-5',
  'icon-sm': 'w-7 h-7',
  'icon-md': 'w-8 h-8',
  'icon-lg': 'w-10 h-10',
  'full-sm': 'w-32 h-32',
  'full-md': 'w-40 h-40',
  'full-lg': 'w-48 h-48',
};

export default function Logo({ type = 'icon', size, className = '' }) {
  if (type === 'full') {
    const dim = size === 'lg' ? '48' : size === 'sm' ? '32' : '40';
    return (
      <img src="/mowgo-logo-full.svg" alt="MowGo — Lawn Care Scheduling"
        className={`${sizes[`full-${size || 'md'}`]} object-contain ${className}`} />
    );
  }

  // icon only
  const iconSize = size || 'md';
  return (
    <div className={`${sizes[`icon-${iconSize}`]} rounded-lg bg-[#1a1a2e] flex items-center justify-center flex-shrink-0 ${className}`}>
      <img src="/mowgo-leaf.svg" alt="MowGo" className={`${iconSize === 'xs' ? 'w-3/5' : iconSize === 'sm' ? 'w-[65%]' : 'w-[70%]'} h-auto`} />
    </div>
  );
}
