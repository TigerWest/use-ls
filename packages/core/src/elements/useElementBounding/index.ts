import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useEffect, useRef } from "react";
import { type MaybeElement, peekElement } from "../useRef$";
import { useResizeObserver } from "../useResizeObserver";
import { useMutationObserver } from "../useMutationObserver";
import { useEventListener } from "../../browser/useEventListener";
import { isWindow } from "../../shared";
import { defaultWindow } from "../../shared/configurable";
import { useMayObservableOptions } from "../../function/useMayObservableOptions";
import type { DeepMaybeObservable } from "../../types";

export interface UseElementBoundingOptions {
  /** Reset all values to 0 when element unmounts. Default: true */
  reset?: boolean;
  /** Re-calculate on window resize. Default: true */
  windowResize?: boolean;
  /** Re-calculate on window scroll. Default: true */
  windowScroll?: boolean;
  /** Calculate immediately on mount. Default: true */
  immediate?: boolean;
  /** Use requestAnimationFrame to read rect after CSS transforms settle. Default: true */
  useCssTransforms?: boolean;
}

export interface UseElementBoundingReturn {
  x$: Observable<number>;
  y$: Observable<number>;
  top$: Observable<number>;
  right$: Observable<number>;
  bottom$: Observable<number>;
  left$: Observable<number>;
  width$: Observable<number>;
  height$: Observable<number>;
  update: () => void;
}

const ZERO = {
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
};

// isWindow(window) returns false in SSR (typeof window === "undefined"), true in browser.
const win = defaultWindow;

/**
 * Tracks the bounding rect of a DOM element (x, y, top, right, bottom, left, width, height).
 * Observes ResizeObserver, MutationObserver (style/class changes), window scroll, and resize.
 *
 * @param target - Element to observe: Ref$, Observable<OpaqueObject<Element>|null>, Document, Window, or null
 * @param options - Configuration options
 * @returns Reactive bounding rect values plus a manual `update()` function
 *
 * @example
 * ```tsx
 * const el$ = useRef$<HTMLDivElement>();
 * const { top$, left$, width$, height$ } = useElementBounding(el$);
 * return <div ref={el$} />;
 * ```
 */
export function useElementBounding(
  target: MaybeElement,
  options?: DeepMaybeObservable<UseElementBoundingOptions>,
): UseElementBoundingReturn {
  const opts$ = useMayObservableOptions<UseElementBoundingOptions>(options, {
    immediate: "peek",
  });

  const bounding$ = useObservable({ ...ZERO });

  // Guards rAF callbacks from updating state after unmount.
  const unmountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const recalculate = useCallback(() => {
    const el = peekElement(target) as Element | null;
    if (!el || !(el instanceof Element)) {
      if (opts$.reset.peek() !== false) bounding$.assign({ ...ZERO });
      return;
    }
    const rect = el.getBoundingClientRect();
    bounding$.assign({
      x: rect.x,
      y: rect.y,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(() => {
    if (opts$.useCssTransforms.peek() !== false) {
      rafRef.current = requestAnimationFrame(() => {
        if (!unmountedRef.current) recalculate();
      });
    } else {
      recalculate();
    }
  }, [recalculate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Observe size changes
  useResizeObserver(target, update);

  // Observe style/class attribute changes (e.g. CSS transitions, class toggles)
  useMutationObserver(target, update, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });

  // Observe window scroll / resize (always call hooks unconditionally — Rules of Hooks)
  // isWindow(win) is false in SSR, so target becomes null outside the browser.
  // peek() — evaluated once at render time, no reactive subscription needed.
  useEventListener(
    isWindow(win) && opts$.windowScroll.peek() !== false ? win : null,
    "scroll",
    update,
    { passive: true },
  );
  useEventListener(
    isWindow(win) && opts$.windowResize.peek() !== false ? win : null,
    "resize",
    update,
    { passive: true },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    unmountedRef.current = false;
    if (opts$.immediate.peek() !== false) update();
    return () => {
      unmountedRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (opts$.reset.peek() !== false) bounding$.assign({ ...ZERO });
    };
  }, []);

  return {
    x$: bounding$.x,
    y$: bounding$.y,
    top$: bounding$.top,
    right$: bounding$.right,
    bottom$: bounding$.bottom,
    left$: bounding$.left,
    width$: bounding$.width,
    height$: bounding$.height,
    update,
  };
}
