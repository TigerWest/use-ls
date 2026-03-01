/**
 * useDraggable - Browser Mode Spec
 *
 * Runs in real Playwright Chromium (not jsdom).
 * Contains type-A tests only: real PointerEvent + real DOM layout validation.
 * Type-B/C tests remain in index.spec.ts (jsdom).
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDraggable } from ".";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapEl = (el: Element) => observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

let el: HTMLDivElement;

beforeEach(() => {
  el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "100px",
    height: "100px",
  });
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.appendChild(el);
});

afterEach(() => {
  if (el.parentNode) document.body.removeChild(el);
  document.body.style.margin = "";
  document.body.style.padding = "";
});

function firePointerDown(
  target: EventTarget,
  clientX: number,
  clientY: number,
  pointerType = "mouse"
) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX,
        clientY,
        pointerType,
        bubbles: true,
        cancelable: true,
      })
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
      })
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
      })
    );
  });
}

// ---------------------------------------------------------------------------
// useDraggable browser tests
// ---------------------------------------------------------------------------

describe("useDraggable() — real browser", () => {
  it("pointerdown → pointermove → pointerup updates x$, y$, position$, style$", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el), { initialValue: { x: 0, y: 0 } }));

    firePointerDown(el, 10, 10); // pressedDelta = {x:10, y:10}
    firePointerMove(60, 80); // x=60-10=50, y=80-10=70
    firePointerUp();

    await waitFor(() => expect(result.current.x$.get()).toBe(50));
    expect(result.current.y$.get()).toBe(70);
    expect(result.current.position$.get()).toEqual({ x: 50, y: 70 });
    expect(result.current.style$.get()).toBe("left: 50px; top: 70px;");
  });

  it("isDragging$ is true during drag, false after pointerup", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el)));

    firePointerDown(el, 0, 0);
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(true));

    firePointerUp();
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(false));
  });

  it("onStart returning false cancels drag", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el), { onStart: () => false }));

    firePointerDown(el, 10, 10);
    firePointerMove(60, 80);

    await waitFor(() => expect(result.current.isDragging$.get()).toBe(false));
    expect(result.current.x$.get()).toBe(0);
    expect(result.current.y$.get()).toBe(0);
  });

  it("onStart, onMove, onEnd callbacks are called with correct args", async () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();

    renderHook(() => useDraggable(wrapEl(el), { onStart, onMove, onEnd }));

    // element at position:absolute left:0 top:0, body margin:0
    // getBoundingClientRect().left=0, top=0 → onStart receives {x:0, y:0}
    firePointerDown(el, 10, 10); // pressedDelta={x:10,y:10}, onStart({x:0,y:0})
    firePointerMove(50, 60); // x=50-10=40, y=60-10=50, onMove({x:40,y:50})
    firePointerUp(50, 60); // onEnd({x:40,y:50})

    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][0]).toEqual({ x: 0, y: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toEqual({ x: 40, y: 50 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0]).toEqual({ x: 40, y: 50 });
  });

  it("containerElement clamps drag to container bounds", async () => {
    el.style.width = "50px";
    el.style.height = "50px";

    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "200px",
      height: "200px",
    });
    document.body.appendChild(container);

    const { result } = renderHook(() =>
      useDraggable(wrapEl(el), {
        containerElement: observable<OpaqueObject<Element> | null>(
          ObservableHint.opaque(container)
        ),
      })
    );

    firePointerDown(el, 0, 0); // pressedDelta={x:0,y:0}
    firePointerMove(300, 300); // exceeds container → clamped to 200-50=150

    await waitFor(() => expect(result.current.x$.get()).toBe(150));
    expect(result.current.y$.get()).toBe(150);

    document.body.removeChild(container);
  });

  it("restrictInView clamps drag to viewport (dynamic viewport reference)", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el), { restrictInView: true }));

    firePointerDown(el, 0, 0); // pressedDelta={x:0,y:0}
    firePointerMove(9999, 9999); // far exceeds viewport

    await waitFor(() => expect(result.current.x$.get()).toBe(window.innerWidth - 100));
    expect(result.current.y$.get()).toBe(window.innerHeight - 100);
  });

  it("pointerTypes filter — touch ignored when only mouse allowed", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el), { pointerTypes: ["mouse"] }));

    // touch pointerdown — should be ignored
    firePointerDown(el, 10, 10, "touch");
    expect(result.current.isDragging$.get()).toBe(false);

    // mouse pointerdown — should work
    firePointerDown(el, 10, 10, "mouse");
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(true));
  });

  it("pointermove on window tracks drag even when outside element", async () => {
    const { result } = renderHook(() => useDraggable(wrapEl(el)));

    firePointerDown(el, 0, 0);
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(true));

    // Move via window event (outside element bounds)
    firePointerMove(100, 100);
    expect(result.current.isDragging$.get()).toBe(true);
    expect(result.current.x$.get()).toBe(100);

    firePointerUp();
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(false));
  });

  it("unmount removes event listeners — state unchanged after unmount", async () => {
    const { result, unmount } = renderHook(() => useDraggable(wrapEl(el)));

    firePointerDown(el, 0, 0);
    await waitFor(() => expect(result.current.isDragging$.get()).toBe(true));

    unmount();
    await Promise.resolve();

    // After unmount, window pointermove should not update state
    firePointerMove(100, 100);
    expect(result.current.x$.get()).toBe(0);
    expect(result.current.y$.get()).toBe(0);
  });
});
