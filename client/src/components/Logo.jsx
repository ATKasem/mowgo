// MowGo logo — custom leaf icon matching the brand
export default function Logo({ size = 'md', className = '' }) {
  const sizes = { xs: 'w-5 h-5', sm: 'w-7 h-7', md: 'w-8 h-8', lg: 'w-10 h-10', xl: 'w-12 h-12' };
  return (
    <div className={`${sizes[size]} rounded-lg bg-[#1a1a2e] flex items-center justify-center flex-shrink-0 ${className}`}>
      <img src="/mowgo-leaf.svg" alt="MowGo" className="w-3/5 h-3/5" />
    </div>
  );
}
