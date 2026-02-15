import { useObservable, useObserve } from '@legendapp/state/react'
import { batch } from '@legendapp/state'
import { MutationKey, MutationObserver, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { Observable } from '@legendapp/state'

export interface UseMutationOptions<TData = unknown, TVariables = void, TContext = unknown> {
  mutationKey?: MutationKey
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
}

export interface MutationState<TData = unknown, TVariables = void, TContext = unknown> {
  data: TData | undefined
  error: Error | null
  status: 'idle' | 'pending' | 'error' | 'success'
  isIdle: boolean
  isPending: boolean
  isPaused: boolean
  isSuccess: boolean
  isError: boolean
  failureCount: number
  failureReason: Error | null
  submittedAt: number
  variables: TVariables | undefined
  context: TContext | undefined
}

/**
 * TanStack Query Mutation과 Legend-App-State를 연결하는 커스텀 훅
 * MutationObserver를 사용하여 뮤테이션 상태를 observable로 관리합니다.
 *
 * Observable 값을 파라미터로 받을 수 있으며, 변경 시 자동으로 옵션이 업데이트됩니다.
 *
 * @example
 * ```tsx
 * // 일반 사용
 * const createProduct$ = useMutation({
 *   mutationFn: (product: NewProduct) =>
 *     fetch('/api/products', {
 *       method: 'POST',
 *       body: JSON.stringify(product)
 *     }).then(r => r.json()),
 *   onSuccess: () => {
 *     alert('Product created!')
 *   }
 * })
 *
 * const handleSubmit = (product: NewProduct) => {
 *   createProduct$.mutate(product)
 * }
 *
 * // Observable 파라미터와 함께 사용
 * const formData$ = useObservable({ name: '', price: 0 })
 *
 * // formData$가 변경되어도 mutationFn이 최신 값을 참조
 * const createProduct$ = useMutation({
 *   mutationFn: (data: ProductData) => api.createProduct(data)
 * })
 *
 * // .get()으로 값 추출하여 mutate
 * createProduct$.mutate(formData$.get())
 *
 * // 또는 반응형으로 처리
 * useObserveEffect(() => {
 *   if (formData$.shouldSubmit.get()) {
 *     createProduct$.mutate({
 *       name: formData$.name.get(),
 *       price: formData$.price.get()
 *     })
 *   }
 * })
 * ```
 */
export function useMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TVariables, TContext>
): Observable<MutationState<TData, TVariables, TContext>> & {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  reset: () => void
} {
  const queryClient = useQueryClient()

  // Observable 상태 초기화
  const state$ = useObservable({
    data: undefined as TData | undefined,
    error: null as Error | null,
    status: 'idle' as 'idle' | 'pending' | 'error' | 'success',
    isIdle: true,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    isError: false,
    failureCount: 0,
    failureReason: null as Error | null,
    submittedAt: 0,
    variables: undefined as TVariables | undefined,
    context: undefined as TContext | undefined,
  })

  // Observer는 한 번만 생성
  const observerRef = useRef<MutationObserver<TData, Error, TVariables, TContext> | null>(null)

  if (!observerRef.current) {
    observerRef.current = new MutationObserver<TData, Error, TVariables, TContext>(queryClient, {
      mutationKey: options.mutationKey,
      mutationFn: options.mutationFn,
      onMutate: options.onMutate,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onSettled: options.onSettled,
    })
  }

  // useObserve로 options 변화 추적
  // Observable 값이 변경되면 즉시 setOptions 호출
  useObserve(() => {
    const resolvedOptions = {
      mutationKey: options.mutationKey,
      mutationFn: options.mutationFn,
      onMutate: options.onMutate,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onSettled: options.onSettled,
    }

    observerRef.current?.setOptions(resolvedOptions)
  })

  // 구독은 한 번만 설정 (React lifecycle)
  useEffect(() => {
    const observer = observerRef.current
    if (!observer) return

    const unsubscribe = observer.subscribe((result) => {
      batch(() => {
        state$.assign({
          data: result.data,
          error: result.error,
          status: result.status,
          isIdle: result.isIdle,
          isPending: result.isPending,
          isPaused: result.isPaused,
          isSuccess: result.isSuccess,
          isError: result.isError,
          failureCount: result.failureCount,
          failureReason: result.failureReason,
          submittedAt: result.submittedAt,
          variables: result.variables,
          context: result.context,
        })
      })
    })

    return () => {
      unsubscribe()
    }
    // state$는 stable하므로 의존성에 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 함수들을 별도로 반환
  const mutate = (variables: TVariables) => {
    if (observerRef.current) {
      observerRef.current.mutate(variables)
    }
  }

  const mutateAsync = (variables: TVariables): Promise<TData> => {
    if (observerRef.current) {
      return new Promise((resolve, reject) => {
        observerRef.current!.mutate(variables, {
          onSuccess: (data) => resolve(data),
          onError: (error) => reject(error),
        })
      })
    }
    throw new Error('Mutation not initialized')
  }

  const reset = () => {
    if (observerRef.current) {
      observerRef.current.reset()
    }
  }

  // Observable과 함수를 별도로 반환 (Object.assign 사용하지 않음)
  return {
    ...state$,
    mutate,
    mutateAsync,
    reset,
  } as Observable<MutationState<TData, TVariables, TContext>> & {
    mutate: (variables: TVariables) => void
    mutateAsync: (variables: TVariables) => Promise<TData>
    reset: () => void
  }
}
