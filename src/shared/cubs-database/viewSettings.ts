import type { DataViewKind } from './types'

export interface ViewMockSettings {
  tileSize: 'small' | 'medium' | 'large'
  loadSubItems: boolean
}

export const DEFAULT_VIEW_MOCK_SETTINGS: ViewMockSettings = {
  tileSize: 'medium',
  loadSubItems: false,
}

export type FormField = {
  key: keyof ViewMockSettings
  control: 'select' | 'switch'
  label: string
  options?: { value: string; label: string }[]
}

/** Campos adicionais por tipo; o formulário da drawer lê este mapa. */
export const mappedForm: Record<DataViewKind, FormField[]> = {
  table: [],
  grid: [{
    key: 'tileSize',
    control: 'select',
    label: 'Tamanho dos cards',
    options: [
      { value: 'small', label: 'Pequeno' },
      { value: 'medium', label: 'Médio' },
      { value: 'large', label: 'Grande' },
    ],
  }],
  board: [],
  calendar: [],
  timeline: [],
  graph: [{ key: 'loadSubItems', control: 'switch', label: 'Carregar subitens' }],
}
