import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .trim()
      .url()
      .refine((value) => {
        try {
          return ['postgres:', 'postgresql:'].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, 'DATABASE_URL must be a PostgreSQL connection URL'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().trim().min(1).default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    JWT_SECRET: optionalValue,
    CORS_ORIGIN: optionalValue,
    PASSWORD_RESET_SECRET: optionalValue,
    STUDENT_ENROLLMENT_PREFIX: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,10}$/)
      .default('SC'),
    SUBMISSION_UPLOAD_DIR: z
      .string()
      .trim()
      .min(1)
      .default('var/private-uploads'),
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
  databaseUrl: env.DATABASE_URL,
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  nodeEnv: env.NODE_ENV,
  jwtSecret: env.JWT_SECRET,
  corsOrigin: env.CORS_ORIGIN,
  passwordResetSecret: env.PASSWORD_RESET_SECRET,
  studentEnrollmentPrefix: env.STUDENT_ENROLLMENT_PREFIX,
  submissionUploadDirectory: env.SUBMISSION_UPLOAD_DIR,
  passwordResetOtpTtlMinutes: env.PASSWORD_RESET_OTP_TTL_MINUTES,
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },
};
