/**
 * Service worker: faz o fetch no endpoint público de syndication.
 * Fica aqui (e não no content script) porque o host_permissions do manifest
 * libera cdn.syndication.twimg.com para a extensão, sem esbarrar em CORS.
 * Nenhum cookie/credencial do X é usado (credentials: 'omit').
 */
import { isReq, type Res } from './messages';
import { createSyndicationService, isTrustedSender } from './sw';

const service = createSyndicationService({ fetch: (u, i) => fetch(u, i) });

chrome.runtime.onMessage.addListener((msg: unknown, sender, send: (r: Res) => void) => {
  if (!isTrustedSender(sender, chrome.runtime.id) || !isReq(msg)) return false;
  void service.get(msg.id).then(send);
  return true; // resposta assíncrona
});
