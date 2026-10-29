import { createRouter } from '@tanstack/react-router'

import { parseQuerySearch, stringifyQuerySearch } from '@/lib/queryParams'
import { routeTree } from './routeTree.gen'
import { RouteError } from '@/components/RouteError'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: RouteError,
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
