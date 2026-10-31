/**
 * TODOS os seletores do DOM do X ficam aqui. Quando o X mudar o HTML, é só este
 * arquivo que você deve precisar editar.
 *
 * Como foram descobertos (DevTools → aba Elements):
 *  1. Clique com o botão direito num post → "Inspecionar". Suba na árvore até achar
 *     o <article data-testid="tweet">: é o container de cada post na timeline.
 *  2. O X usa atributos `data-testid` (feitos para os testes automatizados deles).
 *     Eles são bem mais estáveis que as classes CSS (ex.: "css-175oi2r r-18u37iz"),
 *     que são geradas pelo React Native Web e mudam a cada deploy. Prefira SEMPRE
 *     data-testid / role / href a classes.
 *  3. Fotos: div[data-testid="tweetPhoto"], geralmente dentro de um
 *     <a href="/usuario/status/ID/photo/N">, que já é o próprio link de mídia.
 *  4. Vídeos/GIFs: div[data-testid="videoPlayer"] e/ou [data-testid="videoComponent"]
 *     com um <video> dentro. Não há link /video/N, então o índice vem da ordem.
 *  5. Post citado: dentro do article, um div[role="link"] que contém o mini-post.
 *
 * Como atualizar: abra o DevTools, rode no Console
 *   document.querySelectorAll('article[data-testid="tweet"]').length
 * e vá testando cada seletor abaixo. Se algum retornar 0, inspecione o elemento
 * equivalente e troque o valor aqui.
 */
export const SEL = {
  /** Container de cada post. */
  article: 'article[data-testid="tweet"]',
  /** Qualquer elemento de mídia (foto, vídeo, GIF). Os aninhados são filtrados depois. */
  media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"]',
  /** Indica que a mídia é vídeo/GIF. */
  videoHint: 'video, [data-testid="videoPlayer"], [data-testid="videoComponent"]',
  /** Links que apontam para um post. */
  statusLink: 'a[href*="/status/"]',
  /** Link de foto pronto: /usuario/status/ID/photo/N */
  photoLink: 'a[href*="/photo/"]',
  /** Bloco do post citado dentro do article. */
  quote: 'div[role="link"]',
  /** Nome/usuário do autor (usado como fallback para o @ do post citado). */
  userName: '[data-testid="User-Name"]',
} as const;
