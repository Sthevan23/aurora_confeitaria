import { useEffect, useState } from 'react';
import './Header.css';

const links = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#produtos', label: 'Cardápio' },
  { href: '#galeria', label: 'Galeria' },
  { href: '#encomendas', label: 'Encomendas' },
  { href: '#contato', label: 'Contato' },
];

interface HeaderProps {
  whatsappUrl: string;
}

export function Header({ whatsappUrl }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const orderHref = `${whatsappUrl}?text=${encodeURIComponent(
    'Olá, Aurora! Quero fazer um pedido 😊',
  )}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
      <div className="container header__inner">
        <button
          className={`header__toggle ${open ? 'is-open' : ''}`}
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>

        <nav className={`header__nav ${open ? 'is-open' : ''}`} aria-label="Principal">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a
            className="header__cta"
            href={orderHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            Fazer Pedido
          </a>
        </nav>
      </div>
    </header>
  );
}
