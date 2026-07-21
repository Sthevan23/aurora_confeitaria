import { apiClient } from '../../infrastructure/api/apiClient';
import type { ContactPayload } from '../../domain/entities/catalog';

export class SendContactMessage {
  execute(payload: ContactPayload) {
    return apiClient.sendContact(payload);
  }
}
