/**
 * Lógica pura (sem chrome.*) — tudo aqui é testado com vitest.
 */
import { SEL } from './selectors';

export type MediaKind = 'photo' | 'video';

export interface MediaRef {
  user: string;
  id: string;
  kind: MediaKind;
  /** Índice 1-based, igual ao da URL. */
  index: number;
  /** Elemento de mídia no DOM (para o botão de hover). */
  el: Element;
  /** true se a mídia pertence ao post citado. */
  quoted: boolean;
}

/** Token do endpoint de syndication (mesmo algoritmo do widget de embed do X). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function syndicationUrl(id: string): string {
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`;
}

export function buildMediaUrl(user: string, id: string, kind: MediaKind, index: number): string {
  return `https://x.com/${user}/status/${id}/${kind}/${index}`;
}

/** Extrai {user,id,kind?,index?} de um href do X (relativo ou absoluto). */
export function parseStatusHref(href: string): { user: string; id: string; kind?: MediaKind; index?: number } | null {
  const m = href.match(/(?:^|\/\/[^/]+)?\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\/(photo|video)\/(\d+))?/);
  if (!m || m[1] === 'i') return null;
  return { user: m[1], id: m[2], kind: m[3] as MediaKind | undefined, index: m[4] ? Number(m[4]) : undefined };
}

export interface SyndicationMedia {
  type: string; // photo | video | animated_gif
  expandedUrl?: string;
  mp4?: string;
}
export interface SyndicationInfo {
  id: string;
  user?: string;
  media: SyndicationMedia[];
  quoted?: { id: string; user?: string };
}

/** Converte o JSON do tweet-result no que nos interessa. */
export function parseSyndication(json: any): SyndicationInfo | null {
  if (!json || typeof json !== 'object' || !json.id_str) return null;
  const media: SyndicationMedia[] = (json.mediaDetails ?? []).map((m: any) => {
    const mp4s = (m.video_info?.variants ?? []).filter((v: any) => v.content_type === 'video/mp4' && v.url);
    // Pega o MP4 de maior bitrate (GIFs têm só um, com bitrate 0).
    mp4s.sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    return { type: m.type, expandedUrl: m.expanded_url, mp4: mp4s[0]?.url };
  });
  const q = json.quoted_tweet;
  return {
    id: json.id_str,
    user: json.user?.screen_name,
    media,
    quoted: q?.id_str ? { id: q.id_str, user: q.user?.screen_name } : undefined,
  };
}

/** Mantém só os elementos mais externos (tweetPhoto pode conter videoPlayer etc.). */
function outermost(els: Element[]): Element[] {
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
}

function idFromLinks(scope: Element, exclude?: Element | null): { user: string; id: string } | null {
  const links = Array.from(scope.querySelectorAll<HTMLAnchorElement>(SEL.statusLink))
    .filter((a) => !exclude || !exclude.contains(a));
  // Preferência: link do <time> (permalink) → link de foto → qualquer /status/.
  const ordered = [
    ...links.filter((a) => a.querySelector('time')),
    ...links.filter((a) => /\/photo\//.test(a.getAttribute('href') ?? '')),
    ...links,
  ];
  for (const a of ordered) {
    const p = parseStatusHref(a.getAttribute('href') ?? '');
    if (p) return { user: p.user, id: p.id };
  }
  return null;
}

function userFromScope(scope: Element): string | undefined {
  // No bloco User-Name existe um texto "@usuario" e/ou link "/usuario".
  const un = scope.querySelector(SEL.userName);
  if (!un) return undefined;
  // Lê cada nó de texto separado: textContent junta "@original" + "2h" em "original2h".
  const walker = un.ownerDocument.createTreeWalker(un, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim().match(/^@([A-Za-z0-9_]{1,15})$/);
    if (t) return t[1];
  }
  return undefined;
}

export interface ArticleInfo {
  main: { user: string; id: string } | null;
  /** Post citado; id pode faltar (o X nem sempre põe link) → resolvemos via syndication. */
  quote: { user?: string; id?: string; el: Element } | null;
  media: MediaRef[];
  /** Mídias do citado cujo id não deu para descobrir pelo DOM. */
  pendingQuoted: Element[];
}

/**
 * Descobre usuário/id/índice de todas as mídias de um article.
 * Mídias dentro do bloco citado pertencem ao post citado.
 */
export function extractArticle(article: Element): ArticleInfo {
  const quoteEl =
    Array.from(article.querySelectorAll(SEL.quote)).find((q) => q.querySelector(SEL.userName) || q.querySelector(SEL.media)) ?? null;
  const main = idFromLinks(article, quoteEl);
  const quoteIds = quoteEl ? idFromLinks(quoteEl) : null;
  const quote = quoteEl ? { el: quoteEl, user: quoteIds?.user ?? userFromScope(quoteEl), id: quoteIds?.id } : null;

  const all = outermost(Array.from(article.querySelectorAll(SEL.media)));
  const groups: [Element[], boolean][] = [
    [all.filter((m) => !quoteEl?.contains(m)), false],
    [all.filter((m) => quoteEl?.contains(m)), true],
  ];
  const media: MediaRef[] = [];
  const pendingQuoted: Element[] = [];
  for (const [list, quoted] of groups) {
    const owner = quoted ? quote : main;
    list.forEach((el, i) => {
      const kind: MediaKind = el.matches(SEL.videoHint) || el.querySelector(SEL.videoHint) ? 'video' : 'photo';
      // Se a foto está num <a href=".../photo/N">, esse N é a verdade.
      const a = el.closest('a[href*="/photo/"]') ?? el.querySelector('a[href*="/photo/"]');
      const p = a ? parseStatusHref(a.getAttribute('href') ?? '') : null;
      if (p?.index) {
        media.push({ user: p.user, id: p.id, kind, index: p.index, el, quoted });
      } else if (owner?.id && owner.user) {
        media.push({ user: owner.user, id: owner.id, kind, index: i + 1, el, quoted });
      } else if (quoted) {
        pendingQuoted.push(el);
      }
    });
  }
  return { main, quote, media, pendingQuoted };
}
