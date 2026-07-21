import 'dotenv/config';
import { InMemoryProductRepository } from './infrastructure/persistence/InMemoryProductRepository.js';
import { FileContactRepository } from './infrastructure/persistence/FileContactRepository.js';
import { StaticBusinessRepository } from './infrastructure/persistence/StaticBusinessRepository.js';
import { ListProductsUseCase } from './application/use-cases/ListProductsUseCase.js';
import { ListProductsByCategoryUseCase } from './application/use-cases/ListProductsByCategoryUseCase.js';
import { GetProductBySlugUseCase } from './application/use-cases/GetProductBySlugUseCase.js';
import { ListHighlightProductsUseCase } from './application/use-cases/ListHighlightProductsUseCase.js';
import { CreateContactMessageUseCase } from './application/use-cases/CreateContactMessageUseCase.js';
import { GetBusinessInfoUseCase } from './application/use-cases/GetBusinessInfoUseCase.js';
import { ProductController } from './presentation/controllers/ProductController.js';
import { ContactController } from './presentation/controllers/ContactController.js';
import { BusinessController } from './presentation/controllers/BusinessController.js';
import { createHttpServer } from './infrastructure/http/createHttpServer.js';

const port = Number(process.env.PORT ?? 3333);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const productRepository = new InMemoryProductRepository();
const contactRepository = new FileContactRepository();
const businessRepository = new StaticBusinessRepository();

const productController = new ProductController(
  new ListProductsUseCase(productRepository),
  new ListProductsByCategoryUseCase(productRepository),
  new GetProductBySlugUseCase(productRepository),
  new ListHighlightProductsUseCase(productRepository),
);

const contactController = new ContactController(
  new CreateContactMessageUseCase(contactRepository),
);

const businessController = new BusinessController(
  new GetBusinessInfoUseCase(businessRepository),
);

const app = createHttpServer({
  products: productController,
  contacts: contactController,
  business: businessController,
  corsOrigin,
});

app.listen(port, () => {
  console.log(`[aurora-api] listening on http://localhost:${port}`);
  console.log(`[aurora-api] CORS origin: ${corsOrigin}`);
});
