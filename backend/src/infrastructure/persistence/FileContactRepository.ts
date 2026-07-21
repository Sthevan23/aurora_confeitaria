import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';
import type { ContactMessage } from '../../domain/entities/ContactMessage.js';
import type {
  CreateContactInput,
  IContactRepository,
} from '../../domain/repositories/IContactRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../../data');
const contactsFile = path.join(dataDir, 'contacts.jsonl');

export class FileContactRepository implements IContactRepository {
  async create(input: CreateContactInput): Promise<ContactMessage> {
    const message: ContactMessage = {
      id: uuid(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    await mkdir(dataDir, { recursive: true });
    await appendFile(contactsFile, `${JSON.stringify(message)}\n`, 'utf8');

    return message;
  }
}
