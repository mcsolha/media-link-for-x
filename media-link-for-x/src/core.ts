/**
 * Lógica pura (sem chrome.*). Tudo aqui é testado com vitest.
 */
import { SEL } from './selectors';

export type MediaKind = 'photo' | 'video';

export interface MediaRef {
  user: string;
  id: string;
  kind: MediaKind;
  /** Índice 1-based, igual ao da URL (posição entre TODAS as mídias do post). */
  index: number;
  /** Posição 1-based entre as mídias do MESMO tipo (usada para cruzar com o JSON). */
  ordinal: number;
  /** Elemento de mídia no DOM (para o botão de hover). */
  el: Element;
  /** true se a mídia pertence ao post citado. */
  quoted: boolean;
}

/** IDs de post são números de até 20 dígitos (snowflake). */
export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{1,20}$/.test(id);
}

/**
 * Token do endpoint de syndication (mesmo algoritmo do widget de embed do X).
 * Atenção: IDs de 19 dígitos passam de Number.MAX_SAFE_INTEGER, então `Number(id)`
 * perde precisão. O widget oficial tem a mesma imprecisão, então reproduzimos igual
 * (há um teste com valor conhecido para pegar qualquer mudança acidental).
 */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function syndicationUrl(id: string): string {
  const q = new URLSearchParams({ id, lang: 'en', token: syndicationToken(id) });
  return `https://cdn.syndication.twimg.com/tweet-result?${q.toString()}`;
}

export function buildMediaUrl(user: string, id: string, kind: MediaKind, index: number): string {
  return `https://x.com/${user}/status/${id}/${kind}/${index}`;
}

const X_HOSTS = new Set([
  'x.com',
  'twitter.com',
  'mobile.x.com',
  'mobile.twitter.com',
  'www.x.com',
  'www.twitter.com',
]);
const STATUS_PATH = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})(?:\/(photo|video)\/(\d{1,2}))?\/?$/;

/**
 * Extrai {user,id,kind?,index?} de um href do X (relativo ou absoluto).
 * A regex é aplicada só no pathname, e só para hosts do X: links externos
 * (cards, ?ref=...) são ignorados.
 */
export function parseStatusHref(
  href: string,
): { user: string; id: string; kind?: MediaKind; index?: number } | null {
  let u: URL;
  try {
    u = new URL(href, 'https://x.com');
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !X_HOSTS.has(u.hostname)) return null;
  const m = STATUS_PATH.exec(u.pathname);
  if (!m || !m[1] || !m[2] || m[1] === 'i') return null;
  const out: { user: string; id: string; kind?: MediaKind; index?: number } = { user: m[1], id: m[2] };
  if (m[3] && m[4]) {
    out.kind = m[3] as MediaKind;
    out.index = Number(m[4]);
  }
  return out;
}

/** Só deixa passar URLs https de hosts do X. Evita copiar `javascript:`, outro host etc. */
export function safeXUrl(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && X_HOSTS.has(u.hostname) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export interface SyndicationMedia {
  /** photo | video | animated_gif (ou outro valor desconhecido). */
  type: string;
  /** Link do post ONDE a mídia foi publicada pela primeira vez (validado). */
  expandedUrl?: string;
}
export interface SyndicationInfo {
  id: string;
  user?: string;
  media: SyndicationMedia[];
  quoted?: { id: string; user?: string };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Converte o JSON do tweet-result no que nos interessa, sem confiar em nada. */
export function parseSyndication(json: unknown): SyndicationInfo | null {
  if (!isObj(json) || !isValidId(json.id_str)) return null;
  const details = Array.isArray(json.mediaDetails) ? json.mediaDetails : [];
  const media: SyndicationMedia[] = details.filter(isObj).map((m) => {
    const out: SyndicationMedia = { type: str(m.type) ?? 'unknown' };
    const url = safeXUrl(m.expanded_url);
    if (url) out.expandedUrl = url;
    return out;
  });
  const info: SyndicationInfo = { id: json.id_str, media };
  const user = isObj(json.user) ? str(json.user.screen_name) : undefined;
  if (user) info.user = user;
  const q = json.quoted_tweet;
  if (isObj(q) && isValidId(q.id_str)) {
    const qu = isObj(q.user) ? str(q.user.screen_name) : undefined;
    info.quoted = qu ? { id: q.id_str, user: qu } : { id: q.id_str };
  }
  return info;
}

/**
 * Escolhe a entrada de mediaDetails de uma mídia. Primeiro tenta a posição
 * (index); se o tipo não bater (ex.: mosaico foto+vídeo em que a ordem do DOM
 * diverge), usa a N-ésima mídia do mesmo tipo.
 */
export function pickMediaDetail(
  media: SyndicationMedia[],
  kind: MediaKind,
  index: number,
  ordinal: number,
): SyndicationMedia | undefined {
  const isKind = (d: SyndicationMedia) => (kind === 'photo' ? d.type === 'photo' : d.type !== 'photo');
  const byIndex = media[index - 1];
  if (byIndex && isKind(byIndex)) return byIndex;
  return media.filter(isKind)[ordinal - 1];
}

/** Mantém só os elementos mais externos (tweetPhoto pode conter videoPlayer etc.). */
function outermost(els: Element[]): Element[] {
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
}

function idFromLinks(scope: Element, exclude?: Element | null): { user: string; id: string } | null {
  const links = Array.from(scope.querySelectorAll<HTMLAnchorElement>(SEL.statusLink)).filter(
    (a) => !exclude || !exclude.contains(a),
  );
  // Preferência: link do <time> (permalink) → link de foto → qualquer /status/.
  const ordered = [
    ...links.filter((a) => a.querySelector('time')),
    ...links.filter((a) => a.matches(SEL.photoLink)),
    ...links,
  ];
  for (const a of ordered) {
    const p = parseStatusHref(a.getAttribute('href') ?? '');
    if (p) return { user: p.user, id: p.id };
  }
  return null;
}

function userFromScope(scope: Element): string | undefined {
  const un = scope.querySelector(SEL.userName);
  if (!un) return undefined;
  // Lê cada nó de texto separado: textContent junta "@original" + "2h" em "original2h".
  const walker = un.ownerDocument.createTreeWalker(un, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim().match(/^@([A-Za-z0-9_]{1,15})$/);
    if (t?.[1]) return t[1];
  }
  return undefined;
}

export const kindOf = (el: Element): MediaKind =>
  el.matches(SEL.videoHint) || el.querySelector(SEL.videoHint) ? 'video' : 'photo';

export interface PendingMedia {
  el: Element;
  kind: MediaKind;
  index: number;
  ordinal: number;
}

export interface ArticleInfo {
  main: { user: string; id: string } | null;
  /** Post citado; o id pode faltar (o X nem sempre põe link) e aí é resolvido via syndication. */
  quote: { user?: string; id?: string; el: Element } | null;
  media: MediaRef[];
  /** Mídias do citado cujo id não deu para descobrir pelo DOM (resolvidas só sob demanda). */
  pendingQuoted: PendingMedia[];
}

/**
 * Descobre usuário/id/índice de todas as mídias de um article, só pelo DOM.
 * Mídias dentro do bloco citado pertencem ao post citado.
 */
export function extractArticle(article: Element): ArticleInfo {
  const quoteEl =
    Array.from(article.querySelectorAll(SEL.quote)).find(
      (q) => q.querySelector(SEL.userName) || q.querySelector(SEL.media),
    ) ?? null;
  const main = idFromLinks(article, quoteEl);
  const quoteIds = quoteEl ? idFromLinks(quoteEl) : null;
  let quote: ArticleInfo['quote'] = null;
  if (quoteEl) {
    quote = { el: quoteEl };
    const user = quoteIds?.user ?? userFromScope(quoteEl);
    if (user) quote.user = user;
    if (quoteIds?.id) quote.id = quoteIds.id;
  }

  const all = outermost(Array.from(article.querySelectorAll(SEL.media)));
  const groups: [Element[], boolean][] = [
    [all.filter((m) => !quoteEl?.contains(m)), false],
    [all.filter((m) => quoteEl?.contains(m)), true],
  ];
  const media: MediaRef[] = [];
  const pendingQuoted: PendingMedia[] = [];
  for (const [list, quoted] of groups) {
    const owner = quoted ? quote : main;
    const count = { photo: 0, video: 0 };
    list.forEach((el, i) => {
      const kind = kindOf(el);
      const ordinal = ++count[kind];
      // Se a foto está num <a href=".../photo/N">, esse N é a verdade.
      const a = el.closest(SEL.photoLink) ?? el.querySelector(SEL.photoLink);
      const p = a ? parseStatusHref(a.getAttribute('href') ?? '') : null;
      if (p?.index) {
        media.push({ user: p.user, id: p.id, kind, index: p.index, ordinal, el, quoted });
      } else if (owner?.id && owner.user) {
        media.push({ user: owner.user, id: owner.id, kind, index: i + 1, ordinal, el, quoted });
      } else if (quoted) {
        pendingQuoted.push({ el, kind, index: i + 1, ordinal });
      }
    });
  }
  return { main, quote, media, pendingQuoted };
}
