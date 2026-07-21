import { Button } from '../Button/Button';
import { Logo } from '../Logo/Logo';
import { useParallax } from '../../hooks/useParallax';
import './Hero.css';

interface HeroProps {
  city: string;
  state: string;
  instagramUrl: string;
  whatsappUrl: string;
}

const rotatingWords = ['doce', 'especial', 'feliz', 'doce'];

export function Hero({
  city,
  state,
  instagramUrl,
  whatsappUrl,
}: HeroProps) {
  const offset = useParallax(0.22);
  const offsetSlow = useParallax(0.1);
  const orderHref = `${whatsappUrl}?text=${encodeURIComponent(
    'Olá, Aurora! Quero fazer um pedido 😊',
  )}`;

  return (
    <section className="hero" id="topo" aria-label="Aurora Confeitaria">
      <div
        className="hero__bg-photo"
        style={{
          transform: `translate3d(0, ${offsetSlow * 0.4}px, 0) scale(1.08)`,
        }}
        aria-hidden
      />
      <div
        className="hero__bg-layer hero__bg-layer--near"
        style={{ transform: `translate3d(0, ${offset * 0.35}px, 0)` }}
        aria-hidden
      />
      <div className="hero__veil" aria-hidden />

      <div className="container hero__content">
        <Logo variant="hero" className="hero__logo" />

        <h1 className="hero__title">
          <span className="hero__title-line">Feito com amor para</span>
          <span className="hero__title-line hero__title-line--dynamic">
            deixar seu dia mais{' '}
            <span className="hero__words" aria-hidden>
              {rotatingWords.map((word, index) => (
                <span key={`${word}-${index}`}>{word}</span>
              ))}
            </span>
            <span className="sr-only">doce</span>
          </span>
        </h1>
        <p className="hero__place">
          Copos · Sandubrownies · Cookies · Potes
          <span>
            {city}, {state}
          </span>
        </p>

        <div className="hero__actions">
          <Button href="#produtos" variant="primary">
            Ver cardápio
          </Button>
          <Button href={orderHref} variant="secondary">
            Pedir no WhatsApp
          </Button>
          <Button href={instagramUrl} variant="ghost">
            Instagram
          </Button>
        </div>
      </div>
    </section>
  );
}
