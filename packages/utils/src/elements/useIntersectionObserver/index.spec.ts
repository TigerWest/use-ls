// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useIntersectionObserver } from ".";
import { useEl$ } from "../useEl$";

const wrapEl = (el: Element) => observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let capturedCallback: IntersectionObserverCallback;

const MockIntersectionObserver = vi.fn(
  (cb: IntersectionObserverCallback, init?: IntersectionObserverInit) => {
    capturedCallback = cb;
    void init; // captured for assertion via toHaveBeenCalledWith
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

describe("useIntersectionObserver()", () => {
  it("creates observer and observes target on mount", () => {
    const el = document.createElement("div");
    renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(mockObserve).toHaveBeenCalledWith(el);
  });

  it("isSupported is true when IntersectionObserver is available", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    expect(result.current.isSupported.get()).toBe(true);
  });

  it("isActive is true by default", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    expect(result.current.isActive.get()).toBe(true);
  });

  it("does not start observer when immediate is false", () => {
    const el = document.createElement("div");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { immediate: false }),
    );

    expect(MockIntersectionObserver).not.toHaveBeenCalled();
  });

  it("isActive is false when immediate is false", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { immediate: false }),
    );

    expect(result.current.isActive.get()).toBe(false);
  });

  it("pause() disconnects observer and sets isActive to false", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    act(() => {
      result.current.pause();
    });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(result.current.isActive.get()).toBe(false);
  });

  it("resume() restarts the observer after pause", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    act(() => result.current.pause());

    mockObserve.mockClear();
    MockIntersectionObserver.mockClear();

    act(() => result.current.resume());

    expect(result.current.isActive.get()).toBe(true);
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(mockObserve).toHaveBeenCalledWith(el);
  });

  it("stop() permanently stops the observer", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    act(() => result.current.stop());

    expect(mockDisconnect).toHaveBeenCalled();
    expect(result.current.isActive.get()).toBe(false);
  });

  it("resume() has no effect after stop()", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    act(() => result.current.stop());
    MockIntersectionObserver.mockClear();

    act(() => result.current.resume());

    expect(MockIntersectionObserver).not.toHaveBeenCalled();
  });

  it("observes multiple targets passed as array", () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    renderHook(() => useIntersectionObserver([wrapEl(el1), wrapEl(el2)], vi.fn()));

    expect(mockObserve).toHaveBeenCalledWith(el1);
    expect(mockObserve).toHaveBeenCalledWith(el2);
  });

  it("works with Observable<OpaqueObject<Element>> target", () => {
    const el = document.createElement("div");
    renderHook(() => useIntersectionObserver(wrapEl(el), vi.fn()));

    expect(mockObserve).toHaveBeenCalledWith(el);
  });

  it("skips null targets without throwing", () => {
    const el$ = observable<OpaqueObject<Element> | null>(null);
    expect(() =>
      renderHook(() => useIntersectionObserver(el$, vi.fn())),
    ).not.toThrow();
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("works with El$ target", () => {
    const div = document.createElement("div");
    const { result } = renderHook(() => {
      const el$ = useEl$<Element>();
      return { el$, io: useIntersectionObserver(el$, vi.fn()) };
    });

    // Before assignment — observe not yet called
    expect(mockObserve).not.toHaveBeenCalled();

    // Assign element via act after mount
    act(() => result.current.el$(div));

    // After assignment — observer must have been called with the element
    expect(mockObserve).toHaveBeenCalledWith(div);
    expect(result.current.io.isSupported.get()).toBe(true);
  });

  it("passes threshold option to IntersectionObserver", () => {
    const el = document.createElement("div");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { threshold: 0.5 }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    );
  });

  it("passes rootMargin option to IntersectionObserver", () => {
    const el = document.createElement("div");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { rootMargin: "10px" }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "10px" }),
    );
  });

  it("passes Observable rootMargin to IntersectionObserver", () => {
    const el = document.createElement("div");
    const rootMargin$ = observable("20px");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { rootMargin: rootMargin$ }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "20px" }),
    );
  });

  it("reactively recreates observer when Observable rootMargin changes", () => {
    const el = document.createElement("div");
    const rootMargin$ = observable("0px");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { rootMargin: rootMargin$ }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    mockDisconnect.mockClear();
    MockIntersectionObserver.mockClear();

    act(() => {
      rootMargin$.set("10px");
    });

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "10px" }),
    );
  });

  it("disconnects observer on unmount", () => {
    const el = document.createElement("div");
    const { unmount } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("isSupported is false when IntersectionObserver is not available", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    expect(result.current.isSupported.get()).toBe(false);
    expect(MockIntersectionObserver).not.toHaveBeenCalled();
  });

  it("invokes callback when intersection fires", () => {
    const el = document.createElement("div");
    const cb = vi.fn();
    renderHook(() => useIntersectionObserver(wrapEl(el),cb));

    const entry = { isIntersecting: true } as IntersectionObserverEntry;
    act(() => {
      capturedCallback([entry], {} as IntersectionObserver);
    });

    expect(cb).toHaveBeenCalledWith([entry], expect.anything());
  });

  it("passes root option to IntersectionObserver", () => {
    const el = document.createElement("div");
    const root = document.createElement("div");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el), vi.fn(), { root: wrapEl(root) }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root }),
    );
  });

  it("passes Observable root to IntersectionObserver", () => {
    const el = document.createElement("div");
    const root = document.createElement("div");
    const root$ = wrapEl(root);
    renderHook(() =>
      useIntersectionObserver(wrapEl(el), vi.fn(), { root: root$ }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root }),
    );
  });

  it("reactively recreates observer when Observable root changes from null to element", () => {
    const el = document.createElement("div");
    const rootB = document.createElement("div");
    // Start with null — @legendapp/state reliably tracks null→element transitions
    const root$ = observable<OpaqueObject<Element> | null>(null);

    renderHook(() =>
      useIntersectionObserver(wrapEl(el), vi.fn(), { root: root$ }),
    );

    // root is null — observer must not be created yet
    expect(MockIntersectionObserver).not.toHaveBeenCalled();
    mockDisconnect.mockClear();
    MockIntersectionObserver.mockClear();

    act(() => {
      root$.set(ObservableHint.opaque(rootB));
    });

    // no old observer to disconnect; new one created with rootB
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root: rootB }),
    );
  });

  it("delays setup until El$ root is mounted", () => {
    const el = document.createElement("div");
    const rootDiv = document.createElement("div");

    const { result } = renderHook(() => {
      const root$ = useEl$<HTMLElement>();
      return { root$, io: useIntersectionObserver(wrapEl(el),vi.fn(), { root: root$ }) };
    });

    // root El$ is null — observer must not be created yet
    expect(MockIntersectionObserver).not.toHaveBeenCalled();

    // assign the root element
    act(() => result.current.root$(rootDiv));

    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root: rootDiv }),
    );
  });

  it("reactively recreates observer when El$ root changes", () => {
    const el = document.createElement("div");
    const rootA = document.createElement("div");
    const rootB = document.createElement("div");

    const { result } = renderHook(() => {
      const root$ = useEl$<HTMLElement>();
      return { root$, io: useIntersectionObserver(wrapEl(el),vi.fn(), { root: root$ }) };
    });

    act(() => result.current.root$(rootA));
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);

    mockDisconnect.mockClear();
    MockIntersectionObserver.mockClear();

    act(() => result.current.root$(rootB));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root: rootB }),
    );
  });

  it("passes threshold array [0, 0.5, 1] to IntersectionObserver", () => {
    const el = document.createElement("div");
    renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn(), { threshold: [0, 0.5, 1] }),
    );

    expect(MockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: [0, 0.5, 1] }),
    );
  });

  it("pause → resume → stop sequence transitions states correctly", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    expect(result.current.isActive.get()).toBe(true);

    // pause
    act(() => result.current.pause());
    expect(result.current.isActive.get()).toBe(false);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    // resume
    mockObserve.mockClear();
    MockIntersectionObserver.mockClear();
    act(() => result.current.resume());
    expect(result.current.isActive.get()).toBe(true);
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(mockObserve).toHaveBeenCalledWith(el);

    // stop
    mockDisconnect.mockClear();
    act(() => result.current.stop());
    expect(result.current.isActive.get()).toBe(false);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    // resume after stop has no effect
    MockIntersectionObserver.mockClear();
    act(() => result.current.resume());
    expect(MockIntersectionObserver).not.toHaveBeenCalled();
    expect(result.current.isActive.get()).toBe(false);
  });

  it("recreates observer when El$ target changes to a different element", () => {
    const elA = document.createElement("div");
    const elB = document.createElement("div");

    const { result } = renderHook(() => {
      const el$ = useEl$<Element>();
      return { el$, io: useIntersectionObserver(el$, vi.fn()) };
    });

    act(() => result.current.el$(elA));

    expect(mockObserve).toHaveBeenCalledWith(elA);
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    MockIntersectionObserver.mockClear();

    act(() => result.current.el$(elB));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver).toHaveBeenCalledTimes(1);
    expect(mockObserve).toHaveBeenCalledWith(elB);
  });

  it("multiple resume() calls after stop() are all ignored", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver(wrapEl(el),vi.fn()));

    act(() => result.current.stop());
    MockIntersectionObserver.mockClear();

    act(() => {
      result.current.resume();
      result.current.resume();
      result.current.resume();
    });

    expect(MockIntersectionObserver).not.toHaveBeenCalled();
    expect(result.current.isActive.get()).toBe(false);
  });

  it("pause() after unmount does not throw", () => {
    const el = document.createElement("div");
    const { result, unmount } = renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn()),
    );

    unmount();
    mockDisconnect.mockClear();

    expect(() => act(() => result.current.pause())).not.toThrow();
    // No additional disconnect after unmount cleanup
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("resume() after unmount does not recreate observer", () => {
    const el = document.createElement("div");
    const { result, unmount } = renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn()),
    );

    unmount();
    MockIntersectionObserver.mockClear();

    expect(() => act(() => result.current.resume())).not.toThrow();
    expect(MockIntersectionObserver).not.toHaveBeenCalled();
  });

  it("stop() after unmount does not throw", () => {
    const el = document.createElement("div");
    const { result, unmount } = renderHook(() =>
      useIntersectionObserver(wrapEl(el),vi.fn()),
    );

    unmount();

    expect(() => act(() => result.current.stop())).not.toThrow();
  });
});
