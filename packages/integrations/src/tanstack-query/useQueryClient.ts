import { useContext } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { QueryClientContext } from './QueryClientProvider'

/**
 * Hook to retrieve the QueryClient from context
 *
 * @throws Error if used outside of QueryClientProvider
 *
 * @example
 * ```tsx
 * import { useQueryClient } from '@las/integrations'
 *
 * function MyComponent() {
 *   const queryClient = useQueryClient()
 *   // Use queryClient...
 * }
 * ```
 */
export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext)

  if (!client) {
    throw new Error(
      'useQueryClient must be used within a QueryClientProvider. ' +
      'Make sure your component tree is wrapped with <QueryClientProvider client={queryClient}>.'
    )
  }

  return client
}
