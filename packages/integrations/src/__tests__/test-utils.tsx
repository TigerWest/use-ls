import React from 'react'
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { QueryClientProvider } from '../tanstack-query/QueryClientProvider'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    queryCache: new QueryCache({
      onError: () => {
        // Suppress unhandled promise rejections in tests
      },
    }),
    mutationCache: new MutationCache({
      onError: () => {
        // Suppress unhandled promise rejections in tests
        // Mutations that throw errors will still update state correctly
        // This prevents test runners from reporting unhandled rejections
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
        onError: () => {
          // Global mutation error handler to catch all mutation errors
          // This prevents unhandled rejections in tests
        },
      },
    },
  })
}

export function createWrapper() {
  const queryClient = createTestQueryClient()

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  return { wrapper: Wrapper, queryClient }
}
