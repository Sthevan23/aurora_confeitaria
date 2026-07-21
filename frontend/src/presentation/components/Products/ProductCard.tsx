import type { Product } from '../../../domain/entities/catalog';
import { categoryLabels } from '../../../domain/entities/catalog';
import { Button } from '../Button/Button';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onOrder: (product: Product) => void;
}

export function ProductCard({ product, onOrder }: ProductCardProps) {
  const hasFlavors = Boolean(product.flavors?.length);

  return (
    <article className="product-card">
      <button
        type="button"
        className="product-card__img"
        onClick={() => onOrder(product)}
        aria-label={`Ver e pedir ${product.name}`}
      >
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
        {product.highlight && (
          <span className="product-card__badge">Destaque</span>
        )}
        {product.size && (
          <span className="product-card__size">{product.size}</span>
        )}
      </button>

      <div className="product-card__body">
        <span className="product-card__category">
          {categoryLabels[product.category]}
        </span>
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>

        {hasFlavors && (
          <p className="product-card__flavor-hint">
            {product.flavors!.length} sabores disponíveis — toque em Pedir para
            montar
          </p>
        )}

        <div className="product-card__footer">
          <span className="product-card__price">{product.priceLabel}</span>
          <Button
            className="btn--sm"
            type="button"
            variant="secondary"
            onClick={() => onOrder(product)}
          >
            Pedir
          </Button>
        </div>
      </div>
    </article>
  );
}
