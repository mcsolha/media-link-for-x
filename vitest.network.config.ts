import { defineConfig } from 'vitest/config';
// `npm run test:network`: precisa de internet e de o post de exemplo continuar no ar.
export default defineConfig({
  test: { environment: 'node', include: ['test/network/**/*.test.ts'], testTimeout: 20000 },
});
