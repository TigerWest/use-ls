import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback } from "react";
import { isWindow } from "../../shared";
import { defaultWindow, defaultDocument } from "../../shared/configurable";
import { useMaybeObservable } from "../../function/useMaybeObservable";
import type { DeepMaybeObservable } from "../../types";
import { type MaybeElement, peekElement } from "../useRef$";
import { useResizeObserver } from "../useResizeObserver";
import { useMutationObserver } from "../useMutationObserver";
import { useEventListener } from "../../browser/useEventListener";

export interface UseMouseInElementOptions {
  /** Also update elementX/Y when mouse is outside the element. Default: true */
  handleOutside?: boolean;
  /** Re-calculate on window scroll. Default: true */
  windowScroll?: boolean;
  /** Re-calculate on window resize. Default: true */
  windowResize?: boolean;
}

export interface UseMouseInElementReturn {
  /** Mouse X position relative to the element */
  elementX$: Observable<number>;
  /** Mouse Y position relative to the element */
  elementY$: Observable<number>;
  /** Element's absolute X position on the page */
  elementPositionX$: Observable<number>;
  /** Element's absolute Y position on the page */
  elementPositionY$: Observable<number>;
  /** Element width */
  elementWidth$: Observable<number>;
  /** Element height */
  elementHeight$: Observable<number>;
  /** Whether the mouse is outside the element */
  isOutside$: Observable<boolean>;
  /** Global mouse X (clientX) */
  x$: Observable<number>;
  /** Global mouse Y (clientY) */
  y$: Observable<number>;
  /** Stop all observers and event listeners */
  stop: () => void;
}

// isWindow(window) returns false in SSR (typeof window === "undefined"), true in browser.
const win = defaultWindow;

/**
 * Tracks whether the mouse cursor is inside a DOM element and calculates
 * the cursor position relative to that element.
 *
 * Observes mousemove, document mouseleave, ResizeObserver, MutationObserver
 * (style/class changes), window scroll, and resize.
 *
 * @param target - Element to observe: Ref$, Observable<OpaqueObject<Element>|null>, Document, Window, or null
 * @param options - Configuration options
 * @returns Reactive mouse position values relative to the element, plus a manual `stop()` function
 *
 * @example
 * ```tsx
 * const el$ = useRef$<HTMLDivElement>();
 * const { elementX$, elementY$, isOutside$ } = useMouseInElement(el$);
 * return <div ref={el$} />;
 * ```
 */
export function useMouseInElement(
  target: MaybeElement,
  options?: DeepMaybeObservable<UseMouseInElementOptions>
): UseMouseInElementReturn {
  const opts$ = useMaybeObservable<UseMouseInElementOptions>(options);

  // Global mouse coordinates (exposed in return)
  const mouse$ = useObservable({ x: 0, y: 0 });

  // Element-relative state
  const state$ = useObservable({
    elementX: 0,
    elementY: 0,
    elementPositionX: 0,
    elementPositionY: 0,
    elementWidth: 0,
    elementHeight: 0,
    isOutside: true,
  });

  // Recalculate element-relative position from current mouse coords
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.set() does not create reactive subscription, empty deps [] is intentional
  const update = useCallback(() => {
    const el = peekElement(target) as HTMLElement | null;
    if (!el || !(el instanceof Element)) return;

    const rects = Array.from(el.getClientRects());
    if (!rects.length) return;

    const mx = mouse$.x.peek();
    const my = mouse$.y.peek();
    let found = false;

    for (const rect of rects) {
      if (mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom) {
        state$.assign({
          elementX: mx - rect.left,
          elementY: my - rect.top,
          elementPositionX: rect.left + window.scrollX,
          elementPositionY: rect.top + window.scrollY,
          elementWidth: rect.width,
          elementHeight: rect.height,
          isOutside: false,
        });
        found = true;
        break;
      }
    }

    if (!found) {
      state$.isOutside.set(true);
      if (opts$.handleOutside.peek() !== false) {
        const rect = rects[0];
        state$.assign({
          elementX: mx - rect.left,
          elementY: my - rect.top,
          elementPositionX: rect.left + window.scrollX,
          elementPositionY: rect.top + window.scrollY,
          elementWidth: rect.width,
          elementHeight: rect.height,
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update global mouse coords then recalculate
  const onMouseMove = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .assign()/.set() does not create reactive subscription, memoization is intentional
    (e: MouseEvent) => {
      mouse$.assign({ x: e.clientX, y: e.clientY });
      update();
    },
    [update] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Always call hooks unconditionally — Rules of Hooks.
  // null target → useEventListener registers no listener (no-op).
  // peek() — evaluated once at render time, no reactive subscription needed.
  const stopMouse = useEventListener(isWindow(win) ? win : null, "mousemove", onMouseMove, {
    passive: true,
  });

  // document mouseleave → force isOutside = true
  const stopLeave = useEventListener(defaultDocument, "mouseleave", () =>
    state$.isOutside.set(true)
  );

  const stopScroll = useEventListener(
    isWindow(win) && opts$.windowScroll.peek() !== false ? win : null,
    "scroll",
    update,
    { passive: true }
  );
  const stopResize = useEventListener(
    isWindow(win) && opts$.windowResize.peek() !== false ? win : null,
    "resize",
    update,
    { passive: true }
  );

  // Observe element size changes
  const { stop: stopRO } = useResizeObserver(target, update);

  // Observe style/class attribute changes (e.g. CSS transitions, class toggles)
  const { stop: stopMO } = useMutationObserver(target, update, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable stop functions, empty deps [] is intentional
  const stop = useCallback(() => {
    stopMouse();
    stopLeave();
    stopScroll();
    stopResize();
    stopRO();
    stopMO();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    elementX$: state$.elementX,
    elementY$: state$.elementY,
    elementPositionX$: state$.elementPositionX,
    elementPositionY$: state$.elementPositionY,
    elementWidth$: state$.elementWidth,
    elementHeight$: state$.elementHeight,
    isOutside$: state$.isOutside,
    x$: mouse$.x,
    y$: mouse$.y,
    stop,
  };
}
