import { useEffect, useState } from 'react';
import { Header } from '../components/Header/Header';
import { Hero } from '../components/Hero/Hero';
import { About } from '../components/About/About';
import { Products } from '../components/Products/Products';
import { Gallery } from '../components/Gallery/Gallery';
import { Order } from '../components/Order/Order';
import { Contact } from '../components/Contact/Contact';
import { Footer } from '../components/Footer/Footer';
import { WhatsAppFloat } from '../components/WhatsAppFloat/WhatsAppFloat';
import { GetBusinessInfo } from '../../application/use-cases/GetBusinessInfo';
import { ListProducts } from '../../application/use-cases/ListProducts';
import type { BusinessInfo, Product } from '../../domain/entities/catalog';
import { MarqueeBanner } from '../components/MarqueeBanner/MarqueeBanner';
import { Logo } from '../components/Logo/Logo';
import './HomePage.css';

const getBusinessInfo = new GetBusinessInfo();
const listProducts = new ListProducts();

export function HomePage() {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;

    Promise.all([getBusinessInfo.execute(), listProducts.execute()]).then(
      ([info, catalog]) => {
        if (!active) return;
        setBusiness(info);
        setProducts(catalog);
      },
    );

    return () => {
      active = false;
    };
  }, []);

  if (!business) {
    return (
      <div className="home-loading" role="status">
        <Logo variant="header" />
        <p>Carregando Aurora...</p>
      </div>
    );
  }

  return (
    <>
      <Header whatsappUrl={business.whatsappUrl} />
      <main>
        <Hero
          city={business.city}
          state={business.state}
          instagramUrl={business.instagramUrl}
          whatsappUrl={business.whatsappUrl}
        />
        <MarqueeBanner />
        <About />
        <Products products={products} whatsappUrl={business.whatsappUrl} />
        <Gallery
          products={products}
          instagramHandle={business.instagramHandle}
        />
        <Order
          whatsappUrl={business.whatsappUrl}
          instagramUrl={business.instagramUrl}
        />
        <Contact
          instagramUrl={business.instagramUrl}
          instagramHandle={business.instagramHandle}
          whatsapp={business.whatsapp}
          whatsappUrl={business.whatsappUrl}
        />
      </main>
      <Footer
        brandName={business.brandName}
        city={business.city}
        state={business.state}
        instagramUrl={business.instagramUrl}
        instagramHandle={business.instagramHandle}
        whatsappUrl={business.whatsappUrl}
      />
      <WhatsAppFloat whatsappUrl={business.whatsappUrl} />
    </>
  );
}
