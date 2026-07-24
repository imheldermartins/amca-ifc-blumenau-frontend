/**
 * Anti-flash de tema: aplica o tema salvo no <html> ANTES do React montar,
 * senão a página pisca no tema errado por um frame.
 *
 * Mora num ARQUIVO e não inline no index.html por causa da CSP de produção
 * (`script-src 'self'`, ver nginx/nginx.conf): script inline exigiria um hash
 * sha256 que muda a cada edição — e uma CSP que quebra em silêncio é pior que
 * uma CSP frouxa. Como arquivo servido pela própria origem, ele é 'self'.
 *
 * Carregado SEM `defer`/`async` no <head>: precisa bloquear a renderização,
 * que é o ponto inteiro de existir.
 *
 * A chave é espelhada NA MÃO de `src/lib/clientStorage.ts` (namespace `cubs.`)
 * porque este arquivo roda antes de qualquer módulo — não dá para importar o
 * util. Mudou o namespace ou a chave lá, mude aqui. Mesmo pacto que o
 * `nginx.conf` tem com `API_BASE_PATH`.
 */
;(function () {
  try {
    var theme = localStorage.getItem('cubs.theme')
    // O clientStorage grava string JSON ("\"dark\""); toleramos os dois
    // formatos para não depender da ordem em que a migração aconteceu.
    if (theme && theme.charAt(0) === '"') theme = JSON.parse(theme)
    if (theme !== 'light' && theme !== 'dark') {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.classList.toggle('dark', theme === 'dark')
  } catch {
    // localStorage indisponível (modo privativo/quota): segue no tema claro.
  }
})()
