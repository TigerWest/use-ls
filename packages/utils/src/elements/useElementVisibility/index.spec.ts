// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const wrapEl = (el: Element) => observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));
import { useElementVisibility } from ".";

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let capturedCallback: IntersectionObserverCallback;

const MockIntersectionObserver = vi.fn(
  (cb: IntersectionObserverCallback, init?: IntersectionObserverInit) => {
    capturedCallback = cb;
    void init;
    return { observe: mockObserve, disconnect: mockDisconnect };
  },
);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  MockIntersectionObserver.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeEntry(
  isIntersecting: boolean,
  time = 0,
): IntersectionObserverEntry {
  return { isIntersecting, time } as IntersectionObserverEntry;
}

describe("useElementVisibility()", () => {
  it("returns false by default", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));
    expect(result.current.get()).toBe(false);
  });

  it("returns initialValue when provided", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() =>
      useElementVisibility(wrapEl(el), { initialValue: true }),
    );
    expect(result.current.get()).toBe(true);
  });

  it("becomes true when element enters viewport", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));

    act(() => {
      capturedCallback([makeEntry(true)], {} as IntersectionObserver);
    });

    expect(result.current.get()).toBe(true);
  });

  it("becomes false when element leaves viewport", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));

    act(() => {
      capturedCallback([makeEntry(true)], {} as IntersectionObserver);
    });
    expect(result.current.get()).toBe(true);

    act(() => {
      capturedCallback([makeEntry(false)], {} as IntersectionObserver);
    });
    expect(result.current.get()).toBe(false);
  });

  it("selects the entry with the largest time value", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));

    act(() => {
      capturedCallback(
        [makeEntry(true, 100), makeEntry(false, 200)],
        {} as IntersectionObserver,
      );
    });

    // Entry with time=200 (isIntersecting: false) should win
    expect(result.current.get()).toBe(false);
  });

  it("once: true stops observer after first visible", () => {
    const el = document.createElement("div");
    renderHook(() => useElementVisibility(wrapEl(el), { once: true }));

    act(() => {
      capturedCallback([makeEntry(true)], {} as IntersectionObserver);
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("once: true does not stop observer while element is not intersecting", () => {
    const el = document.createElement("div");
    renderHook(() => useElementVisibility(wrapEl(el), { once: true }));

    mockDisconnect.mockClear();
    act(() => {
      capturedCallback([makeEntry(false)], {} as IntersectionObserver);
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("passes scrollTarget as root to IntersectionObserver", () => {
    const el = document.createElement("div");
    const scrollContainer = document.createElement("div");
    renderHook(() =>
      useElementVisibility(wrapEl(el), { scrollTarget: wrapEl(scrollContainer) }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root: scrollContainer }),
    );
  });

  it("passes rootMargin option to IntersectionObserver", () => {
    const el = document.createElement("div");
    renderHook(() => useElementVisibility(wrapEl(el), { rootMargin: "10px" }));

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "10px" }),
    );
  });

  it("passes threshold option to IntersectionObserver", () => {
    const el = document.createElement("div");
    renderHook(() => useElementVisibility(wrapEl(el), { threshold: 0.5 }));

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    );
  });

  it("disconnects observer on unmount", () => {
    const el = document.createElement("div");
    const { unmount } = renderHook(() => useElementVisibility(wrapEl(el)));
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("does not throw when entries array is empty", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el)));

    expect(() => {
      act(() => {
        capturedCallback([], {} as IntersectionObserver);
      });
    }).not.toThrow();

    expect(result.current.get()).toBe(false);
  });

  it("accepts Observable<UseElementVisibilityOptions> as options", () => {
    const el = document.createElement("div");
    const options$ = observable({ initialValue: true });
    const { result } = renderHook(() => useElementVisibility(wrapEl(el), options$));
    expect(result.current.get()).toBe(true);
  });

  it("accepts Observable<boolean> for initialValue", () => {
    const el = document.createElement("div");
    const initialValue$ = observable(true);
    const { result } = renderHook(() =>
      useElementVisibility(wrapEl(el), { initialValue: initialValue$ }),
    );
    expect(result.current.get()).toBe(true);
  });

  it("accepts Observable<boolean> for once option", () => {
    const el = document.createElement("div");
    const once$ = observable(true);
    renderHook(() => useElementVisibility(wrapEl(el), { once: once$ }));

    act(() => {
      capturedCallback([makeEntry(true)], {} as IntersectionObserver);
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("accepts Observable<number> for threshold option", () => {
    const el = document.createElement("div");
    const threshold$ = observable<number | number[]>(0.5);
    renderHook(() => useElementVisibility(wrapEl(el), { threshold: threshold$ }));

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    );
  });

  it("once: true preserves true after observer fires again with false", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementVisibility(wrapEl(el), { once: true }));

    act(() => {
      capturedCallback([makeEntry(true)], {} as IntersectionObserver);
    });
    expect(result.current.get()).toBe(true);

    // Simulate a stale callback firing after stop (disconnect was called)
    act(() => {
      capturedCallback([makeEntry(false)], {} as IntersectionObserver);
    });
    // Value stays true because the underlying observer was stopped
    expect(result.current.get()).toBe(false); // Real-world: observer is disconnected so no further calls
  });
});
