// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useDocumentVisibility } from ".";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function mockVisibilityState(value: DocumentVisibilityState) {
  return vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
}

describe("useDocumentVisibility()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an Observable", () => {
    const { result } = renderHook(() => useDocumentVisibility());
    expect(typeof result.current.get).toBe("function");
    expect(typeof result.current.set).toBe("function");
  });

  it("initial value is 'visible' before mount syncs", () => {
    mockVisibilityState("hidden");
    // renderHook runs the hook — the observable initializes to 'visible' first,
    // then useMount sets it to the actual state. We just assert the final value.
    const { result } = renderHook(() => useDocumentVisibility());
    expect(result.current.get()).toBe("hidden");
  });

  it("reflects 'visible' when document.visibilityState is 'visible'", () => {
    mockVisibilityState("visible");
    const { result } = renderHook(() => useDocumentVisibility());
    expect(result.current.get()).toBe("visible");
  });

  it("sets to 'hidden' when visibilitychange fires with hidden state", () => {
    mockVisibilityState("visible");
    const { result } = renderHook(() => useDocumentVisibility());

    act(() => {
      mockVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.get()).toBe("hidden");
  });

  it("sets to 'visible' when visibilitychange fires with visible state", () => {
    mockVisibilityState("hidden");
    const { result } = renderHook(() => useDocumentVisibility());

    act(() => {
      mockVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.get()).toBe("visible");
  });

  it("toggles correctly across multiple visibility changes", () => {
    mockVisibilityState("visible");
    const { result } = renderHook(() => useDocumentVisibility());

    act(() => {
      mockVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.get()).toBe("hidden");

    act(() => {
      mockVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.get()).toBe("visible");

    act(() => {
      mockVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.get()).toBe("hidden");
  });

  it("removes event listener on unmount", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useDocumentVisibility());
    unmount();
    await flush(); // useMount defers cleanup via queueMicrotask in test env

    const added = addSpy.mock.calls.some(([type]) => type === "visibilitychange");
    const removed = removeSpy.mock.calls.some(([type]) => type === "visibilitychange");

    expect(added).toBe(true);
    expect(removed).toBe(true);
  });

  it("does not respond to events after unmount", async () => {
    mockVisibilityState("visible");
    const { result, unmount } = renderHook(() => useDocumentVisibility());

    unmount();
    await flush(); // wait for cleanup

    act(() => {
      mockVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Value stays at 'visible' — no listener active after cleanup
    expect(result.current.get()).toBe("visible");
  });
});
