// Teste contra o endpoint REAL (precisa de internet). Rode com: npm run test:network
import { describe, it, expect } from 'vitest';
import { parseSyndication, syndicationUrl } from '../../src/core';

describe('endpoint real de syndication', () => {
  it('id 1696580817642729897 → expanded_url esperado', async () => {
    const r = await fetch(syndicationUrl('1696580817642729897'));
    expect(r.status).toBe(200);
    const info = parseSyndication(await r.json())!;
    expect(info.media[0]?.expandedUrl).toBe('https://x.com/saintpsblo/status/1696576087193481500/photo/1');
  });
});
