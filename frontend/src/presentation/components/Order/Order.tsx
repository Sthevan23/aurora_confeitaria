import { Button } from '../Button/Button';
import { useReveal } from '../../hooks/useReveal';
import './Order.css';

interface OrderProps {
  whatsappUrl: string;
  instagramUrl: string;
}

const steps = [
  {
    title: 'Escolha o sabor',
    text: 'Navegue pelo cardápio e escolha copos, sandubrownies, cookies ou potes.',
  },
  {
    title: 'Peça no WhatsApp',
    text: 'Envie o pedido pelo WhatsApp para alinhar sabor, quantidade e data.',
  },
  {
    title: 'Retire com carinho',
    text: 'Combinamos a retirada em Boa Esperança, MG.',
  },
];

export function Order({ whatsappUrl, instagramUrl }: OrderProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const orderHref = `${whatsappUrl}?text=${encodeURIComponent(
    'Olá, Aurora! Quero fazer uma encomenda 😊',
  )}`;

  return (
    <section className="section order" id="encomendas" ref={ref}>
      <div className={`container order__panel ${visible ? 'is-visible' : ''}`}>
        <div className="order__copy">
          <p className="section__eyebrow reveal">Encomendas</p>
          <h2 className="section__title reveal reveal-delay-1">
            Pedidos simples, atendimento próximo
          </h2>
          <p className="section__lead reveal reveal-delay-2">
            Preferimos conversar com calma para acertar cada detalhe. O canal
            principal é o WhatsApp da Aurora.
          </p>
          <div className="order__cta reveal reveal-delay-3">
            <Button href={orderHref} variant="secondary">
              Pedir no WhatsApp
            </Button>
            <Button href={instagramUrl} variant="ghost">
              Ver Instagram
            </Button>
          </div>
        </div>

        <ol className="order__steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`reveal reveal-delay-${Math.min(index + 1, 3)}`}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
