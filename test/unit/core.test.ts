import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildMediaUrl,
  extractArticle,
  isValidId,
  parseStatusHref,
  parseSyndication,
  pickMediaDetail,
  safeXUrl,
  syndicationToken,
  syndicationUrl,
} from '../../src/core';

const fx = (f: string) => readFileSync(join(__dirname, '..', 'fixtures', f), 'utf8');
const load = (f: string) => {
  document.body.innerHTML = fx(f);
  return document.querySelector('article')!;
};
const urls = (a: Element) => extractArticle(a).media.map((m) => buildMediaUrl(m.user, m.id, m.kind, m.index));

describe('URLs e token', () => {
  it('monta link de mídia', () => {
    expect(buildMediaUrl('a', '1', 'photo', 1)).toBe('https://x.com/a/status/1/photo/1');
    expect(buildMediaUrl('a', '1', 'video', 2)).toBe('https://x.com/a/status/1/video/2');
  });
  it('token: valor conhecido (pega mudança acidental no algoritmo)', () => {
    expect(syndicationToken('1696580817642729897')).toBe('441yrpwfsoo');
    expect(syndicationToken('20')).toMatch(/^[1-9a-z]+$/);
  });
  it('syndicationUrl usa URLSearchParams', () => {
    expect(syndicationUrl('1696580817642729897')).toBe(
      'https://cdn.syndication.twimg.com/tweet-result?id=1696580817642729897&lang=en&token=441yrpwfsoo',
    );
  });
  it('isValidId', () => {
    expect(isValidId('123')).toBe(true);
    expect(isValidId('12a')).toBe(false);
    expect(isValidId('1'.repeat(21))).toBe(false);
    expect(isValidId(123)).toBe(false);
  });
});

describe('parseStatusHref (ancorado no host)', () => {
  it('casos válidos', () => {
    expect(parseStatusHref('/u/status/9/photo/3')).toEqual({ user: 'u', id: '9', kind: 'photo', index: 3 });
    expect(parseStatusHref('https://x.com/u_1/status/9')).toEqual({ user: 'u_1', id: '9' });
    expect(parseStatusHref('https://twitter.com/u/status/9/video/1')).toEqual({
      user: 'u',
      id: '9',
      kind: 'video',
      index: 1,
    });
  });
  it('rejeita host externo, query string, /i/, /i/web e usuário com 16 caracteres', () => {
    expect(parseStatusHref('https://evil.com/a/status/1')).toBeNull();
    expect(parseStatusHref('https://x.com.evil.com/a/status/1')).toBeNull();
    expect(parseStatusHref('/explore?ref=/a/status/1')).toBeNull();
    expect(parseStatusHref('/i/status/9')).toBeNull();
    expect(parseStatusHref('/i/web/status/9')).toBeNull();
    expect(parseStatusHref('/abcdefghijklmnop/status/9')).toBeNull();
    expect(parseStatusHref('/explore')).toBeNull();
  });
});

describe('safeXUrl', () => {
  it('aceita só https em hosts do X', () => {
    expect(safeXUrl('https://x.com/a/status/1/photo/1')).toBe('https://x.com/a/status/1/photo/1');
    expect(safeXUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeXUrl('http://x.com/a')).toBeUndefined();
    expect(safeXUrl('https://evilx.com/a')).toBeUndefined();
    expect(safeXUrl('https://x.com.evil.com/a')).toBeUndefined();
    expect(safeXUrl('m3u8')).toBeUndefined();
    expect(safeXUrl(42)).toBeUndefined();
  });
});

describe('parseSyndication', () => {
  it('fixture gravada do endpoint real (id 1696580817642729897)', () => {
    const info = parseSyndication(JSON.parse(fx('syndication-1696580817642729897.json')))!;
    expect(info.id).toBe('1696580817642729897');
    expect(info.media).toEqual([
      { type: 'animated_gif', expandedUrl: 'https://x.com/saintpsblo/status/1696576087193481500/photo/1' },
    ]);
  });
  it('quoted_tweet com e sem user', () => {
    expect(
      parseSyndication({ id_str: '1', quoted_tweet: { id_str: '5', user: { screen_name: 'q' } } })?.quoted,
    ).toEqual({ id: '5', user: 'q' });
    expect(parseSyndication({ id_str: '1', quoted_tweet: { id_str: '5' } })?.quoted).toEqual({ id: '5' });
  });
  it('entrada hostil ou malformada', () => {
    expect(parseSyndication({})).toBeNull();
    expect(parseSyndication(null)).toBeNull();
    expect(parseSyndication({ id_str: 'abc' })).toBeNull();
    expect(parseSyndication({ id_str: '1', mediaDetails: 'x' })?.media).toEqual([]);
    expect(
      parseSyndication({
        id_str: '1',
        mediaDetails: [null, { type: 7, expanded_url: 'javascript:x' }, { type: 'photo' }],
      })?.media,
    ).toEqual([{ type: 'unknown' }, { type: 'photo' }]);
  });
});

describe('pickMediaDetail (cruza índice do DOM com o JSON)', () => {
  const media = [
    { type: 'photo', expandedUrl: 'https://x.com/a/status/1/photo/1' },
    { type: 'video', expandedUrl: 'https://x.com/b/status/2/video/1' },
  ];
  it('usa o índice quando o tipo bate', () => expect(pickMediaDetail(media, 'video', 2, 1)).toBe(media[1]));
  it('cai para o N-ésimo do mesmo tipo quando a ordem diverge', () =>
    expect(pickMediaDetail(media, 'video', 1, 1)).toBe(media[1]));
  it('undefined se não houver', () => expect(pickMediaDetail(media, 'video', 1, 2)).toBeUndefined());
});

describe('extractArticle (fixtures HTML)', () => {
  it('1 foto', () =>
    expect(urls(load('one-photo.html'))).toEqual([
      'https://x.com/fulano/status/1111111111111111111/photo/1',
    ]));
  it('2 mídias (foto + vídeo aninhado em tweetPhoto → um só item, índice pela ordem)', () =>
    expect(urls(load('two-media.html'))).toEqual([
      'https://x.com/ciclana/status/2222222222222222222/photo/1',
      'https://x.com/ciclana/status/2222222222222222222/video/2',
    ]));
  it('4 fotos', () => expect(urls(load('four-photos.html'))).toHaveLength(4));
  it('repost: usa o post original, não quem repostou', () =>
    expect(urls(load('retweet.html'))).toEqual(['https://x.com/autora/status/6666666666666666666/video/1']));
  it('post sem mídia (e com link externo /status/)', () => {
    const info = extractArticle(load('no-media.html'));
    expect(info.media).toEqual([]);
    expect(info.main).toEqual({ user: 'texto', id: '7777777777777777777' });
  });
  it('citado com vídeo e sem link: id principal correto e mídia do citado pendente', () => {
    const info = extractArticle(load('quoted.html'));
    expect(info.main).toEqual({ user: 'quemcita', id: '3333333333333333333' });
    expect(info.quote?.user).toBe('original');
    expect(info.media).toEqual([]);
    expect(info.pendingQuoted.map((p) => [p.kind, p.index])).toEqual([['video', 1]]);
  });
  it('citado com link: cada mídia aponta para o post certo', () =>
    expect(urls(load('quoted-with-link.html'))).toEqual([
      'https://x.com/quemcita/status/3333333333333333333/photo/1',
      'https://x.com/original/status/4444444444444444444/photo/2',
    ]));
});
