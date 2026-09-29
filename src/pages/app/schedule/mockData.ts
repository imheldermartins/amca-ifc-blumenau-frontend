import dayjs from 'dayjs'
import type { OptionColor } from 'cubs-components'
import type { ScheduleItem } from './types'
export type { ScheduleItem, ScheduleItemTypes, ScheduleProperty } from './types'

export function scheduleItemColor(item: ScheduleItem, propertyId?: string): OptionColor {
  if (item.type !== 'page') return item.color ?? 'purple'
  const selectProperties = item.data.properties.filter((property) => property.type === 'select')
  const selected = selectProperties.find((property) => property.id === propertyId) ?? selectProperties[0]
  return selected?.color ?? 'purple'
}

/** Visual fixtures only. Pins and items never reach storage or the API. */
export function createScheduleMock(today = dayjs().format('YYYY-MM-DD')): ScheduleItem[] {
  const month = dayjs(today).startOf('month')
  const stamp = (day: number, time?: string) => `${month.add(day - 1, 'day').format('YYYY-MM-DD')}${time ? `T${time}:00.000Z` : ''}`
  const focus = dayjs(today).date()
  const statuses: Partial<Record<OptionColor, string>> = { purple: 'Planejado', blue: 'Em andamento', pink: 'Aguardando', green: 'Concluído', orange: 'Em revisão' }
  const page = (id: string, title: string, day: number, color: OptionColor, endDay?: number, time?: string, endTime?: string): ScheduleItem => ({
    id, type: 'page', title,
    start: stamp(day, time), end: stamp(endDay ?? day, endTime ?? time), allDay: !time,
    color,
    data: { page: { id, title }, sourcePageId: 'preview-database', sourceTitle: 'Base de exemplo', dateColumnId: 'date', colorColumnId: '01K6A1B2C3D4E5F6G7H8J9K0MN', properties: [
      { id: 'project', label: 'Projeto', value: 'Cub’s' },
      { id: 'owner', label: 'Responsável', value: id.endsWith('1') ? 'Marina' : 'Rafael' },
      { id: '01K6A1B2C3D4E5F6G7H8J9K0MN', type: 'select', label: 'Status', value: statuses[color], color },
      { id: '01K6N1M2P3Q4R5S6T7V8W9X0YZ', type: 'select', label: 'Prioridade', value: color === 'green' ? 'Baixa' : 'Alta', color: color === 'green' ? 'green' : 'orange' },
    ] },
  })
  return [
    page('page-1', 'Planejamento do produto', 2, 'purple', 5),
    page('page-2', 'Pesquisa e referências', 7, 'blue', 11),
    page('page-3', 'Revisão de interface', 9, 'pink', 9, '14:00', '15:30'),
    page('page-4', 'Sprint de criação', 13, 'purple', 20),
    page('page-5', 'Alinhamento com o time', 16, 'green', 16, '09:00', '10:00'),
    page('page-6', 'Entregar primeira versão', 22, 'orange', 24),
    page('page-7', 'Design do calendário', focus, 'purple', focus, '09:00', '11:00'),
    page('page-8', 'Revisão de componentes', focus, 'blue', focus, '10:00', '11:30'),
    { ...page('page-9', 'Preparar lançamento', focus + 1, 'green', focus + 5), children: [
      page('page-10', 'Checklist de qualidade', focus + 2, 'orange', focus + 2, '14:00', '15:00'),
    ] },
    page('page-11', 'Documentação', focus + 2, 'pink', focus + 2, '09:30', '11:00'),
    page('page-12', 'Fechamento do mês', month.daysInMonth() - 1, 'blue', month.daysInMonth() + 3),
    { id: 'external-focus', type: 'item', title: 'Tempo de foco',
      start: stamp(focus, '13:00'), end: stamp(focus, '15:00'),
      data: { properties: [{ id: 'source', label: 'Origem', value: 'Agenda pessoal' }] } },
    { id: 'external-chart', type: 'chart', title: 'Acompanhar resultados',
      start: stamp(focus + 1, '11:00'), end: stamp(focus + 1, '12:30'),
      data: { source: 'Indicadores', values: [25, 45, 38, 62, 48, 80, 72, 94] } },
  ]
}
