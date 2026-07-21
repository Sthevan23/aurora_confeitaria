import type {
  BusinessInfo,
  ContactPayload,
  Product,
} from '../../domain/entities/catalog';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API_ERROR_${response.status}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}

export const apiClient = {
  getBusinessInfo: () => request<BusinessInfo>('/api/business'),
  getProducts: () => request<Product[]>('/api/products'),
  getHighlights: () => request<Product[]>('/api/products/highlights'),
  sendContact: (payload: ContactPayload) =>
    request('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
