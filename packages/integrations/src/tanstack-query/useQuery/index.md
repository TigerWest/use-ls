---
title: useQuery
category: Hooks
---

React hook for data fetching that bridges TanStack Query with Legend-State. Returns query state as an `Observable`, and accepts `Observable` values anywhere in the options — including individual elements inside `queryKey`. When an observable value changes, the query automatically re-fetches.

## Import

```typescript
import { useQuery } from "@usels/integrations";
```

## Options

`useQuery` accepts `DeepMaybeObservable<UseQueryOptions<TData>>` — each field can be a plain value or an `Observable`.

| Option                 | Type                                     | Required | Description                                                                                              |
| ---------------------- | ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `queryKey`             | `readonly unknown[]`                     | Yes      | Query key array. Elements can be plain values, `Observable`s, or plain objects containing `Observable`s. |
| `queryFn`              | `() => Promise<TData>`                   | Yes      | Function to fetch data. Use `.peek()` inside to avoid registering reactive deps.                         |
| `enabled`              | `MaybeObservable<boolean>`               | —        | Whether the query should run. Defaults to `true`.                                                        |
| `staleTime`            | `MaybeObservable<number>`                | —        | Time in ms before data is considered stale.                                                              |
| `gcTime`               | `MaybeObservable<number>`                | —        | Time in ms before inactive query cache is garbage collected.                                             |
| `retry`                | `MaybeObservable<number \| boolean>`     | —        | Number of retry attempts on failure, or `false` to disable.                                              |
| `refetchOnWindowFocus` | `MaybeObservable<boolean>`               | —        | Refetch when window regains focus.                                                                       |
| `refetchOnMount`       | `MaybeObservable<boolean>`               | —        | Refetch when component mounts.                                                                           |
| `refetchOnReconnect`   | `MaybeObservable<boolean>`               | —        | Refetch when network reconnects.                                                                         |
| `throwOnError`         | `boolean \| ((error: Error) => boolean)` | —        | Throw errors to the nearest error boundary.                                                              |
| `suspense`             | `boolean`                                | —        | Enable React Suspense mode. Requires a `<Suspense>` boundary in the tree.                                |

## Returns

`Observable<QueryState<TData>>` — all fields are observable. Access values with `.get()` inside reactive contexts or `.peek()` for non-reactive reads.

| Field                 | Type                                | Description                                           |
| --------------------- | ----------------------------------- | ----------------------------------------------------- |
| `data`                | `TData \| undefined`                | Fetched data.                                         |
| `error`               | `Error \| null`                     | Error from the last failed fetch.                     |
| `status`              | `"pending" \| "error" \| "success"` | Overall query status.                                 |
| `fetchStatus`         | `"fetching" \| "paused" \| "idle"`  | Current fetch lifecycle status.                       |
| `isPending`           | `boolean`                           | No data yet and a fetch is in progress.               |
| `isSuccess`           | `boolean`                           | Data has been fetched successfully.                   |
| `isError`             | `boolean`                           | Last fetch resulted in an error.                      |
| `isLoading`           | `boolean`                           | `isPending && isFetching` — first fetch in progress.  |
| `isFetching`          | `boolean`                           | Any fetch (initial or background) is in progress.     |
| `isRefetching`        | `boolean`                           | Background refetch in progress (data already exists). |
| `isPaused`            | `boolean`                           | Fetch is paused (e.g. offline).                       |
| `isStale`             | `boolean`                           | Data is older than `staleTime`.                       |
| `isFetched`           | `boolean`                           | Data has been fetched at least once.                  |
| `isFetchedAfterMount` | `boolean`                           | Data was fetched after the current mount.             |
| `isEnabled`           | `boolean`                           | Whether the query is currently enabled.               |
| `isLoadingError`      | `boolean`                           | Error occurred during the initial load.               |
| `isRefetchError`      | `boolean`                           | Error occurred during a background refetch.           |
| `isPlaceholderData`   | `boolean`                           | Currently showing placeholder data.                   |
| `dataUpdatedAt`       | `number`                            | Timestamp of the last successful data update.         |
| `errorUpdatedAt`      | `number`                            | Timestamp of the last error.                          |
| `failureCount`        | `number`                            | Number of consecutive failures.                       |
| `failureReason`       | `Error \| null`                     | Reason for the last failure.                          |
| `errorUpdateCount`    | `number`                            | Total number of errors encountered.                   |
| `refetch`             | `() => void`                        | Manually trigger a refetch.                           |

## Usage

### Basic query

```tsx twoslash
// @noErrors
import { useQuery } from "@usels/integrations";

function ProductList() {
  const query = useQuery({
    queryKey: ["products"],
    queryFn: () => fetch("/api/products").then((r) => r.json()),
  });

  return (
    <div>
      {query.isLoading.get() && <p>Loading...</p>}
      {query.isError.get() && <p>Error: {query.error.get()?.message}</p>}
      {query.data.get()?.map((p: any) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  );
}
```

### Observable in queryKey (auto-refetch)

When an element inside `queryKey` is an `Observable`, the query automatically re-fetches whenever its value changes. Use `.peek()` in `queryFn` to read the current value without registering an extra reactive dependency.

```tsx twoslash
// @noErrors
import { useQuery } from "@usels/integrations";
import { observable } from "@legendapp/state";

const id$ = observable("1");

function UserProfile() {
  const user$ = useQuery({
    queryKey: ["users", id$], // re-fetches when id$ changes
    queryFn: () => fetchUser(id$.peek()),
  });

  return <p>{user$.data.get()?.name}</p>;
}

// Changing id$ triggers a refetch automatically
id$.set("2");
```

The resolved `queryKey` is a plain array (e.g. `['users', '1']`), so cache lookups via `queryClient.getQueryData(['users', '1'])` work as expected.

### Observable inside a nested object in queryKey

Observable values nested inside plain objects within `queryKey` are also resolved reactively.

```tsx twoslash
// @noErrors
import { useQuery } from "@usels/integrations";
import { observable } from "@legendapp/state";

const filter$ = observable({ category: "electronics" });

const list$ = useQuery({
  queryKey: ["products", { filter: filter$.category }],
  queryFn: () => fetchProducts(filter$.category.peek()),
});

// Changing filter$.category triggers a refetch
filter$.category.set("clothing");
```

### Per-field Observable options

Individual options like `enabled`, `staleTime`, etc. also accept `Observable` values.

```tsx twoslash
// @noErrors
import { useQuery } from "@usels/integrations";
import { observable } from "@legendapp/state";

const enabled$ = observable(false);

const data$ = useQuery({
  queryKey: ["dashboard"],
  queryFn: fetchDashboard,
  enabled: enabled$, // query only runs when enabled$ is true
});

// Enable the query dynamically
enabled$.set(true);
```

### Manual refetch

```tsx twoslash
// @noErrors
import { useQuery } from "@usels/integrations";

function DataPanel() {
  const query = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  return (
    <div>
      <p>Updated: {new Date(query.dataUpdatedAt.get()).toLocaleTimeString()}</p>
      <button onClick={() => query.refetch.get()()}>Refresh</button>
    </div>
  );
}
```

## Notes

- **`queryFn` and `.peek()`** — Always use `.peek()` (not `.get()`) inside `queryFn` when reading observable values. Using `.get()` would register reactive dependencies and cause unexpected re-renders.
- **Observable state fields** — All returned fields are `Observable`. To read them in a reactive component, call `.get()`. For non-reactive reads (e.g. event handlers), use `.peek()`.
- **Cache key identity** — Observable elements in `queryKey` are resolved to their plain values before being passed to TanStack Query. The cache key is always a plain array, matching TanStack's standard behavior.
- **`staleTime` and caching** — When `queryKey` changes, TanStack decides whether to fetch fresh data or serve from cache based on `staleTime`. No manual `refetch()` is needed on key changes.
