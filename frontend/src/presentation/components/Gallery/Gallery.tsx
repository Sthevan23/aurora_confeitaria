import type { Product } from '../../../domain/entities/catalog';
import { useReveal } from '../../hooks/useReveal';
import './Gallery.css';

interface GalleryProps {
  products: Product[];
  instagramHandle: string;
}

export function Gallery({ products, instagramHandle }: GalleryProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const images = products.slice(0, 8);

  return (
    <section className="section gallery" id="galeria" ref={ref}>
      <div className="container">
        <div className={`gallery__intro ${visible ? 'is-visible' : ''}`}>
          <p className="section__eyebrow reveal">Inspiração</p>
          <h2 className="section__title reveal reveal-delay-1">
            Nossa <em>galeria</em>
          </h2>
          <p className="section__lead reveal reveal-delay-2">
            #useaurora por aí — criações feitas com amor.
          </p>
        </div>

        <div className="gallery__grid">
          {images.map((product, index) => (
            <figure
              key={product.id}
              className="gallery__item"
              data-delay={index % 2 === 1 ? true : undefined}
            >
              <img src={product.imageUrl} alt={product.name} loading="lazy" />
              <figcaption>
                <span>{product.name}</span>
                <small>{instagramHandle}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
