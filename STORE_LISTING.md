# Rascunho para o painel da Chrome Web Store

> Rascunho, ainda não enviado. Revise antes de colar no painel do desenvolvedor.

## Nome

**Media Link for X**

## Descrição curta (até 132 caracteres)

- **pt-BR:** Copie o link da mídia (foto, vídeo ou GIF) de posts no x.com, como no app. Não afiliado à X Corp.
- **en:** Copy the media link (photo, video or GIF) of posts on x.com, like the mobile app. Not affiliated with X Corp.

## Descrição longa

### pt-BR

O app do X no celular tem a opção "copiar link da mídia"; o site no computador, não. O Media Link for X traz essa opção para o x.com.

- Passe o mouse sobre uma foto, vídeo ou GIF e clique em **🔗 Link** para copiar o link da mídia (…/photo/N). Colado num post novo, o link embute a mídia.
- Em vídeos e GIFs, **🔗 Link** copia o link do post onde a mídia foi publicada pela primeira vez.
- A extensão só adiciona esse botão; o menu "..." do X fica como está.

Privacidade: a extensão não coleta, não armazena e não compartilha dados. Ela só consulta dados públicos do post no próprio servidor do X (cdn.syndication.twimg.com), e só quando você clica ou para o mouse sobre uma mídia. Não há análise de uso, anúncios nem rastreamento.

Aviso: a consulta do link de origem usa um endpoint público, mas não oficial, do X, que pode mudar sem aviso. Código aberto (MIT): https://github.com/mcsolha/media-link-for-x

Não afiliado, patrocinado ou endossado pela X Corp.

### en

The X mobile app has a "copy media link" option; the desktop site doesn't. Media Link for X brings it to x.com.

- Hover a photo, video or GIF and click **🔗 Link** to copy the media link (…/photo/N). Pasted into a new post, the link embeds the media.
- For videos and GIFs, **🔗 Link** copies the link of the post where the media was first published.
- The extension only adds this button; X's "..." menu is left untouched.

Privacy: the extension does not collect, store or share any data. It only queries public post data on X's own server (cdn.syndication.twimg.com), and only when you click or hover over a media item. No analytics, ads or tracking.

Note: the "origin" lookup relies on a public but unofficial X endpoint that may change without notice. Open source (MIT): https://github.com/mcsolha/media-link-for-x

Not affiliated with, sponsored or endorsed by X Corp.

## Propósito único (single purpose)

- **pt-BR:** Copiar links de mídia (fotos, vídeos e GIFs) de posts no x.com.
- **en:** Copy media links (photos, videos and GIFs) of posts on x.com.

## Justificativa das permissões

| Permissão                                                      | Justificativa (en, para colar no painel)                                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clipboardWrite`                                               | Used only to copy the media link the user explicitly chose to the clipboard. It enables the fallback copy method when the user gesture expires while waiting for the post data.                                                         |
| Host `https://cdn.syndication.twimg.com/*`                     | Used to read public metadata of a post (the original post of a video/GIF and the quoted post ID). Requested only when the user clicks or hovers over a media item, without cookies. It is called from the service worker to avoid CORS. |
| Content scripts em `https://x.com/*` e `https://twitter.com/*` | Needed to add the "🔗 Link" button to media in posts. The extension runs on no other site.                                                                                                                                              |

**Remote code:** No. All code is bundled in the package; no `eval` and no remote scripts.

## Declaração de uso de dados (Privacy practices)

Para cada categoria, a resposta é **"Não coleta"**:

- Informações de identificação pessoal: não.
- Informações de saúde: não.
- Informações financeiras e de pagamento: não.
- Informações de autenticação: não.
- Comunicações pessoais: não.
- Localização: não.
- Histórico da web: não.
- Atividade do usuário: não.
- Conteúdo de sites: não. A extensão lê o HTML do post na hora, no próprio navegador, para montar o link, e não envia nem guarda esse conteúdo. O único dado enviado é o número público do post, e só para o servidor do próprio X.

**URL da política de privacidade:** https://github.com/mcsolha/media-link-for-x/blob/main/PRIVACY.md

## Certificações (marcar as três)

- [x] Não vendo nem transfiro dados de usuários a terceiros, fora dos casos de uso aprovados.
- [x] Não uso nem transfiro dados de usuários para fins não relacionados ao propósito único do item.
- [x] Não uso nem transfiro dados de usuários para determinar crédito ou para fins de empréstimo.

## Assets

Ficam na pasta `store/`:

- Ícone 128×128: `store/icon-128.png` (cópia de `public/icons/icon128.png`).
- Screenshot 1280×800: `store/screenshot-1-1280x800.png`, com o autor do post borrado.
- Imagem promocional pequena 440×280: `store/promo-small-440x280.png`.
