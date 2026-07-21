import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  href?: string;
}

export function Button({
  variant = 'primary',
  children,
  href,
  className = '',
  ...props
}: ButtonProps) {
  const classes = `btn btn--${variant} ${className}`.trim();

  if (href) {
    return (
      <a className={classes} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type={props.type ?? 'button'} {...props}>
      {children}
    </button>
  );
}
