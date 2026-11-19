import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const extensions = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type SubmissionFileMimeType = keyof typeof extensions;

export interface SubmissionFileStorage {
  save(buffer: Buffer, mimeType: SubmissionFileMimeType): Promise<string>;
  read(fileKey: string): Promise<Buffer>;
  remove(fileKey: string): Promise<void>;
}

function isValidFileKey(fileKey: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/i.test(
    fileKey,
  );
}

export class LocalSubmissionFileStorage implements SubmissionFileStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  async save(
    buffer: Buffer,
    mimeType: SubmissionFileMimeType,
  ): Promise<string> {
    const fileKey = `${randomUUID()}.${extensions[mimeType]}`;
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.resolveKey(fileKey), buffer, {
      flag: 'wx',
      mode: 0o600,
    });
    return fileKey;
  }

  async read(fileKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(fileKey));
  }

  async remove(fileKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(fileKey));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      throw error;
    }
  }

  private resolveKey(fileKey: string): string {
    if (!isValidFileKey(fileKey)) {
      throw new Error('INVALID_STORED_FILE_KEY');
    }
    return resolve(this.root, fileKey);
  }
}

export class InMemorySubmissionFileStorage implements SubmissionFileStorage {
  private readonly files = new Map<string, Buffer>();

  async save(
    buffer: Buffer,
    mimeType: SubmissionFileMimeType,
  ): Promise<string> {
    const fileKey = `${randomUUID()}.${extensions[mimeType]}`;
    this.files.set(fileKey, Buffer.from(buffer));
    return fileKey;
  }

  async read(fileKey: string): Promise<Buffer> {
    const buffer = this.files.get(fileKey);
    if (!buffer) throw new Error('FILE_NOT_FOUND');
    return Buffer.from(buffer);
  }

  async remove(fileKey: string): Promise<void> {
    this.files.delete(fileKey);
  }
}
