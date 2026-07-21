import './WhatsAppFloat.css';

interface WhatsAppFloatProps {
  whatsappUrl: string;
}

export function WhatsAppFloat({ whatsappUrl }: WhatsAppFloatProps) {
  const href = `${whatsappUrl}?text=${encodeURIComponent(
    'Olá, Aurora! Gostaria de fazer um pedido 😊',
  )}`;

  return (
    <a
      className="whatsapp-float"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
    >
      <span className="whatsapp-float__pulse" aria-hidden />
      <span className="whatsapp-float__pulse whatsapp-float__pulse--delay" aria-hidden />
      <span className="whatsapp-float__icon" aria-hidden>
        <svg viewBox="0 0 32 32">
          <path
            fill="currentColor"
            d="M16.1 3C9.4 3 4 8.3 4 14.9c0 2.1.6 4.1 1.6 5.9L4 29l8.4-1.6c1.7.9 3.6 1.4 5.6 1.4 6.7 0 12.1-5.3 12.1-11.9S22.8 3 16.1 3zm0 21.7c-1.7 0-3.4-.5-4.9-1.3l-.4-.2-5 1 1-4.8-.2-.4c-1-1.6-1.5-3.4-1.5-5.2 0-5.5 4.6-10 10.2-10s10.2 4.5 10.2 10-4.5 10.9-10.2 10.9zm5.6-7.5c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.5 1.8.8 2.5.8 3.4.7.5-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4 0-.2-.2-.3-.5-.4z"
          />
        </svg>
      </span>
      <span className="whatsapp-float__tip">
        Pedir no WhatsApp
        <span className="whatsapp-float__tip-arrow" aria-hidden />
      </span>
    </a>
  );
}
