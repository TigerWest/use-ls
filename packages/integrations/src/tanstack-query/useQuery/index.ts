"use client";
import { useMount, useObservable, useObserve } from "@legendapp/state/react";
import { isObservable } from "@legendapp/state";
import { QueryKey, QueryObserver } from "@tanstack/query-core";
import { useRef } from "react";
import type { Observable } from "@legendapp/state";
import {
  get,
  peek,
  type MaybeObservable,
  type DeepMaybeObservable,
  useMaybeObservable,
} from "@usels/core";
import { useQueryClient } from "../useQueryClient";

/**
 * Recursively resolves Observable values within a value.
 * - Observable → .get() (registers dep in observer context)
 * - Array → recursively map
 * - Plain object (not class instance) → recursively map entries
 * - Date, Map, class instances, etc. → as-is
 */
function deepResolveValue(value: unknown): unknown {
  if (isObservable(value)) return (value as Observable<unknown>).get();
  if (Array.isArray(value)) return value.map(deepResolveValue);
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value as object).map(([k, v]) => [k, deepResolveValue(v)])
    );
  }
  return value;
}

/**
 * Resolves a MaybeObservableQueryKey into a plain TanStack QueryKey array.
 * Handles:
 * - queryKey itself being an Observable (e.g. key$)
 * - Array elements being Observables (e.g. ['users', id$])
 * - Nested plain objects with Observable values (e.g. ['users', { id: id$ }])
 *
 * All Observable `.get()` calls register deps in the calling observer context.
 */
function resolveQueryKey(queryKey: unknown): QueryKey {
  const arr = isObservable(queryKey) ? (queryKey as Observable<unknown>).get() : queryKey;
  if (!Array.isArray(arr)) return [];
  return arr.map(deepResolveValue) as QueryKey;
}

export interface UseQueryOptions<TData = unknown> {
  /**
   * Array whose elements can be plain values, Observables, or nested objects
   * containing Observables. e.g. `['users', id$]` or `['users', { id: id$ }]`.
   * The entire key can also be an Observable array.
   */
  queryKey: readonly unknown[];
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
 * Custom hook that bridges TanStack Query with Legend-State.
 * Manages query state as an observable using QueryObserver.
 *
 * Accepts `DeepMaybeObservable<UseQueryOptions>`, supporting an Observable
 * for the entire options object or for individual fields. Elements inside
 * the queryKey array can also be Observables and will react to changes automatically.
 *
 * @example
 * ```tsx
 * // Plain values
 * const products$ = useQuery({
 *   queryKey: ['products'],
 *   queryFn: () => fetch('/api/products').then(r => r.json())
 * })
 *
 * // Observable element in queryKey array
 * const id$ = observable('1')
 * const user$ = useQuery({
 *   queryKey: ['users', id$],
 *   queryFn: () => fetchUser(id$.peek()),
 * })
 * // Automatically re-fetches when id$ changes.
 * // Cache is accessible via queryClient.getQueryData(['users', '1'])
 *
 * // Observable inside a nested object in queryKey
 * const filter$ = observable({ category: 'electronics' })
 * const list$ = useQuery({
 *   queryKey: ['products', { filter: filter$.category }],
 *   queryFn: () => fetchProducts(filter$.category.peek()),
 * })
 *
 * // Per-field Observable options
 * const enabled$ = observable(false)
 * const data$ = useQuery({
 *   queryKey: ['test'],
 *   queryFn: fetchData,
 *   enabled: enabled$,
 * })
 * ```
 */
export function useQuery<TData = unknown>(
  options: DeepMaybeObservable<UseQueryOptions<TData>>
): Observable<QueryState<TData>> {
  const queryClient = useQueryClient();
  const observerRef = useRef<QueryObserver<TData, Error> | null>(null);

  // Normalize DeepMaybeObservable<UseQueryOptions> into a stable computed Observable.
  // - 'function' for queryFn: prevents Legend-State from treating it as a child observable
  // - 'default' (omitted) for other fields: Observables are kept as-is in the result,
  //   so that get(opts.enabled) inside useObserve explicitly registers the dep
  // - queryKey is NOT listed here: deepResolveValue handles Observable elements directly
  const opts$ = useMaybeObservable<UseQueryOptions<TData>>(
    options as DeepMaybeObservable<UseQueryOptions<TData>>,
    {
      queryFn: "function",
    }
  );

  // Non-reactive snapshot for the initial Observer creation (mount-time only)
  const initialOpts = opts$.peek();

  const state$ = useObservable<QueryState<TData>>({
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
    isEnabled: get(initialOpts?.enabled) ?? true,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null as Error | null,
    errorUpdateCount: 0,
    refetch() {
      observerRef.current?.refetch();
    },
  });

  // Create Observer once (mount-time, non-reactive snapshot).
  // resolveQueryKey returns the real array (e.g. ['users', '1']),
  // NOT a wrapped-serialized string, so queryClient.getQueryData(['users','1']) works.
  if (observerRef.current === null) {
    const initialQueryKey = resolveQueryKey(initialOpts?.queryKey ?? []);
    observerRef.current = new QueryObserver<TData, Error>(queryClient, {
      queryKey: initialQueryKey,
      queryFn: initialOpts?.queryFn ?? (() => Promise.resolve(undefined as TData)),
      enabled: peek(initialOpts?.enabled) ?? true,
      staleTime: peek(initialOpts?.staleTime),
      gcTime: peek(initialOpts?.gcTime),
      retry: peek(initialOpts?.retry as MaybeObservable<number | boolean>),
      refetchOnWindowFocus: peek(initialOpts?.refetchOnWindowFocus),
      refetchOnMount: peek(initialOpts?.refetchOnMount),
      refetchOnReconnect: peek(initialOpts?.refetchOnReconnect),
      throwOnError: initialOpts?.throwOnError as never,
    });
  }

  // React to option changes (including queryKey Observable elements).
  // Dependencies registered here:
  //   - opts$.get() → tracks opts$ (outer observable or per-render plain object changes)
  //   - resolveQueryKey(opts.queryKey) → deepResolveValue calls .get() on each Observable
  //     element inside queryKey, registering individual deps
  //   - get(opts.enabled) etc. → explicitly registers deps on per-field Observables
  //
  // setOptions() with a new queryKey lets TanStack decide whether to fetch or use cache
  // (respects staleTime, gcTime). No manual refetch() needed.
  useObserve(() => {
    const opts = opts$.get();
    if (!opts) return;

    const resolvedKey = resolveQueryKey(opts.queryKey ?? []);

    observerRef.current?.setOptions({
      queryKey: resolvedKey,
      // opts.queryFn: with 'function' hint, stored directly (not as child observable).
      // Access via opts$.get().queryFn (POJO property) gives the callable function.
      queryFn: opts.queryFn,
      enabled: get(opts.enabled) ?? true,
      staleTime: get(opts.staleTime),
      gcTime: get(opts.gcTime),
      retry: get(opts.retry as MaybeObservable<number | boolean>),
      refetchOnWindowFocus: get(opts.refetchOnWindowFocus),
      refetchOnMount: get(opts.refetchOnMount),
      refetchOnReconnect: get(opts.refetchOnReconnect),
      throwOnError: opts.throwOnError as never,
    });
  });

  // Subscribe once (mount/unmount lifecycle)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    return () => {
      unsubscribe();
    };
  });

  return state$;
}
