import { apiService } from '@/services/ApiService'

/**
 * Uma página compartilhada COMIGO — sou colaborador (`page_collaborators`),
 * não dono. O dono vem resolvido porque o card precisa dizer de quem é a
 * página.
 */
export interface ApiSharedPage {
  id: string
  title: string | null
  owner_id: string
  owner_name: string | null
  owner_email: string
}

/**
 * Fronteira com o `DatabaseService`: lá é o CONTEÚDO de uma página; aqui é a
 * LISTA das que outras pessoas dividiram comigo — a aba "Colaborando".
 *
 * A gestão do vínculo (adicionar/remover colaborador) mora em
 * `/pages/:id/collaborators` e ainda não tem tela; quando tiver, é aqui que
 * ela entra.
 */
export class SharedPagesService {
  listShared(): Promise<ApiSharedPage[]> {
    return apiService.get<ApiSharedPage[]>('/pages/shared')
  }
}

export const sharedPagesService = new SharedPagesService()
