import { createContext, ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'

/**
 * React Context for QueryClient
 */
export const QueryClientContext = createContext<QueryClient | undefined>(undefined)

export interface QueryClientProviderProps {
  client: QueryClient
  children: ReactNode
}

/**
 * Provider component that makes QueryClient available to hooks
 *
 * @example
 * ```tsx
 * import { QueryClient } from '@tanstack/react-query'
 * import { QueryClientProvider } from '@las/integrations'
 *
 * const queryClient = new QueryClient()
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <YourApp />
 *     </QueryClientProvider>
 *   )
 * }
 * ```
 */
export function QueryClientProvider({ client, children }: QueryClientProviderProps) {
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  )
}
