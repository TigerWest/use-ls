/**
 * useIntersectionObserver - Browser Mode Spec
 *
 * Runs in real Playwright Chromium (not jsdom).
 * Contains type-A tests only: real IntersectionObserver with actual DOM layout.
 * Type-B/C/D tests remain in index.spec.ts (jsdom).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useIntersectionObserver } from ".";

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
// useIntersectionObserver browser tests (Type-A only)
// ---------------------------------------------------------------------------

describe("useIntersectionObserver() — real browser", () => {
  it("fires callback with isIntersecting: true when element is in viewport", async () => {
    let lastEntries: IntersectionObserverEntry[] = [];

    renderHook(() =>
      useIntersectionObserver(wrapEl(el), (entries) => {
        lastEntries = entries;
      }),
    );

    await waitFor(
      () => {
        expect(lastEntries.length).toBeGreaterThan(0);
        expect(lastEntries.some((e) => e.isIntersecting)).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it("fires callback with isIntersecting: false when element is outside viewport", async () => {
    let lastEntries: IntersectionObserverEntry[] = [];

    // Position element far off-screen before observing
    el.style.top = "100000px";

    renderHook(() =>
      useIntersectionObserver(wrapEl(el), (entries) => {
        lastEntries = entries;
      }),
    );

    await waitFor(
      () => {
        expect(lastEntries.length).toBeGreaterThan(0);
        expect(lastEntries.every((e) => !e.isIntersecting)).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it("stop() disconnects real IntersectionObserver — no further callbacks after stop", async () => {
    let callCount = 0;

    const { result } = renderHook(() =>
      useIntersectionObserver(wrapEl(el), () => {
        callCount++;
      }),
    );

    // Wait for the initial IO callback (element is in viewport)
    await waitFor(() => expect(callCount).toBeGreaterThan(0), {
      timeout: 2000,
    });

    const countAfterInitial = callCount;

    // Disconnect the real IntersectionObserver
    result.current.stop();

    // Move element far off-screen to trigger an intersection change
    el.style.top = "100000px";

    // Yield two animation frames — callback must NOT fire again
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    expect(callCount).toBe(countAfterInitial);
    expect(result.current.isActive$.get()).toBe(false);
  });
});
