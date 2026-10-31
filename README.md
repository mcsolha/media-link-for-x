# Media Link for X

> **Não afiliado, patrocinado ou endossado pela X Corp.** "X" e "Twitter" são marcas da X Corp., usadas aqui só para dizer em qual site a extensão funciona.

Extensão do Chrome (Manifest V3, TypeScript) que traz para o **x.com no desktop** a opção do app mobile **"copiar link da mídia"**:

- Foto: `https://x.com/<usuario>/status/<id>/photo/<n>`
- Vídeo/GIF: `https://x.com/<usuario>/status/<id>/video/<n>`

Cole esse link num post novo e o X embute a mídia.

## Instalação

**Pela Chrome Web Store:** ainda não publicada. Quando estiver, o link vai aparecer aqui.

**Pelo código (modo desenvolvedor):**

```bash
npm ci
npm run build      # gera dist/
```

1. Abra `chrome://extensions`.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta `dist/`.
4. Recarregue a aba do x.com.

Requer Chrome 110 ou mais recente.

## Como usar

Passe o mouse sobre uma mídia de um post:

| Mídia     | Botões      | O que copia                                                            |
| --------- | ----------- | ---------------------------------------------------------------------- |
| Foto      | **🔗 Link** | Link da mídia (`…/photo/N`)                                            |
| Vídeo/GIF | **🔗 Link** | Link do post onde a mídia foi publicada **pela primeira vez** (origem) |

A extensão só adiciona esse botão **🔗 Link**; ela não mexe no menu "..." do post.

Um aviso ("Link da mídia copiado") confirma a cópia.

## Permissões, e por que cada uma existe

| Permissão                                 | Para quê                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content script em `x.com` e `twitter.com` | Mostrar o botão **🔗 Link** nas mídias dos posts. A extensão não roda em nenhum outro site.                                                                                                                                                                       |
| `clipboardWrite`                          | Copiar o link que você escolheu. O `navigator.clipboard` normal já basta na maioria das vezes. A permissão serve para o plano B (`execCommand('copy')`), quando o navegador considera que o clique "expirou" enquanto a extensão esperava a resposta do servidor. |
| Host `cdn.syndication.twimg.com`          | Ler os dados **públicos** de um post (qual é o post de origem de um vídeo/GIF; qual é o post citado). A consulta é feita pelo service worker, sem cookies e sem login.                                                                                            |

## Privacidade

Resumo: nada é coletado e nada passa por servidor do desenvolvedor. Detalhes em [PRIVACY.md](PRIVACY.md).

**Quando acontece uma consulta ao servidor do X?** Só por ação sua:

- quando você **clica** em "🔗 Link" de um vídeo/GIF ou em "Copiar link da origem";
- quando você clica em "🔗 Link" numa mídia de post citado que não tem link no HTML;
- quando você **para o mouse** (~0,3 s) sobre um vídeo/GIF ou uma mídia de post citado, para adiantar a resposta e a cópia funcionar ainda dentro do clique.

Rolar a timeline não dispara nada. Não há requisições em lote nem em segundo plano. O link de foto e o link de vídeo/GIF de um post normal saem só do HTML da página, sem rede.

## Aviso importante: endpoint não oficial

`cdn.syndication.twimg.com/tweet-result` é o endpoint usado pelos _embeds_ de posts. Ele **não é uma API oficial nem documentada**: pode mudar ou parar de funcionar a qualquer momento. Se isso acontecer, só o link da origem de vídeos/GIFs (e o link de mídia de citados sem link) deixa de funcionar; o **🔗 Link** de fotos continua funcionando, porque saem do HTML da página. A extensão faz cache das respostas (inclusive dos erros) e espera um minuto se o servidor responder 429/5xx.

## Como funciona

| Arquivo                           | Papel                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/selectors.ts`                | **Todos** os seletores de DOM, comentados. É o único lugar a mexer quando o X mudar o HTML.                              |
| `src/core.ts`                     | Lógica pura: token, URLs, validação de URL, parse do JSON, extração de usuário/id/índice.                                |
| `src/ui.ts`                       | Botão no hover, toast, observer. Recebe as dependências por parâmetro (testável no jsdom).                               |
| `src/content.ts`                  | Liga a `ui.ts` ao Chrome (`sendMessage`, clipboard, MutationObserver).                                                   |
| `src/sw.ts` / `src/background.ts` | Service worker: valida a mensagem, consulta o syndication com deduplicação, cache LRU com TTL, cache de erros e backoff. |
| `src/messages.ts`                 | Formato e validação das mensagens.                                                                                       |

Fluxo:

1. O X é uma SPA com scroll virtualizado. Um `MutationObserver` olha **só os nós adicionados**, acha os `article[data-testid="tweet"]` novos e põe os botões. As inserções da própria extensão são ignoradas.
2. Se a foto está dentro de `<a href="/u/status/ID/photo/N">`, o próprio X já deu a resposta.
3. Senão (vídeos/GIFs não têm esse link), a extensão usa o permalink do post (o `<a>` que contém o `<time>`) e o índice pela **ordem** da mídia no post.
4. Mídias dentro do bloco citado (`div[role="link"]`) pertencem ao post citado. Se o citado não tiver link no HTML, o id vem de `quoted_tweet.id_str` no JSON do post principal, consultado só no clique ou no hover.

## Engenharia reversa: o passo a passo

1. **Elements:** inspecione um post. Classes como `css-175oi2r` são geradas e instáveis. Os `data-testid` (`tweet`, `tweetPhoto`, `videoPlayer`, `User-Name`) são feitos para os testes do próprio X e mudam bem menos. Note que fotos vêm embrulhadas em `<a href=".../photo/N">`.
2. **Network:** abra uma página com um post embutido (embed), filtre por `tweet-result` e você vai achar `https://cdn.syndication.twimg.com/tweet-result?id=...&lang=en&token=...`. É público e não usa login.
3. **Token:** procurando `token` no JS do widget de embed (Sources → Ctrl+Shift+F), aparece a fórmula:
   ```js
   ((id / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
   ```
   IDs de 19 dígitos perdem precisão em `Number`, mas o widget faz igual. Hoje o endpoint aceita até token errado; mandamos o certo por segurança.
4. **JSON:** `mediaDetails[n].expanded_url` aponta para o post **original** da mídia. Por exemplo, para `id=1696580817642729897`, ele aponta para `https://x.com/saintpsblo/status/1696576087193481500/photo/1`; repare que é `/photo/` mesmo para GIF. A extensão só aceita URLs `https://` de hosts do X; qualquer outra coisa é descartada.

## Desenvolvimento

```bash
npm run typecheck     # tsc (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
npm run lint          # ESLint (no-floating-promises) + Prettier --check
npm test              # vitest, sem rede (fixtures HTML e JSON gravado)
npm run test:network  # 1 teste contra o endpoint real (precisa de internet)
npm run build         # dist/
npm run zip           # media-link-for-x-store.zip (manifest na raiz) e media-link-for-x-src.zip
```

O CI (`.github/workflows/ci.yml`) roda typecheck, lint, testes e build a cada push ou PR. A versão do manifest vem do `package.json`. Os ícones são gerados por `scripts/make-icons.py` (arte própria: uma corrente de dois elos). Mudanças ficam registradas no [CHANGELOG.md](CHANGELOG.md).

Contribuições: abra uma issue ou um PR em https://github.com/mcsolha/media-link-for-x.

## Limitações

- **O DOM do X muda.** Se os botões sumirem, atualize `src/selectors.ts` (as instruções estão lá dentro).
- **Não foi testado no x.com logado.** Os testes usam fixtures HTML que _imitam_ a estrutura real. O comportamento real (hover, cópia) só se confirma carregando a extensão.
- **GIFs da busca de GIFs do X** (o botão GIF ao escrever um post) não têm post de origem: o `expanded_url` aponta para o próprio post.
- **Posts apagados, privados ou com restrição de idade:** o syndication devolve erro, e um aviso de erro aparece.
- Nenhuma credencial ou API autenticada do X é usada (`credentials: 'omit'`).

## Licença

[MIT](LICENSE) © Matheus Coelho Solha
