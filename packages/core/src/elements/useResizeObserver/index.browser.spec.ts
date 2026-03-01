/**
 * useResizeObserver - Browser Mode Spec
 *
 * Runs in real Playwright Chromium (not jsdom).
 * Contains type-A tests only: real ResizeObserver with actual DOM layout.
 * Type-B/C/D tests remain in index.spec.ts (jsdom).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useResizeObserver } from ".";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapEl = (el: Element) =>
  observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

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

// ---------------------------------------------------------------------------
// useResizeObserver browser tests
// ---------------------------------------------------------------------------

describe("useResizeObserver() — real browser", () => {
  it("fires callback when element is actually resized", async () => {
    let callCount = 0;

    renderHook(() =>
      useResizeObserver(wrapEl(el), () => {
        callCount++;
      }),
    );

    // Wait for initial observation to complete
    await waitFor(() => expect(callCount).toBeGreaterThan(0), {
      timeout: 2000,
    });

    const countAfterInitial = callCount;

    // Trigger a real resize
    el.style.width = "200px";

    await waitFor(() => expect(callCount).toBeGreaterThan(countAfterInitial), {
      timeout: 2000,
    });
  });

  it("contentRect values reflect actual element dimensions", async () => {
    const capturedRects: { width: number; height: number }[] = [];

    renderHook(() =>
      useResizeObserver(wrapEl(el), (entries) => {
        for (const entry of entries) {
          capturedRects.push({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }),
    );

    // Wait for initial observation (100×100)
    await waitFor(() => expect(capturedRects.length).toBeGreaterThan(0), {
      timeout: 2000,
    });

    // Resize to new dimensions
    el.style.width = "150px";
    el.style.height = "80px";

    // Wait for contentRect to reflect new size
    await waitFor(
      () => {
        const last = capturedRects.at(-1)!;
        expect(last.width).toBe(150);
        expect(last.height).toBe(80);
      },
      { timeout: 2000 },
    );
  });

  it("callback stops firing after unmount (real ResizeObserver disconnect)", async () => {
    let callCount = 0;

    const { unmount } = renderHook(() =>
      useResizeObserver(wrapEl(el), () => {
        callCount++;
      }),
    );

    // Wait for initial observation to confirm observer is active
    await waitFor(() => expect(callCount).toBeGreaterThan(0), {
      timeout: 2000,
    });

    const countAtUnmount = callCount;

    // Unmount triggers cleanup → real ResizeObserver.disconnect()
    unmount();

    // Resize after disconnect — callback must NOT fire
    el.style.width = "300px";

    // Yield 2 animation frames to give ResizeObserver a chance to fire (if broken)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    expect(callCount).toBe(1);
    expect(callCount).toBe(countAtUnmount);
  });
});
