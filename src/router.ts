import { createRouter } from '@tanstack/react-router'

import { parseQuerySearch, stringifyQuerySearch } from '@/lib/queryParams'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  parseSearch: parseQuerySearch,
  stringifySearch: stringifyQuerySearch,
  context: {
    auth: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
