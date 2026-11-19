import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const extensions = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
} as const;

export type CourseMaterialMimeType = keyof typeof extensions;
export const MAX_COURSE_MATERIAL_SIZE = 10 * 1024 * 1024;

export interface CourseMaterialFileStorage {
  save(buffer: Buffer, mimeType: CourseMaterialMimeType): Promise<string>;
  read(fileKey: string): Promise<Buffer>;
  remove(fileKey: string): Promise<void>;
}

export function validateCourseMaterialFile(
  buffer: Buffer,
  mimeType: string,
): CourseMaterialMimeType {
  if (buffer.byteLength === 0) {
    throw new Error('MATERIAL_FILE_EMPTY');
  }
  if (buffer.byteLength > MAX_COURSE_MATERIAL_SIZE) {
    throw new Error('MATERIAL_FILE_TOO_LARGE');
  }
  if (!Object.hasOwn(extensions, mimeType)) {
    throw new Error('MATERIAL_FILE_TYPE_NOT_ALLOWED');
  }
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => buffer[index] === byte);
  const valid =
    (mimeType === 'application/pdf' &&
      buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mimeType === 'image/jpeg' && startsWith(0xff, 0xd8, 0xff)) ||
    (mimeType === 'image/png' && startsWith(0x89, 0x50, 0x4e, 0x47)) ||
    (mimeType === 'image/webp' &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP') ||
    (mimeType.startsWith('application/vnd.openxmlformats-officedocument.') &&
      startsWith(0x50, 0x4b, 0x03, 0x04)) ||
    ((mimeType === 'application/msword' ||
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.ms-excel') &&
      startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) ||
    (mimeType === 'text/plain' && !buffer.includes(0));
  if (!valid) throw new Error('MATERIAL_FILE_CONTENT_MISMATCH');
  return mimeType as CourseMaterialMimeType;
}

function safeKey(fileKey: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp|docx|pptx|xlsx|doc|ppt|xls|txt)$/i.test(
    fileKey,
  );
}

export class LocalCourseMaterialFileStorage implements CourseMaterialFileStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  async save(
    buffer: Buffer,
    mimeType: CourseMaterialMimeType,
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
    try {
      return await readFile(this.resolveKey(fileKey));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new Error('FILE_NOT_FOUND');
      }
      throw error;
    }
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
    if (!safeKey(fileKey)) throw new Error('INVALID_STORED_FILE_KEY');
    return resolve(this.root, fileKey);
  }
}

export class InMemoryCourseMaterialFileStorage implements CourseMaterialFileStorage {
  private readonly files = new Map<string, Buffer>();

  async save(
    buffer: Buffer,
    mimeType: CourseMaterialMimeType,
  ): Promise<string> {
    const fileKey = `${randomUUID()}.${extensions[mimeType]}`;
    this.files.set(fileKey, Buffer.from(buffer));
    return fileKey;
  }

  async read(fileKey: string): Promise<Buffer> {
    const file = this.files.get(fileKey);
    if (!file) throw new Error('FILE_NOT_FOUND');
    return Buffer.from(file);
  }

  async remove(fileKey: string): Promise<void> {
    this.files.delete(fileKey);
  }
}
