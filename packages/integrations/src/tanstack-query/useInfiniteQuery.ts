"use client";
import { useMount, useObservable, useObserve } from "@legendapp/state/react";
import { isObservable } from "@legendapp/state";
import {
  QueryKey,
  InfiniteQueryObserver,
  InfiniteData,
  QueryFunctionContext,
} from "@tanstack/query-core";
import { useRef } from "react";
import type { Observable } from "@legendapp/state";
import { get, type MaybeObservable } from "@usels/core";
import { useQueryClient } from "./useQueryClient";

/**
 * QueryKey를 직렬화하면서 Observable 값을 추출합니다.
 * JSON.stringify는 Observable을 자동으로 .get()하지 않으므로
 * 커스텀 replacer를 사용하여 Observable 값을 추출합니다.
 */
function serializeQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_key, value) => {
    if (isObservable(value)) {
      return value.get();
    }
    return value;
  });
}

export interface UseInfiniteQueryOptions<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> {
  queryKey: TQueryKey;
  queryFn: (context: QueryFunctionContext<TQueryKey, TPageParam>) => Promise<TQueryFnData>;

  // REQUIRED in v5
  initialPageParam: TPageParam;
  getNextPageParam: (
    lastPage: TQueryFnData,
    allPages: Array<TQueryFnData>,
    lastPageParam: TPageParam,
    allPageParams: Array<TPageParam>
  ) => TPageParam | undefined | null;

  // Optional
  getPreviousPageParam?: (
    firstPage: TQueryFnData,
    allPages: Array<TQueryFnData>,
    firstPageParam: TPageParam,
    allPageParams: Array<TPageParam>
  ) => TPageParam | undefined | null;

  enabled?: MaybeObservable<boolean>;
  staleTime?: MaybeObservable<number>;
  gcTime?: MaybeObservable<number>;
  retry?: MaybeObservable<number | boolean>;
  refetchOnWindowFocus?: MaybeObservable<boolean>;
  refetchOnMount?: MaybeObservable<boolean>;
  refetchOnReconnect?: MaybeObservable<boolean>;
  maxPages?: number;
}

export interface InfiniteQueryState<TData = unknown> {
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
  isStale: boolean;
  isPlaceholderData: boolean;
  isFetched: boolean;
  isFetchedAfterMount: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  failureCount: number;
  failureReason: Error | null;
  errorUpdateCount: number;
  isEnabled: boolean;
  /**
   * @deprecated Use isLoading instead. Will be removed in TanStack Query v6.
   */
  isInitialLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isFetchNextPageError: boolean;
  isFetchPreviousPageError: boolean;

  refetch: () => void;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
}

/**
 * TanStack Query Infinite Query와 Legend-App-State를 연결하는 커스텀 훅
 * InfiniteQueryObserver를 사용하여 쿼리 상태를 observable로 관리합니다.
 *
 * Observable 값을 파라미터로 받을 수 있으며, 변경 시 자동으로 refetch됩니다.
 *
 * @example
 * ```tsx
 * // Cursor-based pagination
 * const items$ = useInfiniteQuery({
 *   queryKey: ['items'],
 *   queryFn: ({ pageParam }) =>
 *     fetch(`/api/items?cursor=${pageParam}`).then(r => r.json()),
 *   initialPageParam: undefined,
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * })
 *
 * // Observable reactivity
 * const filter$ = useObservable({ category: 'electronics' })
 * const items$ = useInfiniteQuery({
 *   queryKey: ['items', filter$],
 *   queryFn: ({ pageParam }) =>
 *     fetch(`/api/items?category=${filter$.category.get()}&cursor=${pageParam}`)
 *       .then(r => r.json()),
 *   initialPageParam: undefined,
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * })
 * ```
 */
export function useInfiniteQuery<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: MaybeObservable<UseInfiniteQueryOptions<TQueryFnData, TQueryKey, TPageParam>>
): Observable<InfiniteQueryState<InfiniteData<TQueryFnData>>> {
  const queryClient = useQueryClient();

  // Observer는 한 번만 생성
  const observerRef = useRef<InfiniteQueryObserver<
    TQueryFnData,
    Error,
    InfiniteData<TQueryFnData>,
    TQueryKey,
    TPageParam
  > | null>(null);
  const previousQueryKeyRef = useRef<string | null>(null);

  // options 자체가 Observable인 경우 초기 스냅샷 추출 (최초 1회용)
  // eslint-disable-next-line use-legend/observable-naming -- get() resolves to raw value, not an observable
  const initialOptions = get(options);

  // Observable 상태 초기화 (refetch/fetchNextPage/fetchPreviousPage는 별도 함수로 분리 - observable 안에 넣으면 Observable<Function>이 됨)
  const state$ = useObservable({
    data: undefined as InfiniteData<TQueryFnData> | undefined,
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
    isStale: true,
    isPlaceholderData: false,
    isFetched: false,
    isFetchedAfterMount: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null as Error | null,
    errorUpdateCount: 0,
    isEnabled: get(initialOptions.enabled) ?? true,
    isInitialLoading: true,
    hasNextPage: false,
    hasPreviousPage: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    isFetchNextPageError: false,
    isFetchPreviousPageError: false,
    refetch() {
      observerRef.current?.refetch();
    },
    fetchNextPage() {
      observerRef.current?.fetchNextPage();
    },
    fetchPreviousPage() {
      observerRef.current?.fetchPreviousPage();
    },
  });

  // eslint-disable-next-line react-hooks/refs -- lazy initialization: observer created once on first render
  if (!observerRef.current) {
    const initialQueryKeyString = serializeQueryKey(initialOptions.queryKey);
    // eslint-disable-next-line react-hooks/refs -- initial setup during first render only
    previousQueryKeyRef.current = initialQueryKeyString;

    observerRef.current = new InfiniteQueryObserver<
      TQueryFnData,
      Error,
      InfiniteData<TQueryFnData>,
      TQueryKey,
      TPageParam
    >(queryClient, {
      queryKey: [initialQueryKeyString] as unknown as TQueryKey,
      queryFn: initialOptions.queryFn,
      enabled: get(initialOptions.enabled) ?? true,
      staleTime: get(initialOptions.staleTime),
      gcTime: get(initialOptions.gcTime),
      retry: get(initialOptions.retry),
      refetchOnWindowFocus: get(initialOptions.refetchOnWindowFocus),
      refetchOnMount: get(initialOptions.refetchOnMount),
      refetchOnReconnect: get(initialOptions.refetchOnReconnect),
      initialPageParam: initialOptions.initialPageParam,
      getNextPageParam: initialOptions.getNextPageParam,
      getPreviousPageParam: initialOptions.getPreviousPageParam,
      maxPages: initialOptions.maxPages,
    });
  }

  // useObserve로 options 변화 추적 (렌더링 중 동기 실행)
  // options 자체가 Observable이면 get(options)로 추적,
  // 각 필드가 Observable이면 get(field)로 추적
  useObserve(() => {
    // eslint-disable-next-line use-legend/observable-naming -- get() resolves to raw value, not an observable
    const resolved = get(options);

    // options 객체를 직렬화하면서 Observable 값을 추출
    // serializeQueryKey의 replacer에서 .get()을 호출하므로 useObserve가 추적
    const queryKeyString = serializeQueryKey(resolved.queryKey);

    // queryKey가 변경되었는지 확인
    const hasQueryKeyChanged = previousQueryKeyRef.current !== queryKeyString;

    observerRef.current?.setOptions({
      queryKey: [queryKeyString] as unknown as TQueryKey,
      queryFn: resolved.queryFn,
      enabled: get(resolved.enabled) ?? true,
      staleTime: get(resolved.staleTime),
      gcTime: get(resolved.gcTime),
      retry: get(resolved.retry),
      refetchOnWindowFocus: get(resolved.refetchOnWindowFocus),
      refetchOnMount: get(resolved.refetchOnMount),
      refetchOnReconnect: get(resolved.refetchOnReconnect),
      initialPageParam: resolved.initialPageParam,
      getNextPageParam: resolved.getNextPageParam,
      getPreviousPageParam: resolved.getPreviousPageParam,
      maxPages: resolved.maxPages,
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
        hasNextPage: result.hasNextPage ?? false,
        hasPreviousPage: result.hasPreviousPage ?? false,
        isFetchingNextPage: result.isFetchingNextPage ?? false,
        isFetchingPreviousPage: result.isFetchingPreviousPage ?? false,
        isFetchNextPageError: result.isFetchNextPageError ?? false,
        isFetchPreviousPageError: result.isFetchPreviousPageError ?? false,
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
