import {useCallback} from 'react'
import {useModal} from './useModal'
import {CalendarPageModalContent} from '@/components/CalendarPageModal'
import type {CalendarPageRequest} from '@/services/CalendarPageService'

export function useCalendarPageModal() {
  const {openModal} = useModal()
  return useCallback((request: CalendarPageRequest) => openModal({size: 'lg', content: controls => <CalendarPageModalContent request={request} controls={controls} />}), [openModal])
}
