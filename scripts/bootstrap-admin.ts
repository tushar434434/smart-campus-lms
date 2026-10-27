import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { StringDecoder } from 'node:string_decoder';
import { PrismaBootstrapAdminRepository } from '../src/modules/admin/bootstrap-admin.prisma.repository.js';
import { createBootstrapAdminService } from '../src/modules/admin/bootstrap-admin.service.js';

async function readHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Run this command in an interactive PowerShell terminal');
  }
  process.stdout.write('Current account password (input hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let password = '';
    const decoder = new StringDecoder('utf8');
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003') {
          cleanup();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          reject(new Error('Bootstrap cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (character === '\b' || character === '\u007f') {
          password = Array.from(password).slice(0, -1).join('');
        } else {
          password += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!databaseUrl) throw new Error('DATABASE_URL must be configured');
  if (!email) throw new Error('ADMIN_BOOTSTRAP_EMAIL must be configured');
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== 'true') {
    throw new Error(
      'Set ADMIN_BOOTSTRAP_ENABLED=true in this terminal to authorize the one-time setup',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await createBootstrapAdminService(
      new PrismaBootstrapAdminRepository(prisma),
    ).provision({
      enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === 'true',
      configuredEmail: email,
      email,
      currentPassword: await readHiddenPassword(),
    });
    console.log(`Administrator access enabled for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Administrator bootstrap failed',
  );
  process.exitCode = 1;
});
