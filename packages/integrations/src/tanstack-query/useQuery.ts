"use client";
import { useMount, useObservable, useObserve } from "@legendapp/state/react";
import { isObservable } from "@legendapp/state";
// import { QueryKey, QueryObserver } from "@tanstack/react-query";
import { QueryKey, QueryObserver } from "@tanstack/query-core";
import { useRef } from "react";
import type { Observable } from "@legendapp/state";
import { get, type MaybeObservable } from "@las/utils";
import { useQueryClient } from "./useQueryClient";

/**
 * QueryKey를 직렬화하면서 Observable 값을 추출합니다.
 * JSON.stringify는 Observable을 자동으로 .get()하지 않으므로
 * 커스텀 replacer를 사용하여 Observable 값을 추출합니다.
 */
function serializeQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_key, value) => {
    // isObservable을 사용하여 안전하게 Observable을 감지하고 값을 추출
    if (isObservable(value)) {
      return value.get();
    }
    return value;
  });
}

export interface UseQueryOptions<TData = unknown> {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: MaybeObservable<boolean>;
  staleTime?: MaybeObservable<number>;
  gcTime?: MaybeObservable<number>;
  retry?: MaybeObservable<number | boolean>;
  refetchOnWindowFocus?: MaybeObservable<boolean>;
  refetchOnMount?: MaybeObservable<boolean>;
  refetchOnReconnect?: MaybeObservable<boolean>;
  /**
   * Set this to `true` to throw errors to the nearest error boundary.
   * Set to a function to control which errors should be thrown.
   */
  throwOnError?: boolean | ((error: Error) => boolean);
  /**
   * Set this to `true` to enable React Suspense mode.
   * The hook will throw a promise while fetching, suspending the component.
   *
   * Note: Requires a React Suspense boundary in the component tree.
   * The query state is still available as an observable when not suspended.
   */
  suspense?: boolean;
}

export interface QueryState<TData = unknown> {
  data: TData | undefined;
  error: Error | null;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isLoadingError: boolean;
  isRefetchError: boolean;
  isFetching: boolean;
  isPaused: boolean;
  isRefetching: boolean;
  isLoading: boolean;
  /**
   * @deprecated Use `isLoading` instead. Will be removed in TanStack Query v6.
   */
  isInitialLoading: boolean;
  isStale: boolean;
  isPlaceholderData: boolean;
  isFetched: boolean;
  isFetchedAfterMount: boolean;
  isEnabled: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  failureCount: number;
  failureReason: Error | null;
  errorUpdateCount: number;

  refetch: () => void;
}

/**
 * TanStack Query와 Legend-App-State를 연결하는 커스텀 훅
 * QueryObserver를 사용하여 쿼리 상태를 observable로 관리합니다.
 *
 * Observable 값을 파라미터로 받을 수 있으며, 변경 시 자동으로 refetch됩니다.
 *
 * @example
 * ```tsx
 * import { QueryClient } from '@tanstack/react-query'
 * import { QueryClientProvider, useQuery } from '@las/integrations'
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
 *   // 일반 값
 *   const products$ = useQuery({
 *     queryKey: ['products'],
 *     queryFn: () => fetch('/api/products').then(r => r.json())
 *   })
 *
 *   // Observable 값 (자동 반응)
 *   const filter$ = useObservable({ category: 'electronics' })
 *   const filteredProducts$ = useQuery({
 *     queryKey: ['products', filter$],
 *     queryFn: () => fetch(`/api/products?category=${filter$.category.get()}`).then(r => r.json())
 *   })
 *   // filter$가 변경되면 자동으로 refetch!
 *
 *
 *   // 렌더링
 *   return (
 *     <Show if={() => products$.isSuccess.get()}>
 *       {() => (
 *         <For each={() => products$.data.get()}>
 *           {(product$) => <ProductCard $product={product$} />}
 *         </For>
 *       )}
 *     </Show>
 *   )
 * }
 * ```
 */
export function useQuery<TData = unknown>(
  options: MaybeObservable<UseQueryOptions<TData>>,
): Observable<QueryState<TData>> {
  const queryClient = useQueryClient();
  // Observer는 한 번만 생성
  const observerRef = useRef<QueryObserver<TData, Error> | null>(null);
  const previousQueryKeyRef = useRef<string | null>(null);

  // options 자체가 Observable인 경우 초기 스냅샷 추출 (최초 1회용)
  const initialOptions = get(options);

  // Observable 상태 초기화 (refetch는 별도 함수로 분리 - observable 안에 넣으면 Observable<Function>이 됨)
  const state$ = useObservable({
    data: undefined as TData | undefined,
    error: null as Error | null,
    status: "pending" as "pending" | "error" | "success",
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isPending: true,
    isSuccess: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    isFetching: false,
    isPaused: false,
    isRefetching: false,
    isLoading: true,
    isInitialLoading: true,
    isStale: true,
    isPlaceholderData: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isEnabled: get(initialOptions.enabled) ?? true,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null as Error | null,
    errorUpdateCount: 0,
    refetch() {
      observerRef.current?.refetch();
    },
  });

  if (!observerRef.current) {
    const initialQueryKeyString = serializeQueryKey(initialOptions.queryKey);
    previousQueryKeyRef.current = initialQueryKeyString;
    observerRef.current = new QueryObserver<TData, Error>(queryClient, {
      queryKey: [initialQueryKeyString],
      queryFn: initialOptions.queryFn,
      enabled: get(initialOptions.enabled) ?? true,
      staleTime: get(initialOptions.staleTime),
      gcTime: get(initialOptions.gcTime),
      retry: get(initialOptions.retry),
      refetchOnWindowFocus: get(initialOptions.refetchOnWindowFocus),
      refetchOnMount: get(initialOptions.refetchOnMount),
      refetchOnReconnect: get(initialOptions.refetchOnReconnect),
      throwOnError: initialOptions.throwOnError as never,
    });
  }

  // useObserve로 options 변화 추적 (렌더링 중 동기 실행)
  // options 자체가 Observable이면 get(options)로 추적,
  // 각 필드가 Observable이면 get(field)로 추적
  useObserve(() => {
    const resolved = get(options);

    // options 객체를 직렬화하면서 Observable 값을 추출
    // serializeQueryKey의 replacer에서 .get()을 호출하므로 useObserve가 추적
    const queryKeyString = serializeQueryKey(resolved.queryKey);

    // queryKey가 변경되었는지 확인
    const hasQueryKeyChanged = previousQueryKeyRef.current !== queryKeyString;

    observerRef.current?.setOptions({
      queryKey: [queryKeyString] as QueryKey,
      queryFn: resolved.queryFn,
      enabled: get(resolved.enabled) ?? true,
      staleTime: get(resolved.staleTime),
      gcTime: get(resolved.gcTime),
      retry: get(resolved.retry),
      refetchOnWindowFocus: get(resolved.refetchOnWindowFocus),
      refetchOnMount: get(resolved.refetchOnMount),
      refetchOnReconnect: get(resolved.refetchOnReconnect),
      throwOnError: resolved.throwOnError as never,
    });

    // queryKey가 변경되면 refetch 트리거
    if (hasQueryKeyChanged && previousQueryKeyRef.current !== null) {
      observerRef.current?.refetch();
    }

    previousQueryKeyRef.current = queryKeyString;
  });

  // 구독은 한 번만 설정 (React lifecycle)
  useMount(() => {
    const observer = observerRef.current;
    if (!observer) return;

    const unsubscribe = observer.subscribe((result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state$.assign({
        data: result.data,
        error: result.error ?? null,
        status: result.status,
        fetchStatus: result.fetchStatus as "fetching" | "paused" | "idle",
        isPending: result.isPending,
        isSuccess: result.isSuccess,
        isError: result.isError,
        isLoadingError: result.isLoadingError,
        isRefetchError: result.isRefetchError,
        isFetching: result.isFetching,
        isPaused: result.isPaused,
        isRefetching: result.isRefetching,
        isLoading: result.isLoading,
        isInitialLoading: result.isLoading,
        isStale: result.isStale,
        isPlaceholderData: result.isPlaceholderData,
        isFetched: result.isFetched,
        isFetchedAfterMount: result.isFetchedAfterMount,
        isEnabled: result.isEnabled ?? true,
        dataUpdatedAt: result.dataUpdatedAt,
        errorUpdatedAt: result.errorUpdatedAt,
        failureCount: result.failureCount,
        failureReason: result.failureReason ?? null,
        errorUpdateCount: result.errorUpdateCount,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    return () => {
      unsubscribe();
    };
    // state$는 stable하므로 의존성에 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return state$;
}
