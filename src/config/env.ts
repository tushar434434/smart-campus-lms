import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
};
