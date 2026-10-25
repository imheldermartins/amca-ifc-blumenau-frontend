import { apiService } from './ApiService'

export interface FavoritePage {
  pageId: string
  title: string | null
  createdAt: string
  workspaceId: string | null
  workspaceName: string | null
}
export interface FavoritePageList { items: FavoritePage[]; nextCursor: string | null; total: number }
export interface PageFavoriteState { pageId: string; favorite: boolean }
export const pageFavoriteService = {
  list(cursor?: string | null): Promise<FavoritePageList> {
    const query = new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) })
    return apiService.get(`/favorites/pages?${query}`)
  },
  state(pageId: string): Promise<PageFavoriteState> { return apiService.get(`/favorites/pages/${pageId}`) },
  set(pageId: string, favorite: boolean): Promise<PageFavoriteState> {
    return favorite ? apiService.put(`/favorites/pages/${pageId}`, {}) : apiService.delete(`/favorites/pages/${pageId}`)
  },
}
