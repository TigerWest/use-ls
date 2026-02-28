import { isObservable, ObservableHint } from "@legendapp/state";
import type { Observable, OpaqueObject } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { type Ref, type RefObject, useMemo, useRef } from "react";
import { isWindow } from "../../shared";

export type Ref$<T> = ((node: T | null) => void) & {
  /** returns element, registers tracking when called inside useObserve */
  get(): OpaqueObject<T> | null;
  /** returns element without registering tracking */
  peek(): OpaqueObject<T> | null;
};

/**
 * A value that resolves to an Element, Document, Window, or null.
 *
 * - `Ref$<T>` — React-managed element ref (created via `useRef$()`). Primary choice.
 * - `Document` / `Window` — stable global singletons, always safe to pass raw.
 * - `Observable<OpaqueObject<Element> | null>` — for imperatively obtained elements.
 *   Use `ObservableHint.opaque(el)` when storing: `observable(ObservableHint.opaque(el))`.
 *
 * Raw `HTMLElement` is intentionally excluded: in React's render model, elements
 * don't exist at hook call time, making raw element references inherently stale.
 */
export type MaybeElement =
  | Ref$<any>
  | Document
  | Window
  | null
  | undefined
  | Observable<OpaqueObject<Element> | null>;

/**
 * Creates an observable element ref. Can be used as a drop-in replacement for
 * `useRef`, composed with callback refs, or used with `forwardRef`.
 *
 * The element is wrapped with `opaqueObject` to prevent legendapp/state
 * from making DOM properties reactive (deep observation).
 *
 * @param externalRef - Optional. Accepts callback ref, RefObject, or null (forwardRef compatible).
 * @returns A callable ref that is also observable via `get`/`peek`
 *
 * @example
 * ```tsx
 * // standalone — useRef replacement
 * const el$ = useRef$<HTMLDivElement>();
 * return <div ref={el$} />;
 *
 * // forwardRef compatible
 * const Component = forwardRef<HTMLDivElement>((props, ref) => {
 *   const el$ = useRef$(ref);
 *   return <div ref={el$} />;
 * });
 *
 * // callback ref composition
 * const myRef = useCallback((node: HTMLDivElement | null) => {
 *   node?.focus();
 * }, []);
 * const el$ = useRef$(myRef);
 * return <div ref={el$} />;
 * ```
 */
export function useRef$<T extends Element = Element>(
  externalRef?: Ref<T> | null,
): Ref$<T> {
  const el$ = useObservable<OpaqueObject<T> | null>(null);

  // store externalRef — simple assignment each render, no new closure
  const extRef = useRef(externalRef);
  extRef.current = externalRef;

  return useMemo(
    () =>
      Object.assign(
        (node: T | null) => {
          const ext = extRef.current;
          if (typeof ext === "function") {
            ext(node);
          } else if (ext != null && "current" in ext) {
            (ext as RefObject<T | null>).current = node;
          }
          (el$ as any).set(node ? ObservableHint.opaque(node) : null);
        },
        {
          get: () => el$.get(),
          peek: () => el$.peek(),
        },
      ) as Ref$<T>,
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/** Type guard for Ref$ — distinguishes it from Observable and raw values */
export function isRef$(v: unknown): v is Ref$<Element> {
  return (
    typeof v === "function" && !isObservable(v) && "get" in v && "peek" in v
  );
}

/** Unwraps MaybeElement with tracking (use inside useObserve) */
export function getElement(
  v: MaybeElement,
): HTMLElement | Document | Window | null {
  if (v == null) return null;
  if (isRef$(v)) {
    const raw = v.get();
    return raw
      ? ((raw as OpaqueObject<Element>).valueOf() as HTMLElement)
      : null;
  }
  if (isWindow(v)) return v;
  if (isObservable(v)) {
    const val = (v as Observable<OpaqueObject<Element> | null>).get();
    return val
      ? ((val as OpaqueObject<Element>).valueOf() as HTMLElement)
      : null;
  }
  return v as Document | null;
}

/** Unwraps MaybeElement without tracking (use inside setup/peek) */
export function peekElement(
  v: MaybeElement,
): HTMLElement | Document | Window | null {
  if (v == null) return null;
  if (isRef$(v)) {
    const raw = v.peek();
    return raw
      ? ((raw as OpaqueObject<Element>).valueOf() as HTMLElement)
      : null;
  }
  if (isWindow(v)) return v;
  if (isObservable(v)) {
    const val = (v as Observable<OpaqueObject<Element> | null>).peek();
    return val
      ? ((val as OpaqueObject<Element>).valueOf() as HTMLElement)
      : null;
  }
  return v as Document | null;
}
