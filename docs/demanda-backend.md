# Demanda para o backend (e pontos deixados em aberto)

Registro do que as levas de melhoria NÃO resolveram, com o porquê. Cada item é
uma decisão consciente de escopo, não esquecimento.

> **Já resolvido** (não está mais aqui): rollback visual da escrita otimista
> (hoje `useMutation` reverte + marca a célula + `feedback()`); socket derrubado
> no **logout** (o frontend força `disconnect()` + `BroadcastChannel` entre
> abas). O que sobra de cada tema está abaixo.

Ordenado por prioridade aproximada.

## 1. Reautenticação PASSIVA do socket em conexão de vida longa

**Onde:** `cubs-backend/src/core/socket/socket-server.ts` (handshake) ×
`cubs-frontend/src/services/SocketService.ts`.

O socket valida o access token UMA vez, no handshake. O **logout** já derruba a
conexão (frontend). O que resta é a expiração/revogação **passiva**: um access
token que expira durante uma conexão longa, ou uma sessão revogada por fora
(admin, troca de senha) sem passar pelo logout daquela aba, não derruba a
conexão — ela segue viva com o `socket.data.userId` do handshake.

O caminho: o backend revalidar periodicamente (heartbeat) ou no `join`, amarrado
ao `token_version` da revogação. Menor prioridade porque o caso comum (logout)
já está coberto, e uma sessão legítima cujo access só expirou não é risco.

## 3. Rate limit compartilhado entre instâncias

**Onde:** `cubs-backend/src/core/http/rate-limit.config.ts`.

O estado do rate limit é EM MEMÓRIA, por instância. Escalar o backend
horizontalmente divide o limite por N (cada instância conta só o que passa por
ela) — o brute-force de senha ganha N× mais tentativas. Já anotado no próprio
arquivo: trocar por um store compartilhado (Redis), no mesmo momento em que o
socket.io ganhar o adapter de Redis.

## 4. Poda do snapshot ao excluir coluna

**Onde:** `cubs-frontend/src/lib/databaseParser.ts` (snapshot), o futuro
DELETE de coluna.

O snapshot da view cita ids de coluna (`orderedHeaderCols`, `columnWidths`).
Excluir uma coluna deixa referência pendurada. É benigno na leitura
(`reorderByIds` ignora id desconhecido), mas ao implementar a ESCRITA da
exclusão, é preciso PODAR o snapshot em vez de deixar lixo acumular. Já
documentado como "custo aceito" no CLAUDE.md do frontend.

## 5. Ciclo de vida completo de coluna e linha

**Onde:** lib `cubs-database` + rotas de `page-route.ts`.

Nesta leva a coluna ganhou só o **rename sob realtime** (era o que faltava para
o autor ver a própria edição). Continuam de fora, como demanda:

- **criar / excluir coluna** (a exclusão puxa a poda do §4);
- **trocar o TIPO** da coluna — a parte cara: exige decidir o destino dos
  valores já gravados (converter, limpar ou rejeitar);
- **editar options do select** além de reordenar (adicionar, renomear, cor,
  excluir — e o que fazer nas células que apontavam para a option excluída);
- **criar / excluir LINHA** pela UI (o backend já emite `row-created` /
  `row-deleted`, e o front já os trata com reload — falta só o gatilho na UI).

## 6. Revogação de sessão por dispositivo + rotação com detecção de reuso

**Onde:** a revogação atual (`users.token_version`), `auth-controller.refresh`.

Dois pontos que compartilham a mesma peça (uma tabela de `jti`, id por token):

- **Revogação por dispositivo:** o `token_version` é um kill switch por CONTA —
  o logout mata TODOS os refresh de uma vez. Deslogar só UM aparelho (o notebook
  sem o celular) exige rastrear tokens individualmente.
- **Rotação com detecção de reuso (OAuth):** hoje `refresh()` rotaciona o cookie
  mas **não invalida o refresh anterior** (reusa o mesmo `token_version`), então
  uma cópia roubada continua válida e também "desliza" pela janela de 7d se o
  atacante a usar. A detecção de reuso invalidaria o token a cada uso e, se um já
  rotacionado reaparecesse, revogaria a família inteira (sinal de roubo). É a
  proteção real contra refresh vazado, além do logout.

## 7. Teto absoluto de sessão

**Onde:** política de expiração (`jwt-service`, `cookie.config`).

A sessão é **deslizante**: cada refresh empurra a janela de 7d, então uma
sessão com atividade contínua (o interceptor do axios renova a cada 15min) vive
INDEFINIDAMENTE. Não há teto absoluto ("no máximo N dias, depois reloga mesmo
ativo"). Para o Cub's acadêmico provavelmente não é necessário; para postura
mais dura, seria um segundo carimbo no refresh (`iat` original) recusado além
do teto. Decisão de política.

## 8. Limite conhecido do merge de realtime (carimbo otimista)

**Onde:** `cubs-frontend/src/lib/databaseRealtime.ts`, `usePageDatabase.ts`
(o `useMutation` da célula), `components/cells/useExternalDraft.ts`.

A guarda `isFresh` ordena eventos do SERVIDOR entre si; uma escrita otimista
local não tem carimbo. Se o eco da sua edição chegar DEPOIS de você já ter
reeditado a mesma célula, o valor confirmado é o do servidor (a reedição sem
carimbo perde). Com commit no blur a janela é estreita. O `onMutate` do
`useMutation` (Trilha D) já é o lugar natural de registrar a escrita pendente —
o degrau seguinte é usar esse registro para reconciliar o eco, e ele se junta à
migração para cache-por-célula (§9).

## 9. Cache por célula (§6 do doc de arquitetura)

**Onde:** `cubs-frontend/src/hooks/usePageDatabase.ts`.

O estado é UM `ParsedDatabase` por página, não `useQuery` com chave por
`cellId` como o doc previa. A memoização da tabela já matou o custo de RENDER
(editar uma célula redesenha só a linha dela), então isto é escala/dívida, não
bug. É o passo que também destrava o §8. Refactor grande da lib + hook.

---

## Referências

- Arquitetura de realtime: `docs/cubs-database-realtime-arquitetura.md`.
- Contrato de integração e rotas: `cubs-backend/docs/INTEGRACAO.md`.
- Próximos passos do backend: `cubs-backend/NEXT_STEPS.md`.
