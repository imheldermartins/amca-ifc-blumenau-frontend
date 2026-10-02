import type {
  FlowDefinition,
  FlowExecutionResult,
  FlowMacroOption,
} from 'cubs-database'

import { apiService } from '@/services/ApiService'

interface FlowConfigurationResponse {
  flow: FlowDefinition
}

interface ApiFlowMacro {
  key: string
  label: string
  kind: 'page' | 'workspace' | 'column' | 'person'
  valueType: 'text' | 'number' | 'boolean' | 'date' | 'email' | 'unknown'
  preview?: string | null
}

interface FlowMacrosResponse {
  macros: ApiFlowMacro[]
}

export class FlowService {
  async save(parentId: string, columnId: string, flow: FlowDefinition): Promise<FlowDefinition> {
    const response = await apiService.put<FlowConfigurationResponse>(
      `/pages/parent/${parentId}/columns/${columnId}/flow`,
      { flow },
    )
    return response.flow
  }

  async macros(parentId: string, columnId: string, rowId?: string): Promise<FlowMacroOption[]> {
    const query = rowId ? `?rowId=${encodeURIComponent(rowId)}` : ''
    const response = await apiService.get<FlowMacrosResponse>(
      `/pages/parent/${parentId}/columns/${columnId}/flow/macros${query}`,
    )
    return response.macros.map((macro) => ({
      token: macro.key,
      label: macro.label,
      group: macro.kind === 'person' ? 'people' : macro.kind === 'column' ? 'columns' : macro.kind,
      valueType: macro.valueType,
      ...(macro.preview !== undefined && { preview: macro.preview }),
    }))
  }

  execute(rowId: string, columnId: string): Promise<FlowExecutionResult> {
    return apiService.post<FlowExecutionResult>(
      `/pages/${rowId}/column/${columnId}/flow/execute`,
      {},
    )
  }
}

export const flowService = new FlowService()
