import { apiService } from './ApiService';
import type { RecursiveColumn, RecursiveRelation } from '@/shared/recursive-template';
export interface PdfCatalog { children: { id: string; title: string | null }[]; columns: RecursiveColumn[]; relations: RecursiveRelation[] }
export const pagePdfService = {
  catalog: (pageId: string) => apiService.get<PdfCatalog>(`/pages/${pageId}/pdf/catalog`),
  async generate(pageId: string, childIds?: string[], options: { includePageTitle?: boolean } = {}) {
    return apiService.postBinary(`/pages/${pageId}/pdf`, { ...(childIds && { childIds }), ...options });
  },
};
