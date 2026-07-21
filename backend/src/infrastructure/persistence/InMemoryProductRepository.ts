import type { Product, ProductCategory } from '../../domain/entities/Product.js';
import type { IProductRepository } from '../../domain/repositories/IProductRepository.js';

const seedProducts: Product[] = [
  {
    id: '0',
    name: 'Copo da Felicidade',
    slug: 'copo-da-felicidade',
    description:
      'Copo 300ml com camadas generosas — escolha o sabor e peça pelo WhatsApp.',
    category: 'copos',
    highlight: true,
    imageUrl: '/products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg',
    priceLabel: 'R$ 29',
    size: '300ml',
    flavors: [
      'Ninho com Nutella',
      'Ninho com Morangos',
      'Ferrero',
      'Kinder',
      'Brigadeiro com Morangos',
      'Brigadeiro com Ninho e Nutella',
      'Maracujá com Brigadeiro',
    ],
    createdAt: '2026-01-09T10:00:00.000Z',
  },
  {
    id: '1',
    name: 'Copo Brownie Clássico',
    slug: 'copo-brownie-classico',
    description:
      'Camadas de brownie, creme de chocolate e creme baunilha no potinho — o clássico da casa.',
    category: 'copos',
    highlight: true,
    imageUrl: '/products/06b9382c-b7eb-422d-bd3a-e7b46b44a936.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: '2',
    name: 'Cookies Artesanais',
    slug: 'cookies-artesanais',
    description:
      'Cookies grossos no estilo americano: chocolate clássico e red velvet com recheio cremoso.',
    category: 'cookies',
    highlight: true,
    imageUrl: '/products/0ff19f98-37de-4629-9520-af19c38f27cc.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-11T10:00:00.000Z',
  },
  {
    id: '3',
    name: 'Sandubrownie Kinder',
    slug: 'sandubrownie-kinder',
    description:
      'Sanduíche de brownie com creme branco e recheio Kinder — embalagem feita com amor.',
    category: 'sandubrownies',
    highlight: true,
    imageUrl: '/products/27cca0b6-2fd5-4d60-8c72-92a1e8097364.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-12T10:00:00.000Z',
  },
  {
    id: '4',
    name: 'Cookie Recheado de Chocolate',
    slug: 'cookie-recheado-chocolate',
    description:
      'Cookie artesanal aberto na hora, com recheio de chocolate derretido e textura crocante.',
    category: 'cookies',
    highlight: true,
    imageUrl: '/products/4ba1b56d-f4ea-4b7d-9c2d-2f8fbeab8bb1.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-13T10:00:00.000Z',
  },
  {
    id: '5',
    name: 'Sandubrownie de Morango',
    slug: 'sandubrownie-morango',
    description:
      'Duas camadas de brownie com creme, ganache e morangos frescos — generoso e irresistível.',
    category: 'sandubrownies',
    highlight: true,
    imageUrl: '/products/4c3b51e1-88fc-473a-a06d-e3f13e31c525.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-14T10:00:00.000Z',
  },
  {
    id: '6',
    name: 'Brownie no Pote com Morango',
    slug: 'brownie-pote-morango',
    description:
      'Base de brownie, creme suave e calda de morango fresco na marmitinha.',
    category: 'potes',
    highlight: false,
    imageUrl: '/products/679de717-08f0-4c2d-a601-7bb8bae07bc4.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: '7',
    name: 'Copo Morango, Creme e Chocolate',
    slug: 'copo-morango-creme-chocolate',
    description:
      'Camadas de morango, creme amanteigado e ganache de chocolate no potinho transparente.',
    category: 'copos',
    highlight: true,
    imageUrl: '/products/6aceecd0-e407-4478-b511-f03af2e22e65.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-16T10:00:00.000Z',
  },
  {
    id: '8',
    name: 'Pizza Brownie',
    slug: 'pizza-brownie',
    description:
      'Brownie em formato pizza com cremes, frutas e chocolates — perfeita para compartilhar.',
    category: 'especiais',
    highlight: true,
    imageUrl: '/products/719409ec-6dcb-45c2-ad21-adc69e920407.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-17T10:00:00.000Z',
  },
  {
    id: '9',
    name: 'Bolo de Cenoura com Chocolate',
    slug: 'bolo-cenoura-chocolate',
    description:
      'Bolo de cenoura fofinho com cobertura de ganache e raspas de chocolate.',
    category: 'bolos',
    highlight: false,
    imageUrl: '/products/8af04d42-db5d-4575-9ee0-ca4d24a9fd99.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-18T10:00:00.000Z',
  },
  {
    id: '10',
    name: 'Copo Brownie com Morango',
    slug: 'copo-brownie-morango',
    description:
      'Brownie, creme e morangos frescos em camadas — leve e cheio de sabor.',
    category: 'copos',
    highlight: false,
    imageUrl: '/products/930630ff-b25d-4a6d-8843-2ef0589851c0.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-19T10:00:00.000Z',
  },
  {
    id: '11',
    name: 'Copo Brownie Gourmet',
    slug: 'copo-brownie-gourmet',
    description:
      'Copo premium com creme de chocolate, pedaços de brownie e amendoim crocante.',
    category: 'copos',
    highlight: true,
    imageUrl: '/products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-20T10:00:00.000Z',
  },
  {
    id: '12',
    name: 'Pote de Creme Artesanal',
    slug: 'pote-creme-artesanal',
    description:
      'Marmitinha com creme pipado em rosetas — ideal para presentear ou saborear no dia a dia.',
    category: 'potes',
    highlight: false,
    imageUrl: '/products/b05c8675-2972-47d2-a49d-d2ed4dc93fc6.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-21T10:00:00.000Z',
  },
  {
    id: '13',
    name: 'Trio de Potinhos',
    slug: 'trio-potinhos',
    description:
      'Seleção de três sabores em potinhos — chocolate, morango e cremes artesanais.',
    category: 'potes',
    highlight: true,
    imageUrl: '/products/b9fe2ede-b11b-41e1-b819-d29dec7f18f1.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-22T10:00:00.000Z',
  },
  {
    id: '14',
    name: 'Kit 3 Potinhos',
    slug: 'kit-3-potinhos',
    description:
      'Seleção de três potinhos artesanais com cremes, chocolate e morango — prontos para presentear.',
    category: 'potes',
    highlight: true,
    imageUrl: '/products/7288ea2a-8bcc-424b-a2d9-e13d9b0d2cc7.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-23T10:00:00.000Z',
  },
  {
    id: '15',
    name: 'Salgadinho Gourmet',
    slug: 'salgadinho-gourmet',
    description:
      'Massa crocante recheada com creme e carne desfiada — opção salgada da Aurora.',
    category: 'especiais',
    highlight: false,
    imageUrl: '/products/dcf6f873-6760-4663-a0e4-b5ffb87e0898.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-24T10:00:00.000Z',
  },
  {
    id: '16',
    name: 'Cookie Recheado Nutella',
    slug: 'cookie-recheado-nutella',
    description:
      'Cookie grosso com recheio generoso de creme de avelã — puro conforto em cada mordida.',
    category: 'cookies',
    highlight: true,
    imageUrl: '/products/6da1f221-d309-46a6-86c6-c55512a40766.jpg',
    priceLabel: 'R$ 18',
    createdAt: '2026-01-25T10:00:00.000Z',
  },
  {
    id: '17',
    name: 'Bolo no Pote Morango',
    slug: 'bolo-no-pote-morango',
    description:
      'Camadas de bolo, creme, chocolate e morango fresco — finalizado com morango inteiro.',
    category: 'potes',
    highlight: true,
    imageUrl: '/products/ebaf8618-a5e9-4874-9cfd-9d085da4a193.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-26T10:00:00.000Z',
  },
  {
    id: '18',
    name: 'Marmitinha Ninho e Chocolate',
    slug: 'marmitinha-ninho-chocolate',
    description:
      'Marmitinha com creme de ninho, faixa de chocolate e morangos frescos — generosa e irresistível.',
    category: 'potes',
    highlight: true,
    imageUrl: '/products/ccae5bfe-0976-4cbb-9484-05c3e75b9695.jpg',
    priceLabel: 'Consultar',
    createdAt: '2026-01-27T10:00:00.000Z',
  },
];

export class InMemoryProductRepository implements IProductRepository {
  constructor(private readonly items: Product[] = seedProducts) {}

  async findAll(): Promise<Product[]> {
    return [...this.items];
  }

  async findByCategory(category: ProductCategory): Promise<Product[]> {
    return this.items.filter((item) => item.category === category);
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return this.items.find((item) => item.slug === slug) ?? null;
  }

  async findHighlights(): Promise<Product[]> {
    return this.items.filter((item) => item.highlight);
  }
}
