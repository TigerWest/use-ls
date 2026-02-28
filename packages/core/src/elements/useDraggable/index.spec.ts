// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDraggable } from ".";

// ---------------------------------------------------------------------------
// jsdom PointerEvent polyfill
// ---------------------------------------------------------------------------
class PointerEventPolyfill extends MouseEvent {
  pointerType: string;
  pointerId: number;
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params as MouseEventInit);
    this.pointerType = params.pointerType ?? "mouse";
    this.pointerId = params.pointerId ?? 0;
  }
}
if (typeof window !== "undefined" && !window.PointerEvent) {
  (global as any).PointerEvent = PointerEventPolyfill;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapEl = (el: Element) =>
  observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

/**
 * Create a div whose getBoundingClientRect() returns the given rect.
 * Defaults: left=0, top=0, right=100, bottom=100, width=100, height=100
 */
function createDiv(rect: Partial<DOMRect> = {}) {
  const div = document.createElement("div");
  const full: DOMRect = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  };
  vi.spyOn(div, "getBoundingClientRect").mockReturnValue(full);
  return div;
}

function firePointerDown(
  target: EventTarget,
  clientX: number,
  clientY: number,
  pointerType = "mouse",
) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX,
        clientY,
        pointerType,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function firePointerMove(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

function firePointerUp(clientX = 0, clientY = 0) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX,
        clientY,
        bubbles: true,
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// useDraggable tests
// ---------------------------------------------------------------------------

describe("useDraggable()", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 600,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TC-01: basic drag position update
  it("TC-01: pointerdown → pointermove → pointerup updates x$, y$, position$, style$", () => {
    const div = createDiv({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 });
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { initialValue: { x: 0, y: 0 } }),
    );

    firePointerDown(div, 10, 10); // delta = (10, 10)
    firePointerMove(60, 80);      // x = 60-10=50, y = 80-10=70
    firePointerUp();

    expect(result.current.x$.get()).toBe(50);
    expect(result.current.y$.get()).toBe(70);
    expect(result.current.position$.get()).toEqual({ x: 50, y: 70 });
    expect(result.current.style$.get()).toBe("left: 50px; top: 70px;");
  });

  // TC-02: isDragging$ state transitions
  it("TC-02: isDragging$ is true during drag, false after pointerup", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDraggable(wrapEl(div) as any));

    firePointerDown(div, 0, 0);
    expect(result.current.isDragging$.get()).toBe(true);

    firePointerUp();
    expect(result.current.isDragging$.get()).toBe(false);
  });

  // TC-03: initialValue
  it("TC-03: initialValue sets initial x$, y$, style$", () => {
    const div = createDiv();
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { initialValue: { x: 200, y: 150 } }),
    );

    expect(result.current.x$.get()).toBe(200);
    expect(result.current.y$.get()).toBe(150);
    expect(result.current.style$.get()).toBe("left: 200px; top: 150px;");
  });

  // TC-04: axis 'x' — y frozen
  it("TC-04: axis 'x' — y stays at initialValue", () => {
    const div = createDiv({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { axis: "x", initialValue: { x: 0, y: 0 } }),
    );

    firePointerDown(div, 10, 10);
    firePointerMove(60, 80);

    expect(result.current.x$.get()).toBe(50); // moved
    expect(result.current.y$.get()).toBe(0);  // frozen
  });

  // TC-05: axis 'y' — x frozen
  it("TC-05: axis 'y' — x stays at initialValue", () => {
    const div = createDiv({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { axis: "y", initialValue: { x: 0, y: 0 } }),
    );

    firePointerDown(div, 10, 10);
    firePointerMove(60, 80);

    expect(result.current.x$.get()).toBe(0);  // frozen
    expect(result.current.y$.get()).toBe(70); // moved
  });

  // TC-06: disabled: true
  it("TC-06: disabled: true — pointerdown is ignored", () => {
    const div = createDiv();
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { disabled: true }),
    );

    firePointerDown(div, 10, 10);
    firePointerMove(60, 80);

    expect(result.current.x$.get()).toBe(0);
    expect(result.current.y$.get()).toBe(0);
    expect(result.current.isDragging$.get()).toBe(false);
  });

  // TC-07: disabled Observable — dynamic disable
  it("TC-07: disabled Observable — second drag is blocked after set(true)", () => {
    const div = createDiv();
    const disabled$ = observable(false);
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { disabled: disabled$ }),
    );

    // First drag — should work
    firePointerDown(div, 10, 10);
    firePointerMove(60, 80);
    firePointerUp();
    expect(result.current.isDragging$.get()).toBe(false);
    const xAfterFirst = result.current.x$.get();
    expect(xAfterFirst).toBe(50);

    // Disable
    act(() => disabled$.set(true));

    // Second drag — should be blocked
    firePointerDown(div, 10, 10);
    firePointerMove(100, 100);

    expect(result.current.isDragging$.get()).toBe(false);
    expect(result.current.x$.get()).toBe(xAfterFirst); // unchanged
  });

  // TC-08: onStart returning false cancels drag
  it("TC-08: onStart returning false cancels drag", () => {
    const div = createDiv();
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { onStart: () => false }),
    );

    firePointerDown(div, 10, 10);
    firePointerMove(60, 80);

    expect(result.current.isDragging$.get()).toBe(false);
    expect(result.current.x$.get()).toBe(0);
    expect(result.current.y$.get()).toBe(0);
  });

  // TC-09: onStart / onMove / onEnd callbacks
  it("TC-09: onStart, onMove, onEnd callbacks are called with correct args", () => {
    const div = createDiv({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();

    renderHook(() =>
      useDraggable(wrapEl(div) as any, { onStart, onMove, onEnd }),
    );

    firePointerDown(div, 10, 10);  // rect.left=0, rect.top=0 → pos = {x:0, y:0}
    firePointerMove(50, 60);       // x=50-10=40, y=60-10=50
    firePointerUp(50, 60);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0]).toEqual({ x: 0, y: 0 }); // rect.left, rect.top
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toEqual({ x: 40, y: 50 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0]).toEqual({ x: 40, y: 50 });
  });

  // TC-10: containerElement boundary clamping
  it("TC-10: containerElement clamps drag to container bounds", () => {
    const div = createDiv({ left: 0, top: 0, right: 50, bottom: 50, width: 50, height: 50 });
    const container = document.createElement("div");
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 200,
      width: 200, height: 200, x: 0, y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, {
        containerElement: observable(ObservableHint.opaque(container)) as any,
      }),
    );

    firePointerDown(div, 0, 0); // delta = (0, 0)
    firePointerMove(300, 300);  // exceeds container → clamped to 200-50=150

    expect(result.current.x$.get()).toBe(150);
    expect(result.current.y$.get()).toBe(150);
  });

  // TC-11: restrictInView viewport clamping
  it("TC-11: restrictInView clamps drag to viewport", () => {
    // window.innerWidth=800, window.innerHeight=600 (set in beforeEach)
    const div = createDiv({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 });
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { restrictInView: true }),
    );

    firePointerDown(div, 0, 0); // delta = (0, 0)
    firePointerMove(900, 700);  // exceeds viewport

    expect(result.current.x$.get()).toBe(700); // 800 - 100
    expect(result.current.y$.get()).toBe(500); // 600 - 100
  });

  // TC-12: pointerTypes filter
  it("TC-12: pointerTypes filter — touch ignored when only mouse allowed", () => {
    const div = createDiv();
    const { result } = renderHook(() =>
      useDraggable(wrapEl(div) as any, { pointerTypes: ["mouse"] }),
    );

    // touch pointerdown — should be ignored
    firePointerDown(div, 10, 10, "touch");
    expect(result.current.isDragging$.get()).toBe(false);

    // mouse pointerdown — should work
    firePointerDown(div, 10, 10, "mouse");
    expect(result.current.isDragging$.get()).toBe(true);
  });

  // TC-15: pointermove on window tracks drag outside element
  it("TC-15: pointermove on window tracks drag even when outside element", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDraggable(wrapEl(div) as any));

    firePointerDown(div, 0, 0);
    expect(result.current.isDragging$.get()).toBe(true);

    // Move via window event (outside element)
    firePointerMove(100, 100);
    expect(result.current.isDragging$.get()).toBe(true);
    expect(result.current.x$.get()).toBe(100);

    firePointerUp();
    expect(result.current.isDragging$.get()).toBe(false);
  });

  // TC-16: unmount cleans up listeners
  it("TC-16: unmount removes event listeners", () => {
    const div = createDiv();
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useDraggable(wrapEl(div) as any));

    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });

  // TC-17: direct x$/y$ set updates style$ and position$
  it("TC-17: x$.set() / y$.set() reactively updates style$ and position$", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDraggable(wrapEl(div) as any));

    act(() => {
      result.current.x$.set(50);
      result.current.y$.set(75);
    });

    expect(result.current.style$.get()).toBe("left: 50px; top: 75px;");
    expect(result.current.position$.get()).toEqual({ x: 50, y: 75 });
  });

  // No-op: null target should not throw
  it("does not throw when target is null", () => {
    expect(() => {
      renderHook(() => useDraggable(null as any));
    }).not.toThrow();
  });

  // pointermove without prior pointerdown is a no-op
  it("pointermove without pointerdown does not change state", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDraggable(wrapEl(div) as any));

    firePointerMove(100, 100);

    expect(result.current.x$.get()).toBe(0);
    expect(result.current.y$.get()).toBe(0);
    expect(result.current.isDragging$.get()).toBe(false);
  });
});
