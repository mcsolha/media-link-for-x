import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createUi } from '../../src/ui';
import type { Res } from '../../src/messages';

const fx = (f: string) => readFileSync(join(__dirname, '..', 'fixtures', f), 'utf8');

function mk(
  res: Res = {
    ok: true,
    info: { id: '3333333333333333333', media: [], quoted: { id: '4444', user: 'original' } },
  },
) {
  let t = 0;
  const ask = vi.fn((id: string) => Promise.resolve(id ? res : res));
  const writeText = vi.fn((s: string) => Promise.resolve(void s));
  const ui = createUi({ doc: document, ask, writeText, now: () => t, hoverDelayMs: 0 });
  return { ui, ask, writeText, advance: (ms: number) => (t += ms) };
}

function openMenu(ui: ReturnType<typeof createUi>) {
  const caret = document.querySelector('[data-testid="caret"]') ?? document.querySelector('article')!;
  ui.onClick({ target: caret } as unknown as Event);
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.innerHTML = '<div><div role="menuitem">Seguir</div></div>';
  document.body.appendChild(menu);
  return menu;
}

beforeEach(() => (document.body.innerHTML = ''));

describe('botões no hover', () => {
  it('decorate é idempotente e não faz requisição ao rolar', () => {
    document.body.innerHTML = fx('two-media.html');
    const { ui, ask } = mk();
    const a = document.querySelector('article')!;
    ui.scanArticle(a);
    ui.scanArticle(a);
    expect(document.querySelectorAll('.mlx-btn')).toHaveLength(2);
    expect(ask).not.toHaveBeenCalled();
  });
  it('rótulos: um "🔗 Link" por mídia (vídeo copia a origem); sem MP4', () => {
    document.body.innerHTML = fx('two-media.html');
    const { ui } = mk();
    ui.scanArticle(document.querySelector('article')!);
    const labels = [...document.querySelectorAll('.mlx-btn')].map((b) =>
      [...b.querySelectorAll('button')].map((x) => x.textContent),
    );
    expect(labels).toEqual([['🔗 Link'], ['🔗 Link']]);
    expect(document.body.textContent).not.toMatch(/mp4/i);
  });
  it('clique em "🔗 Link" copia o link /photo/N sem rede', async () => {
    document.body.innerHTML = fx('one-photo.html');
    const { ui, ask, writeText } = mk();
    ui.scanArticle(document.querySelector('article')!);
    document.querySelector<HTMLButtonElement>('.mlx-btn button')!.click();
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://x.com/fulano/status/1111111111111111111/photo/1'),
    );
    expect(ask).not.toHaveBeenCalled();
    expect(document.querySelector('.mlx-toast')?.textContent).toBe('Link da mídia copiado');
  });
  it('citado sem link: só consulta no clique, e copia a origem do citado', async () => {
    document.body.innerHTML = fx('quoted.html');
    const byId: Record<string, Res> = {
      '3333333333333333333': {
        ok: true,
        info: { id: '3333333333333333333', media: [], quoted: { id: '4444', user: 'original' } },
      },
      '4444': {
        ok: true,
        info: {
          id: '4444',
          media: [{ type: 'animated_gif', expandedUrl: 'https://x.com/orig/status/9/photo/1' }],
        },
      },
    };
    const fail: Res = { ok: false, error: 'x' };
    const ask = vi.fn((id: string) => Promise.resolve(byId[id] ?? fail));
    const writeText = vi.fn((s: string) => Promise.resolve(void s));
    const ui = createUi({ doc: document, ask, writeText, now: () => 0, hoverDelayMs: 0 });
    ui.scanArticle(document.querySelector('article')!);
    expect(ask).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.mlx-btn button')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://x.com/orig/status/9/photo/1'));
    expect(ask).toHaveBeenCalledWith('3333333333333333333');
    expect(ask).toHaveBeenCalledWith('4444');
  });
  it('citado sem link: o link /video/N do citado sai certo (menu)', async () => {
    document.body.innerHTML = fx('quoted.html');
    const { ui, writeText } = mk();
    const [t] = ui.targetsOf(document.querySelector('article')!);
    await ui.copyLink(t!);
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://x.com/original/status/4444/video/1'),
    );
  });
  it('"🔗 Link" de vídeo/GIF copia expanded_url do JSON (origem)', async () => {
    document.body.innerHTML = fx('two-media.html');
    const { ui, writeText } = mk({
      ok: true,
      info: {
        id: '2222222222222222222',
        media: [
          { type: 'photo' },
          { type: 'animated_gif', expandedUrl: 'https://x.com/orig/status/1/photo/1' },
        ],
      },
    });
    ui.scanArticle(document.querySelector('article')!);
    const btns = document.querySelectorAll<HTMLButtonElement>('.mlx-btn button');
    btns[btns.length - 1]!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://x.com/orig/status/1/photo/1'));
  });
});

describe('menu "..."', () => {
  it('3 chamadas em paralelo geram um único conjunto de itens', async () => {
    document.body.innerHTML = fx('two-media.html');
    const { ui } = mk();
    const menu = openMenu(ui);
    await Promise.all([ui.injectMenu(menu), ui.injectMenu(menu), ui.injectMenu(menu)]);
    const texts = [...menu.querySelectorAll('.mlx-menuitem')].map((d) => d.textContent);
    expect(texts).toEqual([
      'Copiar link da mídia:',
      'Foto 1',
      'Vídeo/GIF 2',
      'Copiar link da origem (Vídeo/GIF 2)',
    ]);
    expect(menu.querySelector('.mlx-header')?.getAttribute('role')).toBe('presentation');
  });
  it('menu que não veio do caret (ou veio tarde) não recebe itens', async () => {
    document.body.innerHTML = fx('two-media.html');
    const { ui, advance } = mk();
    const other = document.createElement('div');
    other.setAttribute('role', 'menu');
    document.body.appendChild(other);
    await ui.injectMenu(other);
    expect(other.querySelector('.mlx-menuitem')).toBeNull();
    const late = openMenu(ui);
    advance(2000);
    await ui.injectMenu(late);
    expect(late.querySelector('.mlx-menuitem')).toBeNull();
  });
  it('item acessível por teclado (Enter)', async () => {
    document.body.innerHTML = fx('one-photo.html');
    const { ui, writeText } = mk();
    const menu = openMenu(ui);
    await ui.injectMenu(menu);
    const item = menu.querySelector<HTMLElement>('.mlx-menuitem')!;
    expect(item.textContent).toBe('Copiar link da mídia');
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  });
});

describe('observer', () => {
  it('processa só nós adicionados e ignora a própria UI', () => {
    const { ui } = mk();
    const schedule = vi.fn((cb: () => void) => cb());
    const art = document.createElement('div');
    art.innerHTML = fx('one-photo.html');
    document.body.appendChild(art);
    ui.onMutations([{ addedNodes: [art] } as unknown as MutationRecord], schedule);
    expect(document.querySelectorAll('.mlx-btn')).toHaveLength(1);
    const btn = document.querySelector('.mlx-btn')!;
    ui.onMutations([{ addedNodes: [btn] } as unknown as MutationRecord], schedule);
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
