"use client";
import { useMount, useObservable, useObserve } from "@legendapp/state/react";
import { MutationKey, MutationObserver } from "@tanstack/query-core";
import { useRef } from "react";
import type { Observable } from "@legendapp/state";
import { useQueryClient } from "./useQueryClient";

export interface UseMutationOptions<TData = unknown, TVariables = void, TContext = unknown> {
  mutationKey?: MutationKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>;
  onError?: (
    error: Error,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>;
}

export interface MutationState<TData = unknown, TVariables = void, TContext = unknown> {
  data: TData | undefined;
  error: Error | null;
  status: "idle" | "pending" | "error" | "success";
  isIdle: boolean;
  isPending: boolean;
  isPaused: boolean;
  isSuccess: boolean;
  isError: boolean;
  failureCount: number;
  failureReason: Error | null;
  submittedAt: number;
  variables: TVariables | undefined;
  context: TContext | undefined;

  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

/**
 * TanStack Query Mutation과 Legend-App-State를 연결하는 커스텀 훅
 * MutationObserver를 사용하여 뮤테이션 상태를 observable로 관리합니다.
 *
 * @example
 * ```tsx
 * import { QueryClient } from '@tanstack/react-query'
 * import { QueryClientProvider, useMutation } from '@usels/integrations'
 *
 * // QueryClient를 생성하고 Provider로 제공
 * const queryClient = new QueryClient()
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <YourApp />
 *     </QueryClientProvider>
 *   )
 * }
 *
 * // 컴포넌트에서 사용
 * function YourComponent() {
 *   const createProduct$ = useMutation({
 *     mutationFn: (product: NewProduct) =>
 *       fetch('/api/products', {
 *         method: 'POST',
 *         body: JSON.stringify(product)
 *       }).then(r => r.json()),
 *     onSuccess: () => {
 *       alert('Product created!')
 *     }
 *   })
 *
 *   const handleSubmit = (product: NewProduct) => {
 *     createProduct$.mutate(product)
 *   }
 * }
 * ```
 */
export function useMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TVariables, TContext>
): Observable<MutationState<TData, TVariables, TContext>> {
  const queryClient = useQueryClient();

  // Observer는 한 번만 생성
  const observerRef = useRef<MutationObserver<TData, Error, TVariables, TContext> | null>(null);

  // Observable 상태 초기화 (mutate/mutateAsync/reset는 별도 함수로 분리 - observable 안에 넣으면 Observable<Function>이 됨)
  const state$ = useObservable({
    data: undefined as TData | undefined,
    error: null as Error | null,
    status: "idle" as "idle" | "pending" | "error" | "success",
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
    mutate(variables: TVariables) {
      // Cast to any: TanStack Query mutate() returns void in types but may return
      // a Promise at runtime. Swallow it to prevent unhandled rejection warnings.
      (observerRef.current?.mutate(variables) as unknown as Promise<void>)?.catch?.(() => {});
    },
    mutateAsync(variables: TVariables): Promise<TData> {
      if (observerRef.current) {
        return new Promise((resolve, reject) => {
          // Suppress TanStack Query's internal execute() Promise rejection.
          (
            observerRef.current!.mutate(variables, {
              onSuccess: (data) => resolve(data),
              onError: (error) => reject(error),
            }) as unknown as Promise<void>
          )?.catch?.(() => {});
        });
      }
      throw new Error("Mutation not initialized");
    },
    reset() {
      observerRef.current?.reset();
    },
  });

  // eslint-disable-next-line react-hooks/refs -- lazy initialization: observer created once on first render
  if (!observerRef.current) {
    observerRef.current = new MutationObserver<TData, Error, TVariables, TContext>(queryClient, {
      mutationKey: options.mutationKey,
      mutationFn: options.mutationFn,
      onMutate: options.onMutate,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onSettled: options.onSettled,
    });
  }

  // useObserve로 options 변화 추적
  useObserve(() => {
    observerRef.current?.setOptions({
      mutationKey: options.mutationKey,
      mutationFn: options.mutationFn,
      onMutate: options.onMutate,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onSettled: options.onSettled,
    });
  });

  // 구독은 한 번만 설정 (React lifecycle)
  useMount(() => {
    const observer = observerRef.current;
    if (!observer) return;

    const unsubscribe = observer.subscribe((result) => {
      state$.assign({
        data: result.data,
        error: result.error ?? null,
        status: result.status,
        isIdle: result.isIdle,
        isPending: result.isPending,
        isPaused: result.isPaused,
        isSuccess: result.isSuccess,
        isError: result.isError,
        failureCount: result.failureCount,
        failureReason: result.failureReason ?? null,
        submittedAt: result.submittedAt,
        variables: result.variables,
        context: result.context,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    return () => {
      unsubscribe();
    };
    // state$는 stable하므로 의존성에 불필요
  });

  return state$;
}
