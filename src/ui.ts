/**
 * Interface injetada no x.com: botão "🔗 Link" no hover das mídias e toast.
 * Recebe as dependências (ask, clipboard, relógio) por parâmetro para poder ser
 * testada no jsdom sem chrome.*.
 *
 * Regra de privacidade/carga: NENHUMA requisição acontece só por rolar a tela.
 * O service worker só é consultado quando o usuário clica no botão, ou
 * para o mouse ~300 ms sobre um vídeo/GIF ou mídia de post citado (prefetch,
 * para a cópia acontecer ainda dentro do "gesto do usuário").
 */
import { SEL } from './selectors';
import { buildMediaUrl, extractArticle, pickMediaDetail, type MediaKind, type MediaRef } from './core';
import type { Res } from './messages';

export interface UiDeps {
  doc: Document;
  ask: (id: string) => Promise<Res>;
  writeText: (text: string) => Promise<void>;
  hoverDelayMs?: number;
}

/** Uma mídia na tela: pode já estar resolvida (MediaRef) ou depender do syndication. */
interface Target {
  el: Element;
  kind: MediaKind;
  quoted: boolean;
  index: number;
  peek(): MediaRef | null;
  resolve(): Promise<MediaRef | null>;
}

const UI_CLASSES = '.mlx-btn, .mlx-toast';
const MEMO_MAX = 200;

export function createUi(deps: UiDeps) {
  const { doc } = deps;
  const hoverDelay = deps.hoverDelayMs ?? 300;

  // ---------- cache local de respostas (para copiar de forma síncrona no clique) ----------
  const memo = new Map<string, Res>();
  const pendingAsk = new Map<string, Promise<Res>>();
  function askCached(id: string): Promise<Res> {
    const hit = memo.get(id);
    if (hit) return Promise.resolve(hit);
    const running = pendingAsk.get(id);
    if (running) return running;
    const p = deps
      .ask(id)
      .then((r) => {
        memo.set(id, r);
        if (memo.size > MEMO_MAX) {
          const first = memo.keys().next().value;
          if (first !== undefined) memo.delete(first);
        }
        return r;
      })
      .finally(() => pendingAsk.delete(id));
    pendingAsk.set(id, p);
    return p;
  }

  // ---------- clipboard + toast ----------
  function toast(text: string) {
    doc.querySelector('.mlx-toast')?.remove();
    const t = doc.createElement('div');
    t.className = 'mlx-toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    doc.body.appendChild(t);
    setTimeout(() => (t.style.opacity = '0'), 1500);
    setTimeout(() => t.remove(), 1900);
  }

  async function copy(text: string, label: string): Promise<void> {
    try {
      await deps.writeText(text);
    } catch {
      // Fallback (é ele que justifica a permissão clipboardWrite): se o "gesto do
      // usuário" expirou depois de esperar o service worker, writeText falha.
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      doc.body.appendChild(ta);
      ta.select();
      const ok = doc.execCommand?.('copy') ?? false;
      ta.remove();
      if (!ok) return toast('Falha ao copiar');
    }
    toast(label);
  }

  // ---------- resolução ----------
  const linkOf = (m: MediaRef) => buildMediaUrl(m.user, m.id, m.kind, m.index);

  function targetsOf(article: Element): Target[] {
    const info = extractArticle(article);
    const out: Target[] = info.media.map((m) => ({
      el: m.el,
      kind: m.kind,
      quoted: m.quoted,
      index: m.index,
      peek: () => m,
      resolve: () => Promise.resolve(m),
    }));
    const mainId = info.main?.id;
    for (const p of info.pendingQuoted) {
      // O citado não tem permalink no DOM: o JSON do post principal traz quoted_tweet.
      const fromRes = (r: Res | undefined): MediaRef | null => {
        if (!r?.ok || !r.info.quoted) return null;
        const user = r.info.quoted.user ?? info.quote?.user;
        if (!user) return null;
        return {
          user,
          id: r.info.quoted.id,
          kind: p.kind,
          index: p.index,
          ordinal: p.ordinal,
          el: p.el,
          quoted: true,
        };
      };
      out.push({
        el: p.el,
        kind: p.kind,
        quoted: true,
        index: p.index,
        peek: () => (mainId ? fromRes(memo.get(mainId)) : null),
        resolve: async () => (mainId ? fromRes(await askCached(mainId)) : null),
      });
    }
    return out;
  }

  async function copyLink(t: Target) {
    const m = t.peek() ?? (await t.resolve());
    if (!m) return toast('Não consegui identificar o post desta mídia');
    await copy(linkOf(m), 'Link da mídia copiado');
  }

  function originOf(m: MediaRef, r: Res): string | { error: string } {
    if (!r.ok) return { error: r.error };
    const d = pickMediaDetail(r.info.media, m.kind, m.index, m.ordinal);
    return d?.expandedUrl ?? { error: 'Sem post de origem' };
  }

  async function copyOrigin(t: Target) {
    const m = t.peek() ?? (await t.resolve());
    if (!m) return toast('Não consegui identificar o post desta mídia');
    const r = memo.get(m.id) ?? (await askCached(m.id));
    const v = originOf(m, r);
    if (typeof v !== 'string') return toast(`Erro: ${v.error}`);
    await copy(v, 'Link da origem copiado');
  }

  /** Prefetch no hover: só para o que realmente precisa do syndication. */
  function prefetch(t: Target) {
    const m = t.peek();
    if (!m) {
      void t.resolve().then((r) => {
        if (r && r.kind === 'video') void askCached(r.id);
      });
    } else if (m.kind === 'video') {
      void askCached(m.id);
    }
  }

  // ---------- (b) botões no hover ----------
  function mkBtn(label: string, title: string, fn: () => Promise<void>) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    // Evita que o clique abra a foto ou pause o vídeo.
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    b.addEventListener('pointerdown', stop, true);
    b.addEventListener(
      'click',
      (e) => {
        stop(e);
        void fn();
      },
      true,
    );
    return b;
  }

  function decorate(t: Target) {
    const host = t.el as HTMLElement;
    const key = `${t.kind}:${t.index}:${t.quoted ? 'q' : 'm'}:${t.peek()?.id ?? '?'}`;
    if (host.dataset.mlxKey === key && host.querySelector(':scope > .mlx-btn')) return;
    host.querySelector(':scope > .mlx-btn')?.remove();
    host.dataset.mlxKey = key;
    host.classList.add('mlx-host');
    const box = doc.createElement('div');
    box.className = 'mlx-btn';
    // Foto: link da mídia. Vídeo/GIF: link da origem (post onde a mídia apareceu primeiro),
    // decisão do Matheus. É o único botão que a extensão adiciona.
    if (t.kind === 'video') {
      box.append(mkBtn('🔗 Link', 'Copiar link da origem', () => copyOrigin(t)));
    } else {
      box.append(mkBtn('🔗 Link', 'Copiar link da mídia', () => copyLink(t)));
    }
    host.appendChild(box);

    if (!host.dataset.mlxHover) {
      host.dataset.mlxHover = '1';
      let timer: ReturnType<typeof setTimeout> | undefined;
      host.addEventListener('pointerenter', () => {
        // Busca o alvo atual (o article pode ter sido re-renderizado).
        timer = setTimeout(() => {
          const cur = current.get(host);
          if (cur) prefetch(cur);
        }, hoverDelay);
      });
      host.addEventListener('pointerleave', () => clearTimeout(timer));
    }
    current.set(host, t);
  }
  const current = new WeakMap<Element, Target>();

  function scanArticle(a: Element) {
    if (!a.querySelector(SEL.media)) return;
    targetsOf(a).forEach(decorate);
  }

  // ---------- observer: processa só os nós adicionados ----------
  const dirtyArticles = new Set<Element>();
  let queued = false;

  function collect(node: Node) {
    if (!(node instanceof doc.defaultView!.Element)) return;
    if (node.closest(UI_CLASSES)) return; // nossas próprias inserções
    const art = node.closest(SEL.article);
    if (art) dirtyArticles.add(art);
    node.querySelectorAll(SEL.article).forEach((a) => dirtyArticles.add(a));
  }

  function flush() {
    queued = false;
    const arts = [...dirtyArticles];
    dirtyArticles.clear();
    arts.forEach((a) => a.isConnected && scanArticle(a));
  }

  function onMutations(records: MutationRecord[], schedule: (cb: () => void) => void) {
    for (const r of records) r.addedNodes.forEach(collect);
    if (!queued && dirtyArticles.size) {
      queued = true;
      schedule(flush);
    }
  }

  return { scanArticle, onMutations, flush, collect, copyLink, copyOrigin, targetsOf };
}
