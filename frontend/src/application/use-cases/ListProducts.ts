import { apiClient } from '../../infrastructure/api/apiClient';
import type { Product } from '../../domain/entities/catalog';

const fallbackProducts: Product[] = [
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
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
    createdAt: '',
  },
];

export class ListProducts {
  async execute(): Promise<Product[]> {
    try {
      return await apiClient.getProducts();
    } catch {
      return fallbackProducts;
    }
  }
}
