/**
 * Lógica do service worker, separada de chrome.* para poder ser testada.
 *
 * Proteções para não martelar o endpoint (que não é oficial):
 *  - deduplicação de requisições em voo (Map<id, Promise>);
 *  - cache LRU com limite de tamanho e TTL, inclusive para FALHAS (cache negativo);
 *  - backoff global ao receber 429 ou 5xx.
 * Mesmo assim, o content script só pede algo quando o usuário clica ou para o
 * mouse sobre uma mídia. Não há requisição em lote nem em segundo plano.
 */
import { parseSyndication, syndicationUrl } from './core';
import type { Res } from './messages';

export interface ServiceOptions {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  maxEntries?: number;
  okTtlMs?: number;
  errorTtlMs?: number;
  backoffMs?: number;
}

export function createSyndicationService(opts: ServiceOptions) {
  const now = opts.now ?? Date.now;
  const max = opts.maxEntries ?? 500;
  const okTtl = opts.okTtlMs ?? 30 * 60_000;
  const errTtl = opts.errorTtlMs ?? 10 * 60_000;
  const backoffMs = opts.backoffMs ?? 60_000;

  // Map mantém ordem de inserção → serve de LRU (reinsere no acesso).
  const cache = new Map<string, { res: Res; exp: number }>();
  const inflight = new Map<string, Promise<Res>>();
  let blockedUntil = 0;

  function put(id: string, res: Res, ttl: number) {
    cache.delete(id);
    cache.set(id, { res, exp: now() + ttl });
    while (cache.size > max) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function load(id: string): Promise<Res> {
    try {
      const r = await opts.fetch(syndicationUrl(id), { credentials: 'omit' });
      if (r.status === 429 || r.status >= 500) {
        blockedUntil = now() + backoffMs;
        return { ok: false, error: `Servidor do X indisponível (HTTP ${r.status}). Tente mais tarde.` };
      }
      if (!r.ok) {
        const res: Res = { ok: false, error: `HTTP ${r.status} (post apagado, privado ou com restrição?)` };
        put(id, res, errTtl);
        return res;
      }
      const info = parseSyndication(await r.json());
      const res: Res = info
        ? { ok: true, info }
        : { ok: false, error: 'Post indisponível (apagado ou privado?)' };
      put(id, res, info ? okTtl : errTtl);
      return res;
    } catch (e) {
      // Erro de rede: não guarda em cache (pode ser só uma queda momentânea).
      return { ok: false, error: `Falha de rede: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  function get(id: string): Promise<Res> {
    const hit = cache.get(id);
    if (hit && hit.exp > now()) {
      cache.delete(id);
      cache.set(id, hit);
      return Promise.resolve(hit.res);
    }
    if (hit) cache.delete(id);
    if (now() < blockedUntil) {
      return Promise.resolve({ ok: false, error: 'Muitas requisições; aguarde um minuto.' });
    }
    const running = inflight.get(id);
    if (running) return running;
    const p = load(id).finally(() => inflight.delete(id));
    inflight.set(id, p);
    return p;
  }

  return { get, size: () => cache.size };
}

/** Aceita só mensagens da própria extensão vindas de uma aba (content script). */
export function isTrustedSender(sender: { id?: string; tab?: unknown }, runtimeId: string): boolean {
  return sender.id === runtimeId && !!sender.tab;
}
