// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useWindowFocus } from ".";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("useWindowFocus()", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an Observable", () => {
    const { result } = renderHook(() => useWindowFocus());
    expect(typeof result.current.get).toBe("function");
    expect(typeof result.current.set).toBe("function");
  });

  it("initial value reflects document.hasFocus()", () => {
    const hasFocusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current.get()).toBe(true);
    hasFocusSpy.mockRestore();
  });

  it("initial value is false when document.hasFocus() returns false", () => {
    const hasFocusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current.get()).toBe(false);
    hasFocusSpy.mockRestore();
  });

  it("sets to true when window focus event fires", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { result } = renderHook(() => useWindowFocus());

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current.get()).toBe(true);
  });

  it("sets to false when window blur event fires", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { result } = renderHook(() => useWindowFocus());

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current.get()).toBe(false);
  });

  it("toggles correctly across multiple focus/blur events", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { result } = renderHook(() => useWindowFocus());

    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(result.current.get()).toBe(true);

    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(result.current.get()).toBe(false);

    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(result.current.get()).toBe(true);
  });

  it("removes event listeners on unmount", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useWindowFocus());
    unmount();
    await flush(); // useMount defers cleanup via queueMicrotask in test env

    const focusAdded = addSpy.mock.calls.some(([type]) => type === "focus");
    const blurAdded = addSpy.mock.calls.some(([type]) => type === "blur");
    const focusRemoved = removeSpy.mock.calls.some(([type]) => type === "focus");
    const blurRemoved = removeSpy.mock.calls.some(([type]) => type === "blur");

    expect(focusAdded).toBe(true);
    expect(blurAdded).toBe(true);
    expect(focusRemoved).toBe(true);
    expect(blurRemoved).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does not respond to events after unmount", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { result, unmount } = renderHook(() => useWindowFocus());

    unmount();
    await flush(); // wait for cleanup

    act(() => { window.dispatchEvent(new Event("focus")); });

    // Value stays at initial false — no listener active after cleanup
    expect(result.current.get()).toBe(false);
  });
});
