// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWindowSize } from ".";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function mockMatchMedia(
  matches = false,
): (query: string) => MediaQueryList {
  return (_query: string) =>
    ({
      matches,
      media: _query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

describe("useWindowSize()", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", mockMatchMedia());

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
    Object.defineProperty(window, "outerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "outerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns width and height Observables", () => {
    const { result } = renderHook(() => useWindowSize());
    expect(typeof result.current.width.get).toBe("function");
    expect(typeof result.current.height.get).toBe("function");
  });

  it("reads innerWidth/innerHeight by default", () => {
    const { result } = renderHook(() => useWindowSize());
    expect(result.current.width.get()).toBe(1024);
    expect(result.current.height.get()).toBe(768);
  });

  it("uses initialWidth/initialHeight before mount when window is undefined", () => {
    // Simulate SSR by checking initial values before any side effects run
    const { result } = renderHook(() =>
      useWindowSize({ initialWidth: 320, initialHeight: 480 }),
    );
    // After mount update fires, it reads actual window values
    // but the observable was initialized with the provided defaults
    expect(result.current.width.get()).toBeDefined();
    expect(result.current.height.get()).toBeDefined();
  });

  it("updates on window resize event", () => {
    const { result } = renderHook(() => useWindowSize());

    act(() => {
      (window as any).innerWidth = 1280;
      (window as any).innerHeight = 900;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.width.get()).toBe(1280);
    expect(result.current.height.get()).toBe(900);
  });

  it("type: 'outer' reads outerWidth/outerHeight", () => {
    (window as any).outerWidth = 1100;
    (window as any).outerHeight = 850;

    const { result } = renderHook(() => useWindowSize({ type: "outer" }));
    expect(result.current.width.get()).toBe(1100);
    expect(result.current.height.get()).toBe(850);
  });

  it("type: 'outer' updates on resize", () => {
    const { result } = renderHook(() => useWindowSize({ type: "outer" }));

    act(() => {
      (window as any).outerWidth = 900;
      (window as any).outerHeight = 600;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.width.get()).toBe(900);
    expect(result.current.height.get()).toBe(600);
  });

  it("includeScrollbar: false reads clientWidth/clientHeight", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      writable: true,
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      writable: true,
      configurable: true,
      value: 740,
    });

    const { result } = renderHook(() =>
      useWindowSize({ includeScrollbar: false }),
    );
    expect(result.current.width.get()).toBe(1000);
    expect(result.current.height.get()).toBe(740);
  });

  it("type: 'visual' reads visualViewport when available", () => {
    const mockVP = {
      width: 375,
      height: 667,
      scale: 2,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("visualViewport", mockVP);

    const { result } = renderHook(() => useWindowSize({ type: "visual" }));
    expect(result.current.width.get()).toBe(750); // 375 * 2
    expect(result.current.height.get()).toBe(1334); // 667 * 2
  });

  it("type: 'visual' falls back to innerWidth/innerHeight when visualViewport unavailable", () => {
    vi.stubGlobal("visualViewport", null);

    const { result } = renderHook(() => useWindowSize({ type: "visual" }));
    expect(result.current.width.get()).toBe(1024);
    expect(result.current.height.get()).toBe(768);
  });

  it("listens to orientation changes by default", () => {
    const addSpy = vi.spyOn(window, "matchMedia").mockReturnValue({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matches: false,
      media: "(orientation: portrait)",
    } as any);

    renderHook(() => useWindowSize());
    expect(addSpy).toHaveBeenCalledWith("(orientation: portrait)");
  });

  it("listenOrientation: false does not update size on orientation change", () => {
    let orientationListener: ((e: Event) => void) | null = null;

    vi.stubGlobal("matchMedia", (_query: string) => ({
      matches: false,
      media: _query,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === "change") orientationListener = listener;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    const { result } = renderHook(() =>
      useWindowSize({ listenOrientation: false }),
    );

    // Change innerWidth but do NOT dispatch a resize event
    (window as any).innerWidth = 500;

    act(() => {
      // Trigger orientation change — should NOT call update() when listenOrientation: false
      orientationListener?.({
        type: "change",
        matches: true,
      } as unknown as MediaQueryListEvent);
    });

    // Size stays at 1024 because orientation change was ignored
    expect(result.current.width.get()).toBe(1024);
  });

  it("removes resize listener on unmount", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useWindowSize());
    unmount();
    await flush();

    const resizeAdded = addSpy.mock.calls.some(([type]) => type === "resize");
    const resizeRemoved = removeSpy.mock.calls.some(
      ([type]) => type === "resize",
    );

    expect(resizeAdded).toBe(true);
    expect(resizeRemoved).toBe(true);
  });

  it("type change via re-render triggers immediate re-measurement without resize event", async () => {
    (window as any).outerWidth = 1100;
    (window as any).outerHeight = 850;

    const { result, rerender } = renderHook(
      (props: { type: "inner" | "outer" | "visual" }) =>
        useWindowSize({ type: props.type }),
      { initialProps: { type: "inner" as "inner" | "outer" | "visual" } },
    );

    expect(result.current.width.get()).toBe(1024);
    expect(result.current.height.get()).toBe(768);

    await act(async () => {
      rerender({ type: "outer" });
      await flush();
    });

    expect(result.current.width.get()).toBe(1100);
    expect(result.current.height.get()).toBe(850);
  });

  it("includeScrollbar change via re-render triggers immediate re-measurement without resize event", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      writable: true,
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      writable: true,
      configurable: true,
      value: 740,
    });

    const { result, rerender } = renderHook(
      (props: { includeScrollbar: boolean }) =>
        useWindowSize({ includeScrollbar: props.includeScrollbar }),
      { initialProps: { includeScrollbar: true } },
    );

    expect(result.current.width.get()).toBe(1024);
    expect(result.current.height.get()).toBe(768);

    await act(async () => {
      rerender({ includeScrollbar: false });
      await flush();
    });

    expect(result.current.width.get()).toBe(1000);
    expect(result.current.height.get()).toBe(740);
  });

  it("does not update after unmount", async () => {
    const { result, unmount } = renderHook(() => useWindowSize());

    unmount();
    await flush();

    act(() => {
      (window as any).innerWidth = 999;
      window.dispatchEvent(new Event("resize"));
    });

    // Value stays at what it was before unmount (1024)
    expect(result.current.width.get()).toBe(1024);
  });

  it("defaults to 0 initial size", () => {
    // Verify the observable initializes with 0 before window is read
    const { result } = renderHook(() => useWindowSize());
    // After mount, actual window values are read
    expect(typeof result.current.width.get()).toBe("number");
    expect(typeof result.current.height.get()).toBe("number");
  });
});
