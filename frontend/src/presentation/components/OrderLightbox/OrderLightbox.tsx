import { useEffect, useState } from 'react';
import type { Product } from '../../../domain/entities/catalog';
import { categoryLabels } from '../../../domain/entities/catalog';
import { Button } from '../Button/Button';
import './OrderLightbox.css';

interface OrderLightboxProps {
  product: Product | null;
  whatsappUrl: string;
  onClose: () => void;
}

export function OrderLightbox({
  product,
  whatsappUrl,
  onClose,
}: OrderLightboxProps) {
  const flavors = product?.flavors ?? [];
  const hasFlavors = flavors.length > 0;

  const [flavor, setFlavor] = useState('');
  const [flavorOpen, setFlavorOpen] = useState(true);
  const [customerOpen, setCustomerOpen] = useState(true);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return;
    setFlavor(product.flavors?.[0] ?? '');
    setFlavorOpen(Boolean(product.flavors?.length));
    setCustomerOpen(true);
    setNome('');
    setSobrenome('');
    setTelefone('');
    setError('');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  function validate() {
    const n = nome.trim();
    const s = sobrenome.trim();
    const phone = telefone.replace(/\D/g, '');

    if (!n || !s) {
      setError('Preencha nome e sobrenome.');
      return null;
    }
    if (phone.length < 10) {
      setError('Informe um WhatsApp válido com DDD.');
      return null;
    }
    if (hasFlavors && !flavor) {
      setError('Escolha um sabor.');
      return null;
    }
    setError('');
    return { n, s, phone };
  }

  function finalizeOrder() {
    const data = validate();
    if (!data || !product) return;

    const size = product.size ? `\nTamanho: ${product.size}` : '';
    const flavorLine = hasFlavors ? `\nSabor: ${flavor}` : '';
    const message = encodeURIComponent(
      `Olá, Aurora! Quero fazer um pedido:\n\n` +
        `Produto: ${product.name}${size}${flavorLine}\n` +
        `Valor: ${product.priceLabel}\n\n` +
        `Cliente: ${data.n} ${data.s}\n` +
        `WhatsApp: ${data.phone}`,
    );

    window.open(`${whatsappUrl}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="order-lightbox is-open"
      role="dialog"
      aria-modal="true"
      aria-label={`Pedir ${product.name}`}
      onClick={onClose}
    >
      <button
        type="button"
        className="order-lightbox__close"
        aria-label="Fechar"
        onClick={onClose}
      >
        ×
      </button>

      <div
        className="order-lightbox__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="order-lightbox__media">
          <img src={product.imageUrl} alt={product.name} />
        </div>

        <div className="order-lightbox__info">
          <div className="order-lightbox__scroll">
            <span className="order-lightbox__category">
              {categoryLabels[product.category]}
            </span>
            <h3 className="order-lightbox__title">{product.name}</h3>
            <p className="order-lightbox__price">{product.priceLabel}</p>
            <p className="order-lightbox__desc">{product.description}</p>

            {hasFlavors && (
              <div className={`order-acc ${flavorOpen ? 'is-open' : ''} ${flavor ? 'is-done' : ''}`}>
                <button
                  type="button"
                  className="order-acc__head"
                  aria-expanded={flavorOpen}
                  onClick={() => setFlavorOpen((v) => !v)}
                >
                  <span className="order-acc__title">Sabor</span>
                  <span className="order-acc__summary">
                    {flavor || 'escolha 1'}
                  </span>
                  <span className="order-acc__chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                <div className="order-acc__body">
                  <div className="order-acc__inner">
                    <div className="flavor-options">
                      {flavors.map((option) => (
                        <label key={option} className={flavor === option ? 'is-active' : ''}>
                          <input
                            type="radio"
                            name="order-flavor"
                            value={option}
                            checked={flavor === option}
                            onChange={() => setFlavor(option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={`order-acc ${customerOpen ? 'is-open' : ''} ${nome && sobrenome && telefone ? 'is-done' : ''}`}>
              <button
                type="button"
                className="order-acc__head"
                aria-expanded={customerOpen}
                onClick={() => setCustomerOpen((v) => !v)}
              >
                <span className="order-acc__title">Seus dados</span>
                <span className="order-acc__summary">obrigatório</span>
                <span className="order-acc__chevron" aria-hidden>
                  ▾
                </span>
              </button>
              <div className="order-acc__body">
                <div className="order-acc__inner">
                  <div className="customer-fields">
                    <div className="customer-fields__row">
                      <label className="order-field">
                        Nome *
                        <input
                          type="text"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Nome"
                          autoComplete="given-name"
                        />
                      </label>
                      <label className="order-field">
                        Sobrenome *
                        <input
                          type="text"
                          value={sobrenome}
                          onChange={(e) => setSobrenome(e.target.value)}
                          placeholder="Sobrenome"
                          autoComplete="family-name"
                        />
                      </label>
                    </div>
                    <label className="order-field">
                      Telefone / WhatsApp *
                      <input
                        type="tel"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="DDD + número"
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-lightbox__actions">
            {error && (
              <p className="order-lightbox__error" role="alert">
                {error}
              </p>
            )}
            <Button type="button" variant="secondary" onClick={finalizeOrder}>
              Finalizar pedido no WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
