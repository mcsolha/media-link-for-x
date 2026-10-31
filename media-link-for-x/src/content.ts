/**
 * Content script do x.com / twitter.com: liga a UI (ui.ts) ao Chrome.
 * O X é uma SPA (React) com scroll virtualizado: os posts entram e saem do DOM o
 * tempo todo, então usamos MutationObserver (só nos nós ADICIONADOS) em vez de
 * rodar uma vez só.
 */
import { isRes, type Res } from './messages';
import { createUi } from './ui';

let observer: MutationObserver | null = null;

/** Contexto invalidado = extensão recarregada/atualizada; esta aba fica órfã. */
function contextAlive(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

async function ask(id: string): Promise<Res> {
  if (!contextAlive()) {
    observer?.disconnect();
    return { ok: false, error: 'Extensão atualizada: recarregue a página' };
  }
  try {
    const r: unknown = await chrome.runtime.sendMessage({ type: 'syndication', id });
    return isRes(r) ? r : { ok: false, error: 'Resposta inválida do service worker' };
  } catch (e) {
    if (!contextAlive()) observer?.disconnect();
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const ui = createUi({ doc: document, ask, writeText: (t) => navigator.clipboard.writeText(t) });

document.addEventListener('click', ui.onClick, true);
observer = new MutationObserver((records) => ui.onMutations(records, requestAnimationFrame));
observer.observe(document.body, { childList: true, subtree: true });
// Varredura inicial (posts que já estavam na tela antes do script rodar).
ui.collect(document.documentElement);
ui.flush();
