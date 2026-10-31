import { defineConfig } from 'vitest/config';
// Suíte unitária: sem rede. O teste contra o endpoint real fica em test/network.
export default defineConfig({ test: { environment: 'jsdom', include: ['test/unit/**/*.test.ts'] } });
