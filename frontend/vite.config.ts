import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.API_PROXY_TARGET || 'http://localhost:3000';
  const proxy = Object.fromEntries(
    [
      '/auth',
      '/courses',
      '/students',
      '/enrollments',
      '/assignments',
      '/submissions',
      '/quizzes',
      '/attempts',
      '/health',
    ].map((path) => [path, { target, changeOrigin: true }]),
  );

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
