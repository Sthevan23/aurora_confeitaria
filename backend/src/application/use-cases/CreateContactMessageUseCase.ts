import type { ContactMessage } from '../../domain/entities/ContactMessage.js';
import type {
  CreateContactInput,
  IContactRepository,
} from '../../domain/repositories/IContactRepository.js';

export class CreateContactMessageUseCase {
  constructor(private readonly contacts: IContactRepository) {}

  execute(input: CreateContactInput): Promise<ContactMessage> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    const message = input.message.trim();

    if (!name || !email || !phone || !message) {
      throw new Error('INVALID_CONTACT_PAYLOAD');
    }

    return this.contacts.create({ name, email, phone, message });
  }
}
