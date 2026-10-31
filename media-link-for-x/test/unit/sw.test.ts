import { describe, it, expect, vi } from 'vitest';
import { createSyndicationService, isTrustedSender } from '../../src/sw';
import { isReq, isRes } from '../../src/messages';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(responder: (url: string, init: RequestInit) => Promise<Response>, extra = {}) {
  let t = 0;
  const fetch = vi.fn((url: string, init: RequestInit) => responder(url, init));
  const svc = createSyndicationService({ fetch, now: () => t, ...extra });
  return { svc, fetch, advance: (ms: number) => (t += ms) };
}

describe('validação de mensagens', () => {
  it('isTrustedSender exige id da extensão e aba', () => {
    expect(isTrustedSender({ id: 'me', tab: {} }, 'me')).toBe(true);
    expect(isTrustedSender({ id: 'other', tab: {} }, 'me')).toBe(false);
    expect(isTrustedSender({ id: 'me' }, 'me')).toBe(false);
  });
  it('isReq rejeita id não numérico e tipo errado', () => {
    expect(isReq({ type: 'syndication', id: '123' })).toBe(true);
    expect(isReq({ type: 'syndication', id: '1&x=2' })).toBe(false);
    expect(isReq({ type: 'mp4', id: '1' })).toBe(false);
    expect(isReq(null)).toBe(false);
  });
  it('isRes', () => {
    expect(isRes({ ok: true, info: { id: '1', media: [] } })).toBe(true);
    expect(isRes({ ok: false, error: 'x' })).toBe(true);
    expect(isRes({ ok: true })).toBe(false);
    expect(isRes(undefined)).toBe(false);
  });
});

describe('serviço de syndication', () => {
  it('deduplica requisições concorrentes e usa cache', async () => {
    const { svc, fetch } = setup(() => Promise.resolve(json({ id_str: '1', mediaDetails: [] })));
    const [a, b] = await Promise.all([svc.get('1'), svc.get('1')]);
    expect(a).toEqual(b);
    await svc.get('1');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]).toEqual({ credentials: 'omit' });
  });
  it('cache negativo para 404 e para {} (post apagado), com TTL', async () => {
    const { svc, fetch, advance } = setup(() => Promise.resolve(json({}, 404)), { errorTtlMs: 1000 });
    expect((await svc.get('2')).ok).toBe(false);
    await svc.get('2');
    expect(fetch).toHaveBeenCalledTimes(1);
    advance(1001);
    await svc.get('2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('backoff global em 429', async () => {
    const { svc, fetch, advance } = setup(() => Promise.resolve(json({}, 429)), { backoffMs: 5000 });
    await svc.get('3');
    const r = await svc.get('4');
    expect(r.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    advance(5001);
    await svc.get('4');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('erro de rede não entra no cache', async () => {
    const { svc, fetch } = setup(() => Promise.reject(new Error('offline')));
    expect(await svc.get('5')).toEqual({ ok: false, error: 'Falha de rede: offline' });
    await svc.get('5');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('LRU respeita o limite', async () => {
    const { svc } = setup(() => Promise.resolve(json({ id_str: '9' })), { maxEntries: 2 });
    await svc.get('1');
    await svc.get('2');
    await svc.get('3');
    expect(svc.size()).toBe(2);
  });
});
