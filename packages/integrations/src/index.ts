/**
 * @las/integrations
 *
 * Third-party integrations for Legend-App State utilities
 */

// TanStack Query integration
export { QueryClientProvider } from './tanstack-query/QueryClientProvider'
export { useQueryClient } from './tanstack-query/useQueryClient'
export { useQuery } from './tanstack-query/useQuery'
export { useMutation } from './tanstack-query/useMutation'

export type {
  UseQueryOptions,
  QueryState,
} from './tanstack-query/useQuery'

export type {
  UseMutationOptions,
  MutationState,
} from './tanstack-query/useMutation'
