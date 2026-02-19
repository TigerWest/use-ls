import type { Observable } from "@legendapp/state";
import { useObservable, useObserve } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import {
  normalizeTargets,
  type MaybeTargetEl,
} from "../../shared/normalizeTargets";

export type { MaybeTargetEl } from "../../shared/normalizeTargets";
export { normalizeTargets } from "../../shared/normalizeTargets";

export interface UseResizeObserverOptions {
  box?: "content-box" | "border-box" | "device-pixel-content-box";
}

export interface UseResizeObserverReturn {
  isSupported: Observable<boolean>;
  stop: () => void;
}

/**
 * Observes one or more elements for size changes using the ResizeObserver API.
 *
 * @param target - Element(s) to observe: El$, Observable<Element|null>, plain Element, or an array
 * @param callback - ResizeObserver callback. Wrap in `useCallback` to avoid stale closures —
 *   the observer is only recreated when targets change, not on every render.
 * @param options - Optional box model option. Note: dynamic `box` changes are not reactively
 *   tracked; remount the hook or change a tracked target to pick up a new box value.
 * @returns `{ isSupported, stop }` — reactive support flag and manual stop function
 *
 * @example
 * ```tsx
 * const el$ = useEl$<HTMLDivElement>();
 * const handleResize = useCallback<ResizeObserverCallback>((entries) => {
 *   const { width, height } = entries[0].contentRect;
 *   width$.set(width);
 * }, []);
 * useResizeObserver(el$, handleResize);
 * return <div ref={el$} />;
 * ```
 */
export function useResizeObserver(
  target: MaybeTargetEl | MaybeTargetEl[],
  callback: ResizeObserverCallback,
  options?: UseResizeObserverOptions,
): UseResizeObserverReturn {
  const isSupported$ = useObservable<boolean>(
    typeof ResizeObserver !== "undefined",
  );
  const observerRef = useRef<ResizeObserver | null>(null);

  // Always use the latest callback without recreating the observer on every render.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Always use the latest options in setup() without reactive tracking.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Guards useObserve's initial synchronous run (before DOM is committed) from
  // calling setup(). Only useMount triggers the first setup, ensuring elements
  // are available in the DOM before observation begins.
  const mountedRef = useRef(false);

  const cleanup = () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  };

  const setup = () => {
    if (!isSupported$.peek()) return;
    cleanup();

    const targets = normalizeTargets(target);
    if (!targets.length) return;

    observerRef.current = new ResizeObserver((...args) =>
      callbackRef.current(...args),
    );
    targets.forEach((el) => {
      observerRef.current!.observe(el, { box: optionsRef.current?.box });
    });
  };

  // Initial setup after DOM is committed; cleanup on unmount.
  // useEffect is used directly (instead of useMount/useUnmount) because
  // Legend-State's useEffectOnce delays cleanup via queueMicrotask in test
  // environments, making synchronous post-unmount assertions unreliable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    mountedRef.current = true;
    setup();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  // Re-run setup whenever observable targets (El$ or Observable<Element>) change.
  // Reading normalizeTargets(target) here registers observable dependencies so
  // useObserve re-fires when a tracked target value changes.
  // mountedRef guard prevents a redundant setup on the initial synchronous run.
  useObserve(() => {
    normalizeTargets(target);
    if (mountedRef.current) setup();
  });

  return { isSupported: isSupported$, stop: cleanup };
}
