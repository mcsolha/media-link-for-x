import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMediaUrl, extractArticle, parseStatusHref, parseSyndication, syndicationToken, syndicationUrl } from '../src/core';

const load = (f: string) => {
  document.body.innerHTML = readFileSync(join(__dirname, 'fixtures', f), 'utf8');
  return document.querySelector('article')!;
};
const urls = (a: Element) => extractArticle(a).media.map((m) => buildMediaUrl(m.user, m.id, m.kind, m.index));

describe('URLs e token', () => {
  it('monta link de mídia', () => {
    expect(buildMediaUrl('a', '1', 'photo', 1)).toBe('https://x.com/a/status/1/photo/1');
    expect(buildMediaUrl('a', '1', 'video', 2)).toBe('https://x.com/a/status/1/video/2');
  });
  it('token é determinístico, sem zeros nem ponto', () => {
    const t = syndicationToken('1696580817642729897');
    expect(t).toMatch(/^[1-9a-z]+$/);
    expect(syndicationUrl('1696580817642729897')).toContain(`token=${t}`);
  });
  it('parseStatusHref', () => {
    expect(parseStatusHref('/u/status/9/photo/3')).toEqual({ user: 'u', id: '9', kind: 'photo', index: 3 });
    expect(parseStatusHref('https://x.com/u_1/status/9')).toEqual({ user: 'u_1', id: '9', kind: undefined, index: undefined });
    expect(parseStatusHref('/i/status/9')).toBeNull();
    expect(parseStatusHref('/explore')).toBeNull();
  });
});

describe('parseSyndication', () => {
  it('extrai expanded_url e o MP4 de maior bitrate', () => {
    const info = parseSyndication({
      id_str: '1', user: { screen_name: 'u' },
      mediaDetails: [{ type: 'video', expanded_url: 'https://x.com/o/status/2/video/1',
        video_info: { variants: [
          { content_type: 'application/x-mpegURL', url: 'm3u8' },
          { content_type: 'video/mp4', bitrate: 256000, url: 'low.mp4' },
          { content_type: 'video/mp4', bitrate: 2176000, url: 'high.mp4' }] } }],
      quoted_tweet: { id_str: '5', user: { screen_name: 'q' } },
    });
    expect(info).toEqual({ id: '1', user: 'u', media: [{ type: 'video', expandedUrl: 'https://x.com/o/status/2/video/1', mp4: 'high.mp4' }], quoted: { id: '5', user: 'q' } });
  });
  it('retorna null para lixo / post apagado ({})', () => {
    expect(parseSyndication({})).toBeNull();
    expect(parseSyndication(null)).toBeNull();
  });
});

describe('extractArticle (fixtures HTML)', () => {
  it('1 foto', () => expect(urls(load('one-photo.html'))).toEqual(['https://x.com/fulano/status/1111111111111111111/photo/1']));
  it('2 mídias (foto + vídeo, índice pela ordem)', () =>
    expect(urls(load('two-media.html'))).toEqual([
      'https://x.com/ciclana/status/2222222222222222222/photo/1',
      'https://x.com/ciclana/status/2222222222222222222/video/2',
    ]));
  it('citado sem link: id principal correto e mídia do citado pendente', () => {
    const info = extractArticle(load('quoted.html'));
    expect(info.main).toEqual({ user: 'quemcita', id: '3333333333333333333' });
    expect(info.quote?.user).toBe('original');
    expect(info.media).toEqual([]);
    expect(info.pendingQuoted).toHaveLength(1);
  });
  it('citado com link: cada mídia aponta para o post certo', () =>
    expect(urls(load('quoted-with-link.html'))).toEqual([
      'https://x.com/quemcita/status/3333333333333333333/photo/1',
      'https://x.com/original/status/4444444444444444444/photo/2',
    ]));
});

describe('endpoint real de syndication (rede)', () => {
  it('id 1696580817642729897 → expanded_url e mp4 esperados', async () => {
    const r = await fetch(syndicationUrl('1696580817642729897'));
    expect(r.status).toBe(200);
    const info = parseSyndication(await r.json())!;
    expect(info.media[0].expandedUrl).toBe('https://x.com/saintpsblo/status/1696576087193481500/photo/1');
    expect(info.media[0].mp4).toBe('https://video.twimg.com/tweet_video/F4ty9IMW8A8n8rn.mp4');
  });
});
