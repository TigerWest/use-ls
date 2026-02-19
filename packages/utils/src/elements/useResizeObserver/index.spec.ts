// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEl$ } from "../useEl$";
import { useResizeObserver } from ".";

// ---------------------------------------------------------------------------
// ResizeObserver mock
// ---------------------------------------------------------------------------

type ResizeObserverMockEntry = {
  target: Element;
  contentRect: DOMRectReadOnly;
};

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    ResizeObserverMock.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el);
  }

  disconnect() {
    this.disconnected = true;
    this.observed = [];
  }

  /** Helper: trigger the callback with a fake entry for the given element */
  trigger(el: Element, rect: Partial<DOMRectReadOnly> = {}) {
    if (this.disconnected) return;
    const entry = {
      target: el,
      contentRect: { width: 100, height: 100, ...rect } as DOMRectReadOnly,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this);
  }
}

beforeEach(() => {
  ResizeObserverMock.instances = [];
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// useResizeObserver
// ---------------------------------------------------------------------------

describe("useResizeObserver()", () => {
  it("calls callback when element resizes", () => {
    const div = document.createElement("div");
    const cb = vi.fn();

    renderHook(() => useResizeObserver(div, cb));

    const instance = ResizeObserverMock.instances.at(-1)!;
    act(() => instance.trigger(div));

    expect(cb).toHaveBeenCalledOnce();
  });

  it("observes multiple elements from an array", () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    const cb = vi.fn();

    renderHook(() => useResizeObserver([a, b], cb));

    const instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(a);
    expect(instance.observed).toContain(b);
  });

  it("stop() disconnects the observer and suppresses further callbacks", () => {
    const div = document.createElement("div");
    const cb = vi.fn();

    const { result } = renderHook(() => useResizeObserver(div, cb));

    act(() => result.current.stop());

    const instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.disconnected).toBe(true);
    act(() => instance.trigger(div));
    expect(cb).not.toHaveBeenCalled();
  });

  it("passes box option to observe()", () => {
    const div = document.createElement("div");
    const observeSpy = vi.spyOn(ResizeObserverMock.prototype, "observe");

    renderHook(() =>
      useResizeObserver(div, vi.fn(), { box: "border-box" })
    );

    expect(observeSpy).toHaveBeenCalledWith(div, { box: "border-box" });
  });

  it("returns isSupported: true when ResizeObserver is available", () => {
    const div = document.createElement("div");
    const { result } = renderHook(() => useResizeObserver(div, vi.fn()));
    expect(result.current.isSupported.get()).toBe(true);
  });

  it("returns isSupported: false and skips setup when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const div = document.createElement("div");
    const cb = vi.fn();
    const { result } = renderHook(() => useResizeObserver(div, cb));

    expect(result.current.isSupported.get()).toBe(false);
    expect(ResizeObserverMock.instances).toHaveLength(0);
  });

  it("reacts to El$ target — starts observing after element is assigned", () => {
    const cb = vi.fn();

    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLDivElement>();
      const ro = useResizeObserver(el$, cb);
      return { el$, ro };
    });

    // Before element assigned — no active observer yet
    const instancesBefore = ResizeObserverMock.instances.filter(
      (i) => !i.disconnected && i.observed.length > 0
    );
    expect(instancesBefore).toHaveLength(0);

    const div = document.createElement("div");
    act(() => result.current.el$(div));

    // After element assigned — observer should be active
    const activeInstance = ResizeObserverMock.instances.find(
      (i) => i.observed.includes(div)
    );
    expect(activeInstance).toBeDefined();
  });

  it("reacts to Observable<Element|null> target — starts observing after value is set", () => {
    const target$ = observable<Element | null>(null);
    const cb = vi.fn();

    renderHook(() => useResizeObserver(target$ as any, cb));

    // Initially null — no active observer with observed elements
    const instancesWithObserved = ResizeObserverMock.instances.filter(
      (i) => i.observed.length > 0
    );
    expect(instancesWithObserved).toHaveLength(0);

    const div = document.createElement("div");
    act(() => {
      target$.set(div);
    });

    // After setting element, observer should be active
    const activeInstance = ResizeObserverMock.instances.find(
      (i) => i.observed.includes(div)
    );
    expect(activeInstance).toBeDefined();
  });

  it("handles mixed array of El$, Observable, and plain Element", () => {
    const plainEl = document.createElement("section");
    const obsEl = document.createElement("span");
    const el$El = document.createElement("p");
    const target$ = observable<Element | null>(obsEl);

    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLParagraphElement>();
      const ro = useResizeObserver([el$ as any, target$ as any, plainEl], vi.fn());
      return { el$, ro };
    });

    // After mount: plainEl and obsEl observed, el$ not yet assigned
    let instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(plainEl);
    expect(instance.observed).toContain(obsEl);
    expect(instance.observed).not.toContain(el$El);

    // Assign El$ element
    act(() => result.current.el$(el$El));

    // After El$ assigned, all three observed
    instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(el$El);
    expect(instance.observed).toContain(obsEl);
    expect(instance.observed).toContain(plainEl);
  });

  it("disconnects the active observer on unmount", () => {
    const div = document.createElement("div");
    const { unmount } = renderHook(() => useResizeObserver(div, vi.fn()));

    const activeInstance = ResizeObserverMock.instances.at(-1)!;
    expect(activeInstance.disconnected).toBe(false);

    unmount();

    expect(activeInstance.disconnected).toBe(true);
  });
});
