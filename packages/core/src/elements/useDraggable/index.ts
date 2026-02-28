"use client";
import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useRef } from "react";
import { useMayObservableOptions } from "../../function/useMayObservableOptions";
import type { DeepMaybeObservable } from "../../types";
import { type MaybeElement, peekElement } from "../useRef$";
import { useEventListener } from "../../browser/useEventListener";
import { defaultWindow } from "../../shared/configurable";

export interface Position {
  x: number;
  y: number;
}

export interface UseDraggableOptions {
  /** Only start drag if pointerdown target exactly matches the element. Default: false */
  exact?: boolean;
  /** Call preventDefault on pointer events. Default: false */
  preventDefault?: boolean;
  /** Call stopPropagation on pointer events. Default: false */
  stopPropagation?: boolean;
  /** Use capture phase for pointerdown. Default: false */
  capture?: boolean;
  /** Restrict drag to a specific handle element */
  handle?: MaybeElement;
  /** Clamp drag position inside this container element */
  containerElement?: MaybeElement;
  /** Initial position. Read once at mount time. Default: { x: 0, y: 0 } */
  initialValue?: Position;
  /** Called on drag start. Return false to cancel. */
  onStart?: (position: Position, event: PointerEvent) => void | false;
  /** Called on each drag move */
  onMove?: (position: Position, event: PointerEvent) => void;
  /** Called on drag end */
  onEnd?: (position: Position, event: PointerEvent) => void;
  /** Restrict movement axis. Default: 'both' */
  axis?: "x" | "y" | "both";
  /** Disable dragging */
  disabled?: boolean;
  /** Filter by pointer type. Default: all types allowed */
  pointerTypes?: Array<"mouse" | "pen" | "touch">;
  /** Clamp drag position inside the viewport. Default: false */
  restrictInView?: boolean;
}

export interface UseDraggableReturn {
  /** Current X position */
  x$: Observable<number>;
  /** Current Y position */
  y$: Observable<number>;
  /** Current position as { x, y } */
  position$: Observable<Position>;
  /** Whether currently dragging */
  isDragging$: Observable<boolean>;
  /** CSS position string: "left: Xpx; top: Ypx;" */
  style$: Observable<string>;
}

/**
 * Makes any element draggable using Pointer Events.
 * Returns Observable values for position (`x$`, `y$`), drag state (`isDragging$`),
 * and a ready-to-use CSS style string (`style$`).
 *
 * @param target - Element to make draggable: Ref$, Observable<OpaqueObject<Element>|null>, Document, Window, or null
 * @param options - Configuration options (supports DeepMaybeObservable — each field can be an Observable)
 * @returns Reactive position values and drag state
 *
 * @example
 * ```tsx
 * const el$ = useRef$<HTMLDivElement>()
 * const { style$ } = useDraggable(el$)
 * return <div ref={el$} style={{ position: 'fixed', ...parseStyle(style$.get()) }}>Drag me</div>
 * ```
 */
export function useDraggable(
  target: MaybeElement,
  options?: DeepMaybeObservable<UseDraggableOptions>,
): UseDraggableReturn {
  // Normalize options — per-field resolution hints
  const opts$ = useMayObservableOptions<UseDraggableOptions>(options, {
    // mount-time only: read once, no reactive dep
    initialValue: "peek",
    // MaybeElement fields: reactive + OpaqueObject wrapping
    handle: "get.element",
    containerElement: "get.element",
    // callback fields: function hint to prevent deep observation
    onStart: "get.function",
    onMove: "get.function",
    onEnd: "get.function",
    // remaining fields default to 'get' (auto-deref)
  });

  // State: Rule 3 — initialValue is peek (mount-time only)
  const initial = opts$.initialValue.peek() ?? { x: 0, y: 0 };
  const state$ = useObservable({
    x: initial.x,
    y: initial.y,
    isDragging: false,
  });

  // Derived computed observables — Legend-State v3: useObservable(fn)
  const position$ = useObservable<Position>(() => ({
    x: state$.x.get(),
    y: state$.y.get(),
  }));

  const style$ = useObservable<string>(
    () => `left: ${state$.x.get()}px; top: ${state$.y.get()}px;`,
  );

  // pressedDelta: offset from element top-left at drag start (plain React ref)
  const pressedDelta = useRef<Position | null>(null);

  // pointerdown on handle (or target)
  const onPointerDown = useCallback((e: PointerEvent) => {
    if (opts$.disabled.peek()) return;

    const el = peekElement(target) as HTMLElement | null;
    if (!el) return;
    if (opts$.exact.peek() && e.target !== el) return;

    const pointerTypes = opts$.pointerTypes.peek();
    if (pointerTypes && !pointerTypes.includes(e.pointerType as "mouse" | "pen" | "touch")) return;

    if (opts$.preventDefault.peek()) e.preventDefault();
    if (opts$.stopPropagation.peek()) e.stopPropagation();

    const rect = el.getBoundingClientRect();
    const pos: Position = { x: rect.left, y: rect.top };

    if (opts$.peek()?.onStart?.(pos, e) === false) return;

    // Store (mouseX - cssLeft) so that onPointerMove gives: mouseX - delta = cssLeft + mouseDelta
    // Using state$.x.peek() (CSS position) rather than rect.left (viewport position) makes
    // the hook work correctly for any CSS positioning context (absolute, fixed, relative, etc.)
    pressedDelta.current = {
      x: e.clientX - state$.x.peek(),
      y: e.clientY - state$.y.peek(),
    };
    state$.isDragging.set(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // pointermove on window — tracks drag even outside element bounds
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!pressedDelta.current) return;
    if (opts$.preventDefault.peek()) e.preventDefault();

    let x = e.clientX - pressedDelta.current.x;
    let y = e.clientY - pressedDelta.current.y;

    // axis restriction
    const axis = opts$.axis.peek();
    if (axis === "x") y = state$.y.peek();
    if (axis === "y") x = state$.x.peek();

    // container boundary clamping
    const container = opts$.containerElement.peek() as HTMLElement | null;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = (peekElement(target) as HTMLElement)?.getBoundingClientRect();
      if (elRect) {
        x = Math.max(containerRect.left, Math.min(x, containerRect.right - elRect.width));
        y = Math.max(containerRect.top, Math.min(y, containerRect.bottom - elRect.height));
      }
    }

    // viewport restriction
    if (opts$.restrictInView.peek()) {
      const elRect = (peekElement(target) as HTMLElement)?.getBoundingClientRect();
      if (elRect) {
        x = Math.max(0, Math.min(x, window.innerWidth - elRect.width));
        y = Math.max(0, Math.min(y, window.innerHeight - elRect.height));
      }
    }

    state$.assign({ x, y });
    opts$.peek()?.onMove?.({ x, y }, e);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // pointerup on window
  const onPointerUp = useCallback((e: PointerEvent) => {
    if (!pressedDelta.current) return;
    pressedDelta.current = null;
    const pos: Position = { x: state$.x.peek(), y: state$.y.peek() };
    state$.isDragging.set(false);
    opts$.peek()?.onEnd?.(pos, e);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine pointerdown target: handle if specified (mount-time), otherwise target.
  // Pass MaybeElement directly so useEventListener's isRef$ branch fires correctly
  // for Ref$ targets. Wrapping Ref$ inside an Observable causes useEventListener to
  // call .get() and receive the Ref$ function, which has no addEventListener.
  const pointerdownTarget: MaybeElement =
    opts$.handle.peek() != null
      ? (opts$.handle as unknown as MaybeElement)
      : target;

  // Register pointerdown on handle (or target), pointermove/up on window
  useEventListener(pointerdownTarget, "pointerdown", onPointerDown, {
    capture: opts$.capture.peek() ?? false,
  });

  useEventListener(
    defaultWindow,
    "pointermove",
    onPointerMove,
  );

  useEventListener(
    defaultWindow,
    "pointerup",
    onPointerUp,
  );

  return {
    x$: state$.x,
    y$: state$.y,
    position$,
    isDragging$: state$.isDragging,
    style$,
  };
}
