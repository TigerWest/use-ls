import { isObservable } from "@legendapp/state";
import type { Observable, OpaqueObject } from "@legendapp/state";
import type { El$ } from "../../elements/useEl$";
import type { MaybeObservable } from "../../types";

/**
 * A single observable-element target accepted by observer hooks.
 * Supports El$, Observable<Element|null>, and plain Element values.
 */
export type MaybeTargetEl = El$<Element> | MaybeObservable<Element | null>;

/**
 * Normalizes one or more observable-element targets into a plain Element[].
 *
 * - `El$<T>` — calls `.get()` and unwraps the OpaqueObject via `.valueOf()`
 * - `Observable<Element|null>` — calls `.get()`
 * - plain `Element | null` — used as-is
 *
 * When called inside `useObserve`, reading `.get()` registers observable
 * dependencies so the observer re-fires when a tracked target changes.
 *
 * Currently shared by useResizeObserver.
 * useIntersectionObserver, useMutationObserver will use this once implemented.
 */
export function normalizeTargets(
  target: MaybeTargetEl | MaybeTargetEl[] | null | undefined,
): Element[] {
  if (target == null) return [];
  const arr = Array.isArray(target) ? target : [target];
  return arr
    .map((t) => {
      // El$: non-observable callable with .get()/.peek()
      if (typeof t === "function" && !isObservable(t) && "get" in t) {
        const val = (t as El$<Element>).get();
        return val ? (val as OpaqueObject<Element>).valueOf() : null;
      }
      // Observable<Element | null>
      if (isObservable(t)) {
        return (t as Observable<Element | null>).get();
      }
      return t as Element | null;
    })
    .filter((el): el is Element => el != null);
}
