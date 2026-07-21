import { useState, type FormEvent } from 'react';
import { Button } from '../Button/Button';
import { useReveal } from '../../hooks/useReveal';
import { SendContactMessage } from '../../../application/use-cases/SendContactMessage';
import './Contact.css';

const sendContact = new SendContactMessage();

interface ContactProps {
  instagramUrl: string;
  instagramHandle: string;
  whatsapp: string;
  whatsappUrl: string;
}

export function Contact({
  instagramUrl,
  instagramHandle,
  whatsapp,
  whatsappUrl,
}: ContactProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const orderHref = `${whatsappUrl}?text=${encodeURIComponent(
    'Olá, Aurora! Gostaria de fazer um pedido 😊',
  )}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('loading');
    try {
      await sendContact.execute({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        phone: String(data.get('phone') ?? ''),
        message: String(data.get('message') ?? ''),
      });
      setStatus('success');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="section contact" id="contato" ref={ref}>
      <div className={`container contact__grid ${visible ? 'is-visible' : ''}`}>
        <div className="contact__copy">
          <p className="section__eyebrow reveal">Contato</p>
          <h2 className="section__title reveal reveal-delay-1">
            Vamos conversar sobre o seu pedido
          </h2>
          <p className="section__lead reveal reveal-delay-2">
            Fale pelo WhatsApp ou Instagram. Respondemos com carinho para
            combinar sabores, datas e quantidades.
          </p>
          <div className="contact__channels reveal reveal-delay-3">
            <a href={orderHref} target="_blank" rel="noreferrer">
              WhatsApp {whatsapp}
            </a>
            <a href={instagramUrl} target="_blank" rel="noreferrer">
              {instagramHandle}
            </a>
          </div>
        </div>

        <form className="contact__form reveal reveal-delay-2" onSubmit={onSubmit}>
          <label>
            Nome
            <input name="name" required minLength={2} placeholder="Seu nome" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" required placeholder="voce@email.com" />
          </label>
          <label>
            Telefone / WhatsApp
            <input name="phone" required minLength={8} placeholder="(00) 00000-0000" />
          </label>
          <label>
            Mensagem
            <textarea
              name="message"
              required
              minLength={5}
              rows={4}
              placeholder="Conte o que deseja encomendar"
            />
          </label>

          <Button type="submit" variant="primary" disabled={status === 'loading'}>
            {status === 'loading' ? 'Enviando...' : 'Enviar mensagem'}
          </Button>

          {status === 'success' && (
            <p className="contact__feedback contact__feedback--ok" role="status">
              Mensagem enviada. Em breve retornamos o contato.
            </p>
          )}
          {status === 'error' && (
            <p className="contact__feedback contact__feedback--err" role="alert">
              Não foi possível enviar agora. Tente pelo WhatsApp.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
