import { apiService } from '@/services/ApiService'
import type { UserIdentity } from '@/types/user'

/** Usuário ligado à página por `page_collaborators`. */
export type ApiPageCollaborator = UserIdentity

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
 * A leitura dos vínculos alimenta o cabeçalho e a aba de colaboradores das
 * configurações da página. Adicionar/remover continua sendo uma operação da
 * mesma rota, ainda sem controles de mutação nesta interface.
 */
export class SharedPagesService {
  listShared(): Promise<ApiSharedPage[]> {
    return apiService.get<ApiSharedPage[]>('/pages/shared')
  }

  /**
   * Lista somente os vínculos da página. O owner/usuário atual não é
   * inserido pela API; o `PageShell` compõe a audiência explicitamente.
   */
  listCollaborators(pageId: string): Promise<ApiPageCollaborator[]> {
    return apiService.get<ApiPageCollaborator[]>(`/pages/${pageId}/collaborators`)
  }
}

export const sharedPagesService = new SharedPagesService()
