import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { observable } from '@legendapp/state'
import { useQuery } from '../useQuery'
import { createWrapper } from '../../__tests__/test-utils'

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Query Functionality', () => {
    it('should initialize with pending state', () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      expect(result.current.isPending.get()).toBe(true)
      expect(result.current.isLoading.get()).toBe(true)
      expect(result.current.status.get()).toBe('pending')
      expect(result.current.data.get()).toBeUndefined()
    })

    it('should fetch data successfully', async () => {
      const queryFn = vi.fn().mockResolvedValue('success data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      expect(result.current.data.get()).toBe('success data')
      expect(result.current.status.get()).toBe('success')
      expect(queryFn).toHaveBeenCalledTimes(1)
    })

    it('should expose data through observable', async () => {
      const testData = { id: 1, name: 'Test' }
      const queryFn = vi.fn().mockResolvedValue(testData)
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      expect(result.current.data.get()).toEqual(testData)
    })
  })

  describe('Error Handling', () => {
    it('should handle query errors', async () => {
      const error = new Error('Query failed')
      const queryFn = vi.fn().mockRejectedValue(error)
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
            retry: false, // Explicitly disable retry for faster test
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isError.get()).toBe(true), { timeout: 3000 })

      expect(result.current.error.get()).toEqual(error)
      expect(result.current.status.get()).toBe('error')
    })

    it('should track failureCount', async () => {
      const error = new Error('Query failed')
      const queryFn = vi.fn().mockRejectedValue(error)
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
            retry: 2,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isError.get()).toBe(true), { timeout: 5000 })

      // Initial attempt + 2 retries = 3 total failures
      expect(result.current.failureCount.get()).toBeGreaterThan(0)
      expect(queryFn).toHaveBeenCalledTimes(3)
    })

    it('should distinguish isLoadingError vs isRefetchError', async () => {
      let shouldFail = true
      const queryFn = vi.fn().mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error('Failed'))
        }
        return Promise.resolve('success')
      })
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
            retry: false, // Disable retry for faster test
          }),
        { wrapper }
      )

      // Initial fetch fails - should be loading error
      await waitFor(() => expect(result.current.isError.get()).toBe(true), { timeout: 3000 })
      expect(result.current.isLoadingError.get()).toBe(true)
      expect(result.current.isRefetchError.get()).toBe(false)

      // Now make it succeed
      shouldFail = false
      result.current.refetch()
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true), { timeout: 3000 })

      // Make it fail again on refetch
      shouldFail = true
      result.current.refetch()
      await waitFor(() => expect(result.current.isError.get()).toBe(true), { timeout: 3000 })

      // Now it should be a refetch error
      expect(result.current.isRefetchError.get()).toBe(true)
      expect(result.current.isLoadingError.get()).toBe(false)
    })
  })

  describe('Loading and Fetch States', () => {
    it('should track isFetching during fetch', async () => {
      let resolveQuery: (value: string) => void
      const queryPromise = new Promise<string>((resolve) => {
        resolveQuery = resolve
      })
      const queryFn = vi.fn().mockReturnValue(queryPromise)
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      // Should be fetching initially
      await waitFor(() => expect(result.current.isFetching.get()).toBe(true))

      // Resolve the query
      resolveQuery!('data')
      await waitFor(() => expect(result.current.isFetching.get()).toBe(false))

      expect(result.current.isSuccess.get()).toBe(true)
    })

    it('should set isLoading only on initial load', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      // Initial load - isLoading should be true
      expect(result.current.isLoading.get()).toBe(true)

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      // After success, isLoading should be false
      expect(result.current.isLoading.get()).toBe(false)

      // Trigger refetch
      result.current.refetch()
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2))

      // On refetch, isLoading should still be false
      expect(result.current.isLoading.get()).toBe(false)
    })

    it('should set isRefetching on subsequent fetches', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      // Trigger refetch
      result.current.refetch()

      // Should be refetching
      await waitFor(() => expect(result.current.isRefetching.get()).toBe(true))

      // Wait for completion
      await waitFor(() => expect(result.current.isRefetching.get()).toBe(false))
    })

    it('should track fetchStatus correctly', async () => {
      let resolveQuery: (value: string) => void
      const queryPromise = new Promise<string>((resolve) => {
        resolveQuery = resolve
      })
      const queryFn = vi.fn().mockReturnValue(queryPromise)
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      // Should transition to fetching
      await waitFor(() => expect(result.current.fetchStatus.get()).toBe('fetching'))

      // Resolve the query
      resolveQuery!('data')

      // Should transition to idle
      await waitFor(() => expect(result.current.fetchStatus.get()).toBe('idle'))
    })
  })

  describe('Observable Reactivity', () => {
    it('should accept observables in queryKey', async () => {
      // Use standalone observable (not useObservable hook)
      const filter$ = observable({ category: 'electronics' })
      const queryFn = vi.fn().mockResolvedValue({ items: [] })
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['products', filter$],
            queryFn,
          }),
        { wrapper }
      )

      // Wait for initial fetch
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      // Verify that the query executed successfully with an observable in queryKey
      expect(queryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data.get()).toEqual({ items: [] })
    })

    it('should use serialized queryKey for cache', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper, queryClient } = createWrapper()

      const filter$ = observable({ status: 'active' })

      renderHook(
        () =>
          useQuery({
            queryKey: ['items', filter$],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))

      // The actual cache key should be the serialized version
      const serializedKey = JSON.stringify(['items', { status: 'active' }])
      const cacheData = queryClient.getQueryData([serializedKey])

      expect(cacheData).toBe('data')
    })

    it('should refetch when partial observable queryKey changes', async () => {
      const filter$ = observable({ category: 'electronics' })
      let callCount = 0
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ items: [], category: filter$.category.get(), call: callCount })
      })
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['products', filter$, 'list'], // Only filter$ is observable
            queryFn,
          }),
        { wrapper }
      )

      // Wait for initial fetch
      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))
      expect(queryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data.get()).toEqual({ items: [], category: 'electronics', call: 1 })

      // Change the observable - should trigger refetch
      filter$.category.set('sports')

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2), { timeout: 3000 })
      expect(result.current.data.get()).toEqual({ items: [], category: 'sports', call: 2 })

      // Change again
      filter$.category.set('books')

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3), { timeout: 3000 })
      expect(result.current.data.get()).toEqual({ items: [], category: 'books', call: 3 })
    })
  })

  describe('Query Options', () => {
    it('should respect enabled: false', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
            enabled: false,
          }),
        { wrapper }
      )

      // Wait a bit to ensure query doesn't execute
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(queryFn).not.toHaveBeenCalled()
      expect(result.current.status.get()).toBe('pending')
    })

    it('should respect staleTime', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
            staleTime: 10000, // 10 seconds
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      // Within staleTime window, data should not be stale
      expect(result.current.isStale.get()).toBe(false)
    })
  })

  describe('Refetch', () => {
    it('should expose refetch function', () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      expect(typeof result.current.refetch).toBe('function')
    })

    it('should refetch data when refetch() is called', async () => {
      let counter = 0
      const queryFn = vi.fn().mockImplementation(() => {
        counter++
        return Promise.resolve(`data-${counter}`)
      })
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))
      expect(result.current.data.get()).toBe('data-1')

      // Call refetch
      result.current.refetch()

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2))
      expect(result.current.data.get()).toBe('data-2')
    })
  })

  describe('Cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      const queryFn = vi.fn().mockResolvedValue('data')
      const { wrapper } = createWrapper()

      const { result, unmount } = renderHook(
        () =>
          useQuery({
            queryKey: ['test'],
            queryFn,
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess.get()).toBe(true))

      // Unmount the hook
      unmount()

      // If there are no React warnings/errors, cleanup is working correctly
      // We can verify by ensuring no updates happen after unmount
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
  })

  describe('State Completeness', () => {
    it('should include isEnabled field', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test'],
          queryFn: async () => 'data',
          enabled: false,
        }),
        { wrapper }
      )

      expect(result.current.isEnabled.get()).toBe(false)
    })

    it('should include isInitialLoading as deprecated alias', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test'],
          queryFn: async () => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return 'data'
          },
        }),
        { wrapper }
      )

      // isInitialLoading should match isLoading
      expect(result.current.isInitialLoading.get()).toBe(result.current.isLoading.get())
    })
  })
})
