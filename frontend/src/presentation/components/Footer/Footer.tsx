import { Logo } from '../Logo/Logo';
import './Footer.css';

interface FooterProps {
  brandName: string;
  city: string;
  state: string;
  instagramUrl: string;
  instagramHandle: string;
  whatsappUrl: string;
}

export function Footer({
  brandName,
  city,
  state,
  instagramUrl,
  instagramHandle,
  whatsappUrl,
}: FooterProps) {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo variant="footer" />
          <p>
            {city}, {state}
          </p>
        </div>

        <div className="footer__meta">
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">
            {instagramHandle}
          </a>
          <p>
            © {new Date().getFullYear()} {brandName}
          </p>
        </div>
      </div>
    </footer>
  );
}
