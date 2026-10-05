import type { CatalogIcon, ColumnMask, CurrencyCode, NumberFormat } from 'cubs-database'

import { apiService } from '@/services/ApiService'

export interface PublicFormField {
  readOnly?: boolean
  key: string
  label: string
  type: 'text' | 'numeric' | 'select' | 'date' | 'checkbox'
  mask?: ColumnMask
  format?: NumberFormat
  currency?: CurrencyCode
  options?: Array<{ key: string; label: string; color?: string }>
}

export interface PublicFormDefinition {
  version: 1
  publicationId: string
  title: string | null
  name: string
  submitButton: { label: string; icon: CatalogIcon | null }
  fields: PublicFormField[]
}

export interface FormPublicationStatus {
  publicationId: string
  published: boolean
  revokedAt: string | null
  expiresAt: string | null
  fillKeyHint: string
  reviewKeyHint: string
}

export interface FormPublicationSecrets extends FormPublicationStatus {
  fillKey: string
  reviewKey: string
}

export interface FormSubmissionResult {
  submissionId: string
  submittedAt: string
  callback: string | null
}

export interface PublicFormReviewPage {
  version: 1
  publicationId: string
  form: Pick<PublicFormDefinition, 'title' | 'name' | 'fields'>
  submissions: Array<{
    submissionId: string
    submittedAt: string
    answers: Array<{ key: string; value: unknown }>
    flow: { status: 'succeeded'; callback: string | null }
  }>
  nextCursor: string | null
}

const capabilityHeaders = (capability: string, requestId?: string) => ({
  'X-Cubs-Form-Capability': capability,
  ...(requestId && { 'Idempotency-Key': requestId }),
})

export class FormService {
  status(pageId: string, viewId: string): Promise<FormPublicationStatus | null> {
    return apiService.get(`/pages/${pageId}/views/${viewId}/form/publication`)
  }

  publish(pageId: string, viewId: string): Promise<FormPublicationSecrets> {
    return apiService.post(`/pages/${pageId}/views/${viewId}/form/publication`, {})
  }

  revoke(pageId: string, viewId: string): Promise<void> {
    return apiService.delete(`/pages/${pageId}/views/${viewId}/form/publication`)
  }

  submitPreview(
    pageId: string,
    viewId: string,
    requestId: string,
    fields: Array<{ key: string; value: unknown }>,
  ): Promise<FormSubmissionResult> {
    return apiService.post(
      `/pages/${pageId}/views/${viewId}/form/submissions`,
      { fields },
      { headers: { 'Idempotency-Key': requestId } },
    )
  }

  definition(publicationId: string, capability: string): Promise<PublicFormDefinition> {
    return apiService.getPublic(`/forms/publications/${publicationId}`, {
      headers: capabilityHeaders(capability),
    })
  }

  submit(
    publicationId: string,
    capability: string,
    requestId: string,
    fields: Array<{ key: string; value: unknown }>,
  ): Promise<FormSubmissionResult> {
    return apiService.postPublic(
      `/forms/publications/${publicationId}/submissions`,
      { fields },
      { headers: capabilityHeaders(capability, requestId) },
    )
  }

  review(
    publicationId: string,
    capability: string,
    cursor?: string,
  ): Promise<PublicFormReviewPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return apiService.getPublic(`/forms/publications/${publicationId}/submissions${query}`, {
      headers: capabilityHeaders(capability),
    })
  }
}

export const formService = new FormService()
