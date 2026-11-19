import { AppError } from '../../errors/app-error.js';
import type { SubmissionFileMimeType } from './submission-file-storage.js';

export const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;

const allowedFileTypes: readonly SubmissionFileMimeType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export function validateSubmissionFile(
  buffer: Buffer,
  mimeType: string,
): SubmissionFileMimeType {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SUBMISSION_FILE_SIZE) {
    throw new AppError(
      'Submission files must be between 1 byte and 10 MiB',
      buffer.byteLength > MAX_SUBMISSION_FILE_SIZE ? 413 : 400,
      'INVALID_FILE_SIZE',
    );
  }
  if (!allowedFileTypes.includes(mimeType as SubmissionFileMimeType)) {
    throw new AppError(
      'Only PDF, JPEG, PNG, and WebP files are allowed',
      400,
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  const validSignature =
    (mimeType === 'application/pdf' &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-') ||
    (mimeType === 'image/jpeg' &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (mimeType === 'image/png' &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (mimeType === 'image/webp' &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP');
  if (!validSignature) {
    throw new AppError(
      'The uploaded file content does not match its file type',
      400,
      'INVALID_FILE_CONTENT',
    );
  }

  return mimeType as SubmissionFileMimeType;
}
