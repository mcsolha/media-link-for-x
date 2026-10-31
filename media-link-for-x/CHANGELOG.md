# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-10-30

### Alterado

- Novo nome: **Media Link for X** (pacote `media-link-for-x`), com aviso de não afiliação à X Corp.
- Hover: um único botão **🔗 Link** por mídia. Em foto copia o link da mídia; em vídeo/GIF copia o post de origem. O link `/video/N` fica no menu "...".
- O observer processa só os nós adicionados. Não há mais varredura completa a cada mutação.
- Posts citados sem link só são resolvidos no clique ou no hover. Nada é consultado ao rolar a tela.
- A versão do manifest passa a vir do `package.json`. `minimum_chrome_version` é 110.
- Os artefatos agora são `media-link-for-x-store.zip` (manifest na raiz) e `media-link-for-x-src.zip`.

### Adicionado

- Ícones próprios (16, 32, 48, 128), `_locales` (pt_BR e en), `homepage_url`.
- Proteções no service worker:
  - valida o remetente e o id;
  - deduplica requisições;
  - cache LRU com TTL, inclusive de erros;
  - backoff em 429/5xx.
- Validação de URLs do JSON (só `https://` em hosts do X).
- Itens de menu acessíveis por teclado; o cabeçalho usa `role="presentation"`.
- ESLint (`no-floating-promises`), Prettier, TS mais estrito, CI no GitHub Actions.
- `PRIVACY.md`, `STORE_LISTING.md`, `LICENSE` (MIT).
- Testes do service worker e da UI (jsdom). O teste de rede foi para `npm run test:network`.

### Removido

- O recurso de copiar a URL do MP4 (botão, item de menu e código).
- O suporte a `mobile.x.com` e `mobile.twitter.com`, que redirecionam.

### Corrigido

- Itens duplicados no menu "..." (condição de corrida).
- Itens injetados em menus que não são do post.
- Requisições repetidas ao syndication em posts apagados ou com citado.
- Rejeições não tratadas quando o contexto da extensão é invalidado.
- `parseStatusHref` aceitava links de outros hosts.

## [1.0.0] - 2026-10-30

- Versão inicial (como "X Media Link").
