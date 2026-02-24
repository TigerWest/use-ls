---
paths:
  - "packages/utils/src/**/*.ts"
  - "packages/integrations/src/**/*.ts"
---

# Library Implementation Guide

## Rule 1 — Element Parameters: Use `useEl$` and `MaybeElement`

When a hook accepts a DOM element, use `MaybeElement` as the parameter type.
This allows callers to pass an `El$` ref, a raw element, or an Observable element.

```ts
// ❌ Bad — raw HTMLElement only
function useMyHook(element: HTMLElement | null) { ... }

// ✅ Good — accepts El$, Observable, or raw element
import type { MaybeElement } from "../useEl$";

function useMyHook(element: MaybeElement) { ... }
```

### Resolving MaybeElement Internally

Use `getElement` / `peekElement` / `isEl$` from `useEl$`:

```ts
import { getElement, peekElement, isEl$ } from "../useEl$";

function useMyHook(element: MaybeElement) {
  useObserve(() => {
    // Reactive read — registers tracking dependency on El$ or Observable element
    const el = getElement(element);
    if (el) setup(el);
  });

  // Non-reactive read — use inside setup() callback (called from useObserve)
  const el = peekElement(element);
}
```

### Creating El$ Refs in Components

```tsx
import { useEl$ } from "@las/utils";

function MyComponent() {
  const el$ = useEl$<HTMLDivElement>();
  useMyHook(el$);
  return <div ref={el$} />;
}
```

### `ObservableHint.opaque` — Required When Storing Elements in Observables

Legend-State deep-proxies objects by default. Always wrap DOM elements with
`ObservableHint.opaque()` before storing them in an Observable.

```ts
import { ObservableHint } from "@legendapp/state";

// ❌ Bad — Legend-State deep-proxies the HTMLElement
const el$ = observable<HTMLElement | null>(document.querySelector("#root"));

// ✅ Good — opaque() prevents deep-proxying; element→element changes reliable
const el$ = observable<OpaqueObject<HTMLElement> | null>(null);
el$.set(ObservableHint.opaque(document.querySelector("#root")));
```

This is exactly what `useEl$` does internally:
```ts
el$.set(node ? ObservableHint.opaque(node) : null);
```

**`El$` (from `useEl$`) is the preferred way to hold reactive element references**
because it handles opaque wrapping automatically.

---

## Rule 2 — Options Parameters: Use `DeepMaybeObservable`

When designing a useHook function, define the options interface with **plain types** and wrap the parameter with `DeepMaybeObservable<T>`.

```ts
// ❌ Bad — per-field MaybeObservable in the interface
interface UseMyHookOptions {
  enabled?: MaybeObservable<boolean>;
  rootMargin?: MaybeObservable<string>;
}
function useMyHook(options?: MaybeObservable<UseMyHookOptions>) { ... }

// ✅ Good — plain interface, DeepMaybeObservable on the parameter
interface UseMyHookOptions {
  enabled?: boolean;
  rootMargin?: string;
}
function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) { ... }
```

### ❌ Anti-pattern — One-time read outside reactive context

```ts
// ❌ NEVER do this — snapshot at mount, changes silently ignored
function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) {
  const opts = isObservable(options) ? options.get() : options; // snapshot!
  setup(opts?.rootMargin); // Observable changes after mount are invisible
}
```

`get()` and `.get()` outside a reactive context (`useObservable`, `useObserve`, `computed`)
produce a **one-time snapshot**. Observable changes after mount are silently ignored.

---

### Standard Pattern — `useObservable(() => get(options), [options])`

Normalize `DeepMaybeObservable` into a stable computed Observable at the top of the hook.
This handles both outer `Observable<Options>` and per-field `{ field: Observable<T> }` cases.

```ts
function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) {
  const opts$ = useObservable(() => get(options), [options]);
  //
  // Outer Observable case:  get(options$) → options$.get() in reactive context → dep registered
  // Per-field case:         Legend-State auto-dereferences + field-level dep tracking
  //                         opts$.rootMargin.get() returns "0px", not Observable<string>
  //                         Changes to rootMargin$ ARE reflected in opts$.rootMargin

  useObserve(() => {
    const rootMargin = opts$.rootMargin.get();
    const enabled = opts$.enabled.get() ?? true;
    if (enabled) setup(rootMargin);
  });
}
```

> **⚠️ Outer Observable — child-field change vs full-object replace**
>
> `useObservable(() => get(options$), [options$])` tracks `options$` as a whole.
> - `options$.set({ rootMargin: "20px" })` — full replace → `useObservable` re-evaluates → `opts$` updated ✓
> - `options$.rootMargin.set("20px")` — child-field change → `useObservable` **may not re-evaluate**
>
> To reactively track child-field changes, use `linked` to establish an explicit two-way binding
> (similar to Vue's writable computed ref):
>
> ```ts
> import { linked } from "@legendapp/state";
>
> // opts$ is linked to options$ — child-field changes are propagated
> const opts$ = useObservable(() =>
>   linked({
>     get: () => get(options),
>     set: ({ value }) => isObservable(options) && options.set(value),
>   })
> );
> ```
>
> This is only needed when the caller mutates `options$` at the child-field level.
> For most hook usage patterns (full replace or per-field Observable), the
> **Standard Pattern alone is sufficient**.

### Standard Pattern (with HTMLElement field)

When the options object contains a `MaybeElement` field, resolve and wrap with
`ObservableHint.opaque()` inside the `useObservable` callback.
`getElement()` in a reactive context registers dep on El$ mount/unmount.

```ts
interface UseMyHookOptions {
  scrollTarget?: MaybeElement;
  rootMargin?: string;
}

function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) {
  const opts$ = useObservable(() => {
    const opt = get(options);
    const el = getElement(opt?.scrollTarget); // reactive: tracks El$ mount + Observable changes
    return {
      ...opt,
      scrollTarget: el ? ObservableHint.opaque(el) : null,
    };
  }, [options]);

  useObserve(() => {
    const root = opts$.scrollTarget.peek(); // OpaqueObject<HTMLElement> | null
    const rootMargin = opts$.rootMargin.get();
    setup({ root, rootMargin });
  });
}
```

> `getElement(El$)` calls `El$.get()` → registers dep on El$'s internal Observable.
> When El$ mounts, `useObservable` recomputes → `opts$.scrollTarget` updates → `useObserve` re-runs.

### Passthrough Pattern (delegating to hooks with internal `useObserve`)

When delegating to a hook that already tracks options reactively inside its own `useObserve`
(e.g., `useIntersectionObserver`), use Standard Pattern to normalize first, then pass
the computed Observable child fields as references.

```ts
function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) {
  const opts$ = useObservable(() => {
    const opt = get(options);
    const el = getElement(opt?.scrollTarget);
    return { ...opt, scrollTarget: el ? ObservableHint.opaque(el) : null };
  }, [options]);

  // Pass computed Observable child fields — downstream useObserve tracks them
  useIntersectionObserver(element, callback, {
    rootMargin: opts$.rootMargin,
    root: opts$.scrollTarget as unknown as MaybeElement | undefined,
  });
}
```

---

## Rule 3 — Mount-time-only Properties: Use `peek`

Some options are intentionally captured **once at mount** and never updated reactively:

- `initialValue` — seeds the initial state of an Observable; later changes have no meaning
- `once` — lifecycle behavior determined at mount; dynamic changes do not apply retroactively

For these fields, use `peek()` from `@las/utils` — the non-reactive counterpart to `get()`.
This is **intentional** and explicitly signals "read once, fixed at mount" — distinct from
the Anti-pattern in Rule 2 where `get()` is accidentally used for fields that *should* be reactive.

```ts
import { get, peek } from "@las/utils";

interface UseMyHookOptions {
  initialValue?: boolean;  // mount-time-only — fixed at mount
  once?: boolean;          // mount-time-only — fixed at mount
  rootMargin?: string;     // reactive — should update when changed
}

function useMyHook(options?: DeepMaybeObservable<UseMyHookOptions>) {
  const opts$ = useObservable(() => get(options), [options]);

  // ✅ peek() — intentional one-time read. Documents that this value is mount-time-only.
  //    Using get() here would be misleading: it implies reactivity that is never honored.
  const initialValue = peek(opts$, "initialValue") ?? false;
  const once = peek(opts$, "once") ?? false;

  const state$ = useObservable<boolean>(initialValue);

  const { stop } = useIntersectionObserver(element, (entries) => {
    const latest = entries.at(-1);
    if (!latest) return;
    state$.set(latest.isIntersecting);
    if (once && latest.isIntersecting) stop();
  }, {
    rootMargin: opts$.rootMargin, // ✅ get() path — reactive
  });

  return state$;
}
```

> **`peek()` vs `get()` decision rule**
>
> | Field characteristic | Read method | Reason |
> |----------------------|-------------|--------|
> | Changes should re-trigger setup | `get(opts$, "field")` inside `useObserve` | registers dep → reactive |
> | Fixed at mount by design | `peek(opts$, "field")` outside reactive context | explicit one-time read, no dep |
> | Mount-time seed for an Observable | `peek(opts$, "field")` as `useObservable(seed)` arg | Observable ignores later changes anyway |
