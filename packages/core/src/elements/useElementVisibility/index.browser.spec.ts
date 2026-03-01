/**
 * useElementVisibility - Browser Mode Spec
 *
 * Runs in real Playwright Chromium (not jsdom).
 * Contains type-A tests only: real IntersectionObserver with actual DOM layout.
 * Type-B/C/D tests remain in index.spec.ts (jsdom).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useElementVisibility } from ".";

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
// useElementVisibility browser tests (Type-A only)
// ---------------------------------------------------------------------------

describe("useElementVisibility() — real browser", () => {
  it("isVisible$ becomes true when element is in viewport", async () => {
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));

    await waitFor(() => expect(result.current.get()).toBe(true), {
      timeout: 2000,
    });
  });

  it("once: true — isVisible$ stays true after element moves out of viewport", async () => {
    const { result } = renderHook(() =>
      useElementVisibility(wrapEl(el), { once: true }),
    );

    // Wait for element to become visible (real IO fires)
    await waitFor(() => expect(result.current.get()).toBe(true), {
      timeout: 2000,
    });

    // Move element off-screen — observer should already be disconnected by once: true
    el.style.top = "100000px";

    // Yield two animation frames to give IO a chance to fire (if broken)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    // isVisible$ must remain true because the observer was disconnected after first visibility
    expect(result.current.get()).toBe(true);
  });
});
