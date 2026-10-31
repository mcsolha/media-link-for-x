/**
 * Content script do x.com / twitter.com.
 * - Botão no hover de cada mídia (foto: "🔗 Link"; vídeo/GIF: "🔗 Link" da origem e "MP4").
 * - Itens extras no menu "..." do post.
 * O X é uma SPA (React): os posts entram e saem do DOM o tempo todo (scroll
 * virtualizado), então usamos MutationObserver em vez de rodar uma vez só.
 */
import { SEL } from './selectors';
import { buildMediaUrl, extractArticle, type MediaRef } from './core';
import type { Req, Res } from './messages';

// ---------- clipboard + toast ----------
function toast(text: string) {
  document.querySelector('.xml-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'xml-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => (t.style.opacity = '0'), 1500);
  setTimeout(() => t.remove(), 1900);
}

async function copy(text: string, label = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback: se o "gesto do usuário" expirou (ex.: depois de um fetch lento).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) return toast('Falha ao copiar');
  }
  toast(label);
}

function ask(id: string): Promise<Res> {
  return chrome.runtime.sendMessage<Req, Res>({ type: 'syndication', id });
}

// ---------- resolução de mídia (inclui citado sem link) ----------
async function resolveMedia(article: Element): Promise<MediaRef[]> {
  const info = extractArticle(article);
  if (!info.pendingQuoted.length || !info.main) return info.media;
  // O citado não tem permalink no DOM: o JSON do post principal traz quoted_tweet.
  const r = await ask(info.main.id);
  if (r.ok && r.info.quoted?.id) {
    const user = r.info.quoted.user ?? info.quote?.user;
    if (user) {
      info.pendingQuoted.forEach((el, i) =>
        info.media.push({ user, id: r.info.quoted!.id, kind: el.querySelector(SEL.videoHint) || el.matches(SEL.videoHint) ? 'video' : 'photo', index: i + 1, el, quoted: true }),
      );
    }
  }
  return info.media;
}

const linkOf = (m: MediaRef) => buildMediaUrl(m.user, m.id, m.kind, m.index);

async function copyOrigin(m: MediaRef, what: 'origin' | 'mp4') {
  const r = await ask(m.id);
  if (!r.ok) return toast(`Erro: ${r.error}`);
  const d = r.info.media[m.index - 1];
  const val = what === 'origin' ? d?.expandedUrl : d?.mp4;
  if (!val) return toast(what === 'origin' ? 'Sem post de origem' : 'Sem MP4');
  copy(val, what === 'origin' ? 'Link da origem copiado' : 'MP4 copiado');
}

// ---------- (b) botão no hover ----------
function mkBtn(label: string, title: string, fn: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  // Evita que o clique abra a foto/pause o vídeo.
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  b.addEventListener('pointerdown', stop, true);
  b.addEventListener('click', (e) => { stop(e); fn(); }, true);
  return b;
}

function decorate(m: MediaRef) {
  const host = m.el as HTMLElement;
  if (host.dataset.xmlDone === linkOf(m)) return;
  host.querySelector(':scope > .xml-btn')?.remove();
  host.dataset.xmlDone = linkOf(m);
  host.classList.add('xml-host');
  const box = document.createElement('div');
  box.className = 'xml-btn';
  if (m.kind === 'video') {
    // Vídeo/GIF: o "Link" copia o link da origem (post onde a mídia foi publicada primeiro).
    box.append(mkBtn('🔗 Link', 'Copiar link da origem', () => copyOrigin(m, 'origin')));
    box.append(mkBtn('MP4', 'Copiar URL do MP4', () => copyOrigin(m, 'mp4')));
  } else {
    box.append(mkBtn('🔗 Link', 'Copiar link da mídia', () => copy(linkOf(m), 'Link da mídia copiado')));
  }
  host.appendChild(box);
}

async function scanArticle(a: Element) {
  if (!a.querySelector(SEL.media)) return;
  (await resolveMedia(a)).forEach(decorate);
}

// ---------- (a) menu "..." ----------
let lastArticle: Element | null = null;
document.addEventListener('click', (e) => {
  const caret = (e.target as Element)?.closest?.(SEL.caret);
  if (caret) lastArticle = caret.closest(SEL.article);
}, true);

function closeMenu() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function menuItem(text: string, sub: boolean, fn: () => void) {
  const d = document.createElement('div');
  d.className = 'xml-menuitem' + (sub ? ' xml-sub' : '');
  d.setAttribute('role', 'menuitem');
  d.tabIndex = 0;
  d.textContent = text;
  d.addEventListener('click', (e) => { e.stopPropagation(); fn(); closeMenu(); });
  return d;
}

async function injectMenu(menu: Element) {
  if (menu.querySelector('.xml-menuitem') || !lastArticle) return;
  const media = (await resolveMedia(lastArticle)).filter((m) => !m.quoted);
  const own = media.length ? media : await resolveMedia(lastArticle); // só citado? usa as do citado
  if (!own.length) return;
  const list = menu.querySelector(SEL.menuItem)?.parentElement ?? menu;
  const items: HTMLElement[] = [];
  const name = (m: MediaRef) => `${m.kind === 'photo' ? 'Foto' : 'Vídeo/GIF'} ${m.index}${m.quoted ? ' (citado)' : ''}`;
  if (own.length === 1) {
    items.push(menuItem('Copiar link da mídia', false, () => copy(linkOf(own[0]), 'Link da mídia copiado')));
  } else {
    items.push(menuItem('Copiar link da mídia:', false, () => {}));
    own.forEach((m) => items.push(menuItem(name(m), true, () => copy(linkOf(m), 'Link da mídia copiado'))));
  }
  own.filter((m) => m.kind === 'video').forEach((m) => {
    const suf = own.length > 1 ? ` — ${name(m)}` : '';
    items.push(menuItem(`Copiar link da origem${suf}`, false, () => copyOrigin(m, 'origin')));
    items.push(menuItem(`Copiar URL do MP4${suf}`, false, () => copyOrigin(m, 'mp4')));
  });
  list.prepend(...items);
}

// ---------- observer ----------
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    document.querySelectorAll(SEL.article).forEach((a) => void scanArticle(a));
    document.querySelectorAll(SEL.menu).forEach((m) => void injectMenu(m));
  });
}
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
