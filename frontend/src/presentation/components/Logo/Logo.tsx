import './Logo.css';

interface LogoProps {
  className?: string;
  variant?: 'hero' | 'header' | 'footer';
}

export function Logo({ className = '', variant = 'header' }: LogoProps) {
  return (
    <span className={`brand-logo brand-logo--${variant} ${className}`.trim()} aria-label="Aurora Confeitaria Artesanal">
      <span className="brand-logo__name">Aurora</span>
      <span className="brand-logo__sub">Confeitaria Artesanal</span>
    </span>
  );
}
