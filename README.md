# X Media Link

Extensão do Chrome (Manifest V3, TypeScript) que traz para o **x.com desktop** a opção do app mobile **"copiar link da mídia"**:

- Foto: `https://x.com/<usuario>/status/<id>/photo/<n>`
- Vídeo/GIF: `https://x.com/<usuario>/status/<id>/video/<n>`

Cole esse link num post novo e o X embute a mídia.

## Instalação

```bash
npm install
npm run build      # gera dist/
npm test           # vitest (precisa de internet para o teste do syndication)
```

1. Abra `chrome://extensions`.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta `dist/`.
4. Recarregue a aba do x.com.

## Como usar

- **Hover na mídia:** aparecem os botões `🔗 Link` (link da mídia) e, em vídeos/GIFs, `Origem` (post onde a mídia foi publicada pela primeira vez) e `MP4` (arquivo de vídeo direto).
- **Menu "..." do post:** itens "Copiar link da mídia" (com subitens se houver várias mídias), "Copiar link da origem" e "Copiar URL do MP4".
- Um toast "Copiado" confirma a cópia.

## Como funciona

| Arquivo | Papel |
|---|---|
| `src/selectors.ts` | **Todos** os seletores de DOM, comentados. É o único lugar a mexer quando o X mudar o HTML. |
| `src/core.ts` | Lógica pura (testada): token, URLs, parse do JSON, extração de usuário/id/índice. |
| `src/content.ts` | Content script: MutationObserver, botões de hover, injeção no menu, clipboard, toast. |
| `src/background.ts` | Service worker: faz o fetch no syndication (sem CORS graças ao `host_permissions`). |

Fluxo: o X é uma SPA com scroll virtualizado, então um `MutationObserver` no `<body>` (com debounce via `requestAnimationFrame`) re-escaneia os `article[data-testid="tweet"]`. Para cada mídia:

1. Se a foto está dentro de `<a href="/u/status/ID/photo/N">`, o próprio X já deu a resposta.
2. Senão (vídeos/GIFs não têm esse link), usa o permalink do post (o `<a>` que contém o `<time>`) e o índice pela **ordem** da mídia no post.
3. Mídias dentro do bloco citado (`div[role="link"]`) pertencem ao post citado. Se o citado não tiver link no DOM (comum), a extensão pede ao service worker o JSON do post principal e usa `quoted_tweet.id_str`.

O menu "..." é renderizado num *portal* fora do article; por isso guardamos qual article teve o `caret` clicado e, quando um `[role="menu"]` aparece, injetamos nossos itens nele.

## Engenharia reversa: o passo a passo

1. **Elements:** inspecione um post. Classes como `css-175oi2r` são geradas e instáveis; os `data-testid` (`tweet`, `tweetPhoto`, `videoPlayer`, `caret`, `User-Name`) são feitos para os testes do próprio X e mudam bem menos. Note que fotos vêm embrulhadas em `<a href=".../photo/N">`.
2. **Menu:** clique no "..." e veja o `div[role="menu"]` surgir no fim do `<body>`. Dica: botão direito no `<body>` → *Break on → subtree modifications*.
3. **Network:** abra um embed de tweet (publish.twitter.com ou um site com tweet embutido), filtre por `tweet-result` e você acha `https://cdn.syndication.twimg.com/tweet-result?id=...&lang=en&token=...`. É público e não usa login.
4. **Token:** procurando `token` no JS do widget de embed (Sources → Ctrl+Shift+F) aparece a fórmula:
   ```js
   ((id / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
   ```
   (Na prática hoje o endpoint aceita até token errado, mas mandamos o certo por segurança.)
5. **JSON:** `mediaDetails[n].expanded_url` aponta para o post **original** da mídia (ex.: `id=1696580817642729897` → `https://x.com/saintpsblo/status/1696576087193481500/photo/1`; repare que é `/photo/` mesmo para GIF). `mediaDetails[n].video_info.variants[]` tem os MP4 (pegamos o de maior bitrate).

## Limitações

- **O DOM do X muda.** Se os botões sumirem, atualize `src/selectors.ts` (instruções lá dentro).
- **Não foi testado no x.com logado.** Os testes usam fixtures HTML que *imitam* a estrutura; o comportamento real só se confirma carregando a extensão.
- **GIFs da busca de GIFs do X** (o botão GIF do compositor) não têm post de origem: `expanded_url` aponta para o próprio post.
- **Posts apagados, privados ou com restrição de idade:** o syndication devolve erro/`{}` → toast de erro.
- A cópia depois de um fetch pode perder o "gesto do usuário"; há fallback com `execCommand('copy')`.
- Índice de vídeo calculado pela ordem do DOM; em layouts incomuns (cards, anúncios) pode errar.
- Nenhuma credencial ou API autenticada do X é usada (`credentials: 'omit'`).
