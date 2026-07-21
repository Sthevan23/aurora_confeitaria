import express from 'express';
import cors from 'cors';
import { createApiRouter } from '../../presentation/routes/apiRouter.js';
import { errorHandler } from '../../presentation/middlewares/errorHandler.js';
import type { ProductController } from '../../presentation/controllers/ProductController.js';
import type { ContactController } from '../../presentation/controllers/ContactController.js';
import type { BusinessController } from '../../presentation/controllers/BusinessController.js';

export function createHttpServer(deps: {
  products: ProductController;
  contacts: ContactController;
  business: BusinessController;
  corsOrigin: string;
}) {
  const app = express();

  app.use(
    cors({
      origin: deps.corsOrigin,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createApiRouter(deps));
  app.use(errorHandler);

  return app;
}
