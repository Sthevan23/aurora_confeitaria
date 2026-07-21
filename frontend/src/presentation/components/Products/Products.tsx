import { useMemo, useState } from 'react';
import type { Product, ProductCategory } from '../../../domain/entities/catalog';
import { categoryLabels } from '../../../domain/entities/catalog';
import { ProductCard } from './ProductCard';
import { OrderLightbox } from '../OrderLightbox/OrderLightbox';
import { useReveal } from '../../hooks/useReveal';
import './Products.css';

interface ProductsProps {
  products: Product[];
  whatsappUrl: string;
}

const filters: Array<ProductCategory | 'all'> = [
  'all',
  'copos',
  'sandubrownies',
  'cookies',
  'potes',
  'bolos',
  'especiais',
];

export function Products({ products, whatsappUrl }: ProductsProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const [filter, setFilter] = useState<ProductCategory | 'all'>('all');
  const [selected, setSelected] = useState<Product | null>(null);

  const visibleProducts = useMemo(() => {
    if (filter === 'all') return products;
    return products.filter((item) => item.category === filter);
  }, [filter, products]);

  return (
    <section className="section products" id="produtos" ref={ref}>
      <div className="container">
        <div className={`products__intro ${visible ? 'is-visible' : ''}`}>
          <p className="section__eyebrow reveal">Cardápio</p>
          <h2 className="section__title reveal reveal-delay-1">
            Nossos <em>produtos</em>
          </h2>
          <p className="section__lead reveal reveal-delay-2">
            Toque em Pedir para ver a foto, escolher o sabor e finalizar no
            WhatsApp.
          </p>
        </div>

        <div className={`products__filter ${visible ? 'is-visible' : ''}`}>
          {filters.map((key) => (
            <button
              key={key}
              type="button"
              className={`filter-btn ${filter === key ? 'is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {categoryLabels[key]}
            </button>
          ))}
        </div>

        <div className={`products__grid ${visible ? 'is-visible' : ''}`}>
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOrder={setSelected}
            />
          ))}
        </div>
      </div>

      <OrderLightbox
        product={selected}
        whatsappUrl={whatsappUrl}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
