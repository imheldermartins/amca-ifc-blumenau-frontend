/**
 * O access token da sessão — e o ponto inteiro deste arquivo é ONDE ele NÃO
 * mora.
 *
 * Antes o par completo (access 15min + refresh 7 DIAS) vivia em
 * `localStorage`. Qualquer XSS numa tela qualquer lia a chave e saía com uma
 * credencial de uma semana. Agora:
 *
 *   - o REFRESH mora num cookie `HttpOnly` que o JavaScript não enxerga
 *     (ver `cookie.config.ts` no backend);
 *   - o ACCESS mora aqui, numa variável de módulo. Ele morre no reload, e
 *     `AuthService.restore()` o reconstrói trocando o cookie por um novo.
 *
 * Ou seja: não existe credencial persistida ao alcance de script. Um XSS
 * ainda pode agir enquanto a aba está aberta (nenhum desenho impede isso),
 * mas não leva nada consigo.
 *
 * **Não persista isto.** Não é descuido de implementação, é o requisito — e o
 * teste `sessionStore.test.ts` falha de propósito se alguém adicionar
 * `localStorage`/`document.cookie` aqui.
 */
let accessToken: string | null = null

export const sessionStore = {
  get(): string | null {
    return accessToken
  },
  set(token: string): void {
    accessToken = token
  },
  clear(): void {
    accessToken = null
  },
}
