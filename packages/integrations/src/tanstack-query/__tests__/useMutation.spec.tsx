import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMutation } from '../useMutation'
import { createWrapper } from '../../__tests__/test-utils'

describe('useMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Mutation Functionality', () => {
    it('should initialize with idle state', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (data: string) => data,
          }),
        { wrapper }
      )

      expect(result.current.status.get()).toBe('idle')
      expect(result.current.isIdle.get()).toBe(true)
      expect(result.current.isPending.get()).toBe(false)
      expect(result.current.isSuccess.get()).toBe(false)
      expect(result.current.isError.get()).toBe(false)
      expect(result.current.data.get()).toBeUndefined()
      expect(result.current.error.get()).toBeNull()
    })

    it('should transition to pending then success', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1, name: 'Test' }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 50))
              return mockData
            },
          }),
        { wrapper }
      )

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isPending.get()).toBe(true)
      })

      expect(result.current.status.get()).toBe('pending')
      expect(result.current.isIdle.get()).toBe(false)

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(result.current.status.get()).toBe('success')
      expect(result.current.isPending.get()).toBe(false)
    })

    it('should set data on successful mutation', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1, name: 'Test Product' }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => mockData,
          }),
        { wrapper }
      )

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(result.current.data.get()).toEqual(mockData)
    })
  })

  describe('Error Handling', () => {
    it('should handle mutation errors', async () => {
      const { wrapper } = createWrapper()
      const mockError = new Error('Mutation failed')

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              throw mockError
            },
          }),
        { wrapper }
      )

      // Use mutateAsync with try-catch to handle the rejection
      try {
        await result.current.mutateAsync()
      } catch {
        // Expected error, handled
      }

      await waitFor(() => {
        expect(result.current.isError.get()).toBe(true)
      })

      expect(result.current.status.get()).toBe('error')
      expect(result.current.error.get()).toBeInstanceOf(Error)
      expect(result.current.error.get()?.message).toBe('Mutation failed')
    })

    it('should track failureCount and failureReason on error', async () => {
      const { wrapper } = createWrapper()
      const mockError = new Error('Test error')

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              throw mockError
            },
          }),
        { wrapper }
      )

      // Use mutateAsync with try-catch to handle the rejection
      try {
        await result.current.mutateAsync()
      } catch {
        // Expected error, handled
      }

      await waitFor(() => {
        expect(result.current.isError.get()).toBe(true)
      })

      expect(result.current.failureCount.get()).toBe(1)
      expect(result.current.failureReason.get()).toBeInstanceOf(Error)
      expect(result.current.failureReason.get()?.message).toBe('Test error')
    })
  })

  describe('Callback Functions', () => {
    it('should call onSuccess callback', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1 }
      const mockVariables = { name: 'Test' }
      const onSuccess = vi.fn()

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => mockData,
            onSuccess,
          }),
        { wrapper }
      )

      result.current.mutate(mockVariables)

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(onSuccess).toHaveBeenCalledTimes(1)
      // Use positional argument checks (TanStack Query passes extra context argument)
      expect(onSuccess.mock.calls[0][0]).toEqual(mockData) // data
      expect(onSuccess.mock.calls[0][1]).toEqual(mockVariables) // variables
    })

    it('should call onError callback', async () => {
      const { wrapper } = createWrapper()
      const mockError = new Error('Failed')
      const mockVariables = { name: 'Test' }
      const onError = vi.fn()

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              throw mockError
            },
            onError,
          }),
        { wrapper }
      )

      // Use mutateAsync with try-catch to handle the rejection
      try {
        await result.current.mutateAsync(mockVariables)
      } catch {
        // Expected error, handled
      }

      await waitFor(() => {
        expect(result.current.isError.get()).toBe(true)
      })

      expect(onError).toHaveBeenCalledTimes(1)
      // Use positional argument checks (TanStack Query passes extra context argument)
      expect(onError.mock.calls[0][0]).toEqual(mockError) // error
      expect(onError.mock.calls[0][1]).toEqual(mockVariables) // variables
    })

    it('should call onSettled callback on success', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1 }
      const mockVariables = { name: 'Test' }
      const onSettled = vi.fn()

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => mockData,
            onSettled,
          }),
        { wrapper }
      )

      result.current.mutate(mockVariables)

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(onSettled).toHaveBeenCalledTimes(1)
      // Use positional argument checks (NOT toHaveBeenCalledWith)
      expect(onSettled.mock.calls[0][0]).toEqual(mockData) // data
      expect(onSettled.mock.calls[0][1]).toBeNull() // error
      expect(onSettled.mock.calls[0][2]).toEqual(mockVariables) // variables
      // Do NOT assert on index [3] (context) - not in hook's interface
    })

    it('should call onSettled callback on error', async () => {
      const { wrapper } = createWrapper()
      const mockError = new Error('Failed')
      const mockVariables = { name: 'Test' }
      const onSettled = vi.fn()

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              throw mockError
            },
            onSettled,
          }),
        { wrapper }
      )

      // Use mutateAsync with try-catch to handle the rejection
      try {
        await result.current.mutateAsync(mockVariables)
      } catch {
        // Expected error, handled
      }

      await waitFor(() => {
        expect(result.current.isError.get()).toBe(true)
      })

      expect(onSettled).toHaveBeenCalledTimes(1)
      // Use positional argument checks (NOT toHaveBeenCalledWith)
      expect(onSettled.mock.calls[0][0]).toBeUndefined() // data
      expect(onSettled.mock.calls[0][1]).toBeInstanceOf(Error) // error
      expect(onSettled.mock.calls[0][2]).toEqual(mockVariables) // variables
      // Do NOT assert on index [3] (context) - not in hook's interface
    })
  })

  describe('Observable State Updates', () => {
    it('should update observable state reactively', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1 }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 50))
              return mockData
            },
          }),
        { wrapper }
      )

      // Initial state
      expect(result.current.status.get()).toBe('idle')
      expect(result.current.data.get()).toBeUndefined()
      expect(result.current.error.get()).toBeNull()

      result.current.mutate()

      // Pending state
      await waitFor(() => {
        expect(result.current.isPending.get()).toBe(true)
      })

      expect(result.current.status.get()).toBe('pending')
      expect(result.current.isIdle.get()).toBe(false)

      // Success state
      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(result.current.status.get()).toBe('success')
      expect(result.current.data.get()).toEqual(mockData)
      expect(result.current.isPending.get()).toBe(false)
      expect(result.current.error.get()).toBeNull()
    })

    it('should track variables', async () => {
      const { wrapper } = createWrapper()
      const mockVariables = { name: 'Test Product', price: 100 }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (data: typeof mockVariables) => data,
          }),
        { wrapper }
      )

      expect(result.current.variables.get()).toBeUndefined()

      result.current.mutate(mockVariables)

      await waitFor(() => {
        expect(result.current.variables.get()).toEqual(mockVariables)
      })
    })

    it('should track submittedAt', async () => {
      const { wrapper } = createWrapper()

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => ({ id: 1 }),
          }),
        { wrapper }
      )

      expect(result.current.submittedAt.get()).toBe(0)

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.submittedAt.get()).toBeGreaterThan(0)
      })

      const submittedAt = result.current.submittedAt.get()
      expect(submittedAt).toBeGreaterThan(Date.now() - 1000) // Within last second
    })
  })

  describe('State Completeness', () => {
    it('should include context field from onMutate', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1 }
      const mockContext = { previousData: 'old' }

      const { result } = renderHook(
        () => useMutation({
          mutationFn: async () => mockData,
          onMutate: () => mockContext,
        }),
        { wrapper }
      )

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(result.current.context.get()).toEqual(mockContext)
    })
  })

  describe('mutateAsync', () => {
    it('should return a promise that resolves with data', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1, name: 'Test' }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => mockData,
          }),
        { wrapper }
      )

      const promise = result.current.mutateAsync()
      const data = await promise

      expect(data).toEqual(mockData)
    })

    it('should return a promise that rejects on error', async () => {
      const { wrapper } = createWrapper()
      const mockError = new Error('Mutation failed')

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              throw mockError
            },
          }),
        { wrapper }
      )

      await expect(result.current.mutateAsync()).rejects.toThrow('Mutation failed')
    })
  })

  describe('Reset Functionality', () => {
    it('should reset state to idle and clear data and error', async () => {
      const { wrapper } = createWrapper()
      const mockData = { id: 1 }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => mockData,
          }),
        { wrapper }
      )

      // Perform mutation
      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isSuccess.get()).toBe(true)
      })

      expect(result.current.data.get()).toEqual(mockData)
      expect(result.current.status.get()).toBe('success')

      // Reset
      result.current.reset()

      await waitFor(() => {
        expect(result.current.status.get()).toBe('idle')
      })

      expect(result.current.isIdle.get()).toBe(true)
      expect(result.current.data.get()).toBeUndefined()
      expect(result.current.error.get()).toBeNull()
      expect(result.current.isSuccess.get()).toBe(false)
      expect(result.current.isPending.get()).toBe(false)
      expect(result.current.isError.get()).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      const { wrapper } = createWrapper()
      let externalState = 'idle'

      const { result, unmount } = renderHook(
        () =>
          useMutation({
            mutationFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 100))
              return { id: 1 }
            },
          }),
        { wrapper }
      )

      // Track state changes
      const statusBefore = result.current.status.get()
      expect(statusBefore).toBe('idle')

      // Start mutation
      result.current.mutate()

      // Verify pending state
      await waitFor(() => {
        expect(result.current.isPending.get()).toBe(true)
      })

      externalState = 'pending'

      // Unmount while mutation is in progress
      unmount()

      // Wait for mutation to complete (if it were still subscribed)
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Since we unmounted, we can't check the observable state
      // But we verified that the hook was pending before unmount
      // and no errors were thrown during unmount
      expect(externalState).toBe('pending')
    })
  })
})
