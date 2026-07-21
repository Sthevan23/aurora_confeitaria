import { Router } from 'express';
import type { ProductController } from '../controllers/ProductController.js';
import type { ContactController } from '../controllers/ContactController.js';
import type { BusinessController } from '../controllers/BusinessController.js';
import { validateContactBody } from '../middlewares/validateContact.js';

export function createApiRouter(deps: {
  products: ProductController;
  contacts: ContactController;
  business: BusinessController;
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aurora-api' });
  });

  router.get('/business', deps.business.info);

  router.get('/products', deps.products.list);
  router.get('/products/highlights', deps.products.highlights);
  router.get('/products/category/:category', deps.products.byCategory);
  router.get('/products/:slug', deps.products.bySlug);

  router.post('/contact', validateContactBody, deps.contacts.create);

  return router;
}
