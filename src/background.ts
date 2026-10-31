/**
 * Service worker: faz o fetch no endpoint público de syndication.
 * Fica aqui (e não no content script) porque o host_permissions do manifest
 * libera cdn.syndication.twimg.com para a extensão, sem esbarrar em CORS.
 * Nenhum cookie/credencial do X é usado (credentials: 'omit').
 */
import { parseSyndication, syndicationUrl, type SyndicationInfo } from './core';
import type { Req, Res } from './messages';

const cache = new Map<string, SyndicationInfo>();

async function fetchInfo(id: string): Promise<SyndicationInfo> {
  const hit = cache.get(id);
  if (hit) return hit;
  const r = await fetch(syndicationUrl(id), { credentials: 'omit' });
  if (!r.ok) throw new Error(`HTTP ${r.status} (post apagado, privado ou com restrição?)`);
  const info = parseSyndication(await r.json());
  if (!info) throw new Error('Resposta inesperada do syndication');
  cache.set(id, info);
  return info;
}

chrome.runtime.onMessage.addListener((msg: Req, _sender, send: (r: Res) => void) => {
  if (msg?.type !== 'syndication') return;
  fetchInfo(msg.id).then(
    (info) => send({ ok: true, info }),
    (e) => send({ ok: false, error: String(e?.message ?? e) }),
  );
  return true; // resposta assíncrona
});
