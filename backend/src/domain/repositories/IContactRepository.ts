import type { ContactMessage } from '../entities/ContactMessage.js';

export interface CreateContactInput {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface IContactRepository {
  create(input: CreateContactInput): Promise<ContactMessage>;
}
