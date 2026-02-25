"use client";
import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import type { DeepMaybeObservable } from "../../types";
import { useMayObservableOptions } from "../../function/useMayObservableOptions";
import type { MaybeElement } from "../useEl$";
import { useIntersectionObserver } from "../useIntersectionObserver";
import type { UseIntersectionObserverOptions } from "../useIntersectionObserver";

export interface UseElementVisibilityOptions {
  /** Initial visibility value. Default: false */
  initialValue?: boolean;
  /** Element used as the viewport for intersection. Maps to IntersectionObserver `root`. */
  scrollTarget?: MaybeElement;
  /** Margin around the root. Accepts CSS-style values. Default: "0px" */
  rootMargin?: string;
  /** Threshold(s) at which to trigger. Default: 0 */
  threshold?: number | number[];
  /**
   * Stop observing after the element becomes visible for the first time. Default: false.
   * Must be set at mount time; changing dynamically has no effect.
   */
  once?: boolean;
}

/**
 * Tracks whether a DOM element is visible within the viewport (or a specified scroll container).
 * Returns a reactive `Observable<boolean>` that updates automatically as visibility changes.
 *
 * `options` accepts a `DeepMaybeObservable<UseElementVisibilityOptions>`:
 * - A plain object with per-field values
 * - A plain object with per-field `Observable<T>` values
 * - The entire options object wrapped in `Observable<UseElementVisibilityOptions>`
 *
 * @param element - The element to observe
 * @param options - Optional configuration — plain, per-field Observable, or fully Observable
 * @returns `Observable<boolean>` — true when element is intersecting
 *
 * @example
 * ```tsx
 * const el$ = useEl$<HTMLDivElement>();
 * const isVisible$ = useElementVisibility(el$);
 * return <div ref={el$} />;
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function useElementVisibility(
  element: MaybeElement,
  options?: DeepMaybeObservable<UseElementVisibilityOptions>,
): Observable<boolean> {
  const opts$ = useMayObservableOptions<UseElementVisibilityOptions>(options, {
    initialValue: "peek",
    once: "peek",
    scrollTarget: "get.element",
  });

  const isVisible$ = useObservable<boolean>(opts$.initialValue.peek() ?? false);

  const { stop } = useIntersectionObserver(
    element,
    (entries) => {
      if (entries.length === 0) return;
      const latest = entries.reduce((a, b) => (a.time > b.time ? a : b));
      isVisible$.set(latest.isIntersecting);

      if (opts$.once.peek() && latest.isIntersecting) {
        stop();
      }
    },
    {
      root: opts$.scrollTarget,
      rootMargin: opts$.rootMargin,
      threshold: opts$.threshold,
    } as DeepMaybeObservable<UseIntersectionObserverOptions>,
  );

  return isVisible$;
}
