// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef$ } from "../useRef$";
import { useResizeObserver } from ".";

const wrapEl = (el: Element) => observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

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
  it("observes multiple elements from an array", () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    const cb = vi.fn();

    renderHook(() => useResizeObserver([wrapEl(a), wrapEl(b)], cb));

    const instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(a);
    expect(instance.observed).toContain(b);
  });

  it("stop() disconnects the observer and suppresses further callbacks", () => {
    const div = document.createElement("div");
    const cb = vi.fn();

    const { result } = renderHook(() => useResizeObserver(wrapEl(div), cb));

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
      useResizeObserver(wrapEl(div), vi.fn(), { box: "border-box" })
    );

    expect(observeSpy).toHaveBeenCalledWith(div, { box: "border-box" });
  });

  it("returns isSupported: false and skips setup when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const div = document.createElement("div");
    const cb = vi.fn();
    const { result } = renderHook(() => useResizeObserver(wrapEl(div), cb));

    expect(result.current.isSupported$.get()).toBe(false);
    expect(ResizeObserverMock.instances).toHaveLength(0);
  });

  it("reacts to Ref$ target — starts observing after element is assigned", () => {
    const cb = vi.fn();

    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
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

  it("handles mixed array of Ref$, Observable, and plain Element", () => {
    const plainEl = document.createElement("section");
    const obsEl = document.createElement("span");
    const el$El = document.createElement("p");
    const target$ = observable<Element | null>(obsEl);

    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLParagraphElement>();
      const ro = useResizeObserver([el$ as any, target$ as any, plainEl], vi.fn());
      return { el$, ro };
    });

    // After mount: plainEl and obsEl observed, el$ not yet assigned
    let instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(plainEl);
    expect(instance.observed).toContain(obsEl);
    expect(instance.observed).not.toContain(el$El);

    // Assign Ref$ element
    act(() => result.current.el$(el$El));

    // After Ref$ assigned, all three observed
    instance = ResizeObserverMock.instances.at(-1)!;
    expect(instance.observed).toContain(el$El);
    expect(instance.observed).toContain(obsEl);
    expect(instance.observed).toContain(plainEl);
  });

  it("does not create an observer when target is an empty array", () => {
    renderHook(() => useResizeObserver([], vi.fn()));

    const activeInstances = ResizeObserverMock.instances.filter(
      (i) => i.observed.length > 0,
    );
    expect(activeInstances).toHaveLength(0);
  });

  it("does not create an observer when target is null", () => {
    renderHook(() => useResizeObserver(null as any, vi.fn()));

    const activeInstances = ResizeObserverMock.instances.filter(
      (i) => i.observed.length > 0,
    );
    expect(activeInstances).toHaveLength(0);
  });

  it("stops observing old element and observes new element when Ref$ target changes", () => {
    const elA = document.createElement("div");
    const elB = document.createElement("div");
    const cb = vi.fn();

    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      return { el$, ro: useResizeObserver(el$ as any, cb) };
    });

    // Assign elA first
    act(() => result.current.el$(elA));

    expect(
      ResizeObserverMock.instances.find((i) => !i.disconnected && i.observed.includes(elA)),
    ).toBeDefined();

    // Switch to elB
    act(() => result.current.el$(elB));

    // elB should now be observed
    expect(
      ResizeObserverMock.instances.find((i) => !i.disconnected && i.observed.includes(elB)),
    ).toBeDefined();

    // elA should no longer be observed by any active instance
    expect(
      ResizeObserverMock.instances.find((i) => !i.disconnected && i.observed.includes(elA)),
    ).toBeUndefined();
  });

  it("uses the latest callback without recreating the observer on re-render", () => {
    const div = document.createElement("div");
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useResizeObserver(wrapEl(div), cb),
      { initialProps: { cb: cb1 } },
    );

    const instance = ResizeObserverMock.instances.at(-1)!;

    rerender({ cb: cb2 });

    // Observer must NOT be recreated — same instance as before
    expect(ResizeObserverMock.instances.at(-1)).toBe(instance);

    // Triggering should invoke the latest callback (cb2), not the stale one (cb1)
    act(() => instance.trigger(div));
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("passes device-pixel-content-box box option to observe()", () => {
    const div = document.createElement("div");
    const observeSpy = vi.spyOn(ResizeObserverMock.prototype, "observe");

    renderHook(() =>
      useResizeObserver(wrapEl(div), vi.fn(), { box: "device-pixel-content-box" }),
    );

    expect(observeSpy).toHaveBeenCalledWith(div, {
      box: "device-pixel-content-box",
    });
  });
});
