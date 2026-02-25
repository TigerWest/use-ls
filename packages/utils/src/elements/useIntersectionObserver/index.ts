import type { Observable } from "@legendapp/state";
import { useObservable, useObserveEffect } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { useMayObservableOptions } from "../../function/useMayObservableOptions";
import type { DeepMaybeObservable, MaybeObservable } from "../../types";
import { isWindow } from "../../shared";
import type { MaybeElement } from "../useEl$";
import { normalizeTargets } from "../useResizeObserver";
import { get } from "../../function/get";

export interface UseIntersectionObserverOptions {
  /** Whether to start observing immediately on mount. Default: true */
  immediate?: boolean;
  /** The element or document used as the viewport. Default: browser viewport */
  root?: MaybeElement;
  /** Margin around the root. Accepts CSS-style values. Default: "0px" */
  rootMargin?: string;
  /** Threshold(s) at which to trigger the callback. Default: 0 */
  threshold?: number | number[];
}

export interface UseIntersectionObserverReturn {
  isSupported: Observable<boolean>;
  isActive: Observable<boolean>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Reactive wrapper around the IntersectionObserver API.
 * Observes one or more elements for intersection changes with pause/resume/stop support.
 *
 * @param target - Element(s) to observe: El$, Observable, raw Element, or array of these
 * @param callback - Called when intersection state changes
 * @param options - IntersectionObserver options plus an `immediate` flag
 * @returns `{ isSupported, isActive, pause, resume, stop }`
 *
 * @example
 * ```tsx
 * const el$ = useEl$<HTMLDivElement>();
 * const { isActive, pause, resume } = useIntersectionObserver(
 *   el$,
 *   (entries) => {
 *     entries.forEach(entry => console.log(entry.isIntersecting));
 *   },
 *   { threshold: 0.5 },
 * );
 * return <div ref={el$} />;
 * ```
 */
export function useIntersectionObserver(
  target: MaybeElement | MaybeElement[],
  callback: IntersectionObserverCallback,
  options?: DeepMaybeObservable<UseIntersectionObserverOptions>,
): UseIntersectionObserverReturn {
  const opts$ = useMayObservableOptions<UseIntersectionObserverOptions>(
    options,
    {
      immediate: "peek",
      threshold: "peek",
      root: "get.element",
      rootMargin: (value) => get(value as MaybeObservable<string | undefined>),
    },
  );
  const isSupported$ = useObservable<boolean>(
    typeof IntersectionObserver !== "undefined",
  );
  const isActive$ = useObservable<boolean>(opts$.immediate.peek() !== false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const stoppedRef = useRef(false);
  const mountedRef = useRef(false);

  const cleanup = () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  };

  const setup = () => {
    if (!isSupported$.peek() || !isActive$.peek()) return;
    cleanup();

    const rawRoot = opts$.root.peek();
    const root =
      rawRoot == null
        ? (rawRoot as null | undefined)
        : (() => {
            const el = (
              rawRoot as unknown as { valueOf(): HTMLElement | Document }
            ).valueOf();
            return isWindow(el as unknown) ? null : el;
          })();

    observerRef.current = new IntersectionObserver(callback, {
      root: root ?? undefined,
      rootMargin: opts$.rootMargin.peek() as string | undefined,
      threshold: (opts$.threshold.peek() as number | number[] | undefined) ?? 0,
    });

    const targets = normalizeTargets(target);
    targets.forEach((el) => observerRef.current?.observe(el));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  useObserveEffect((e) => {
    e.onCleanup = cleanup;
    const root = opts$.root.get();
    opts$.rootMargin.get();
    isActive$.get();
    normalizeTargets(target);
    if (stoppedRef.current) return;
    if (root === null) return;
    setup();
  });

  const pause = () => {
    if (!mountedRef.current) return;
    cleanup();
    isActive$.set(false);
  };

  const resume = () => {
    if (stoppedRef.current || !mountedRef.current) return;
    isActive$.set(true);
  };

  const stop = () => {
    if (!mountedRef.current) return;
    stoppedRef.current = true;
    cleanup();
    isActive$.set(false);
  };

  return {
    isSupported: isSupported$,
    isActive: isActive$,
    stop,
    pause,
    resume,
  };
}
