import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),

    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    JWT_SECRET: optionalValue,
    PASSWORD_RESET_SECRET: optionalValue,
    PASSWORD_RESET_OTP_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(30)
      .default(10),
    SMTP_HOST: optionalValue,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optionalValue,
    SMTP_PASS: optionalValue,
    SMTP_FROM: optionalValue,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'test' && !env.JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be configured outside test environments',
      });
    }

    const smtpValues = [
      env.SMTP_HOST,
      env.SMTP_USER,
      env.SMTP_PASS,
      env.SMTP_FROM,
    ];
    if (smtpValues.some(Boolean) && smtpValues.some((value) => !value)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message:
          'SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM must be configured together',
      });
    }
  });

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  jwtSecret: env.JWT_SECRET,
  passwordResetSecret: env.PASSWORD_RESET_SECRET,
  passwordResetOtpTtlMinutes: env.PASSWORD_RESET_OTP_TTL_MINUTES,
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },
};
