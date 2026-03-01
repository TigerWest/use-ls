// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

const wrapEl = (el: Element) => observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));
import { useRef$ } from "../../elements/useRef$";
import { useEventListener } from ".";

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useEventListener — window default (no target)
// ---------------------------------------------------------------------------

describe("useEventListener() — no target (window default)", () => {
  it("registers a listener on window when target is omitted", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener("click", listener));

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("invokes listener when the event fires on window", () => {
    const listener = vi.fn();
    renderHook(() => useEventListener("click", listener));

    act(() => {
      window.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes listener from window on unmount", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const listener = vi.fn();
    const { unmount } = renderHook(() => useEventListener("click", listener));

    unmount();
    await Promise.resolve();

    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("does not invoke listener after unmount", async () => {
    const listener = vi.fn();
    const { unmount } = renderHook(() => useEventListener("click", listener));

    unmount();
    await Promise.resolve();
    act(() => {
      window.dispatchEvent(new Event("click"));
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("registers once per event name even when listener array is given", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    addSpy.mockClear();
    const l1 = vi.fn();
    const l2 = vi.fn();

    renderHook(() => useEventListener("click", [l1, l2]));

    // forwarder pattern: one registration per (target, event) pair
    const clickCalls = addSpy.mock.calls.filter(([type]) => type === "click");
    expect(clickCalls).toHaveLength(1);
  });

  it("registers multiple event names from an array", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    addSpy.mockClear();
    const listener = vi.fn();

    renderHook(() => useEventListener(["click", "keydown"], listener));

    const types = addSpy.mock.calls.map(([type]) => type);
    expect(types).toContain("click");
    expect(types).toContain("keydown");
  });
});

// ---------------------------------------------------------------------------
// useEventListener — explicit Window / Document target
// ---------------------------------------------------------------------------

describe("useEventListener() — Window / Document target", () => {
  it("registers listener on explicit Window target", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener(window, "resize", listener));

    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function), undefined);
  });

  it("registers listener on Document target", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener(document, "click", listener));

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("invokes listener when event fires on Document", () => {
    const listener = vi.fn();
    renderHook(() => useEventListener(document, "click", listener));

    act(() => {
      document.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes Document listener on unmount", async () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const listener = vi.fn();
    const { unmount } = renderHook(() => useEventListener(document, "click", listener));

    unmount();
    await Promise.resolve();

    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });
});

// ---------------------------------------------------------------------------
// useEventListener — plain HTMLElement target
// ---------------------------------------------------------------------------

describe("useEventListener() — HTMLElement target", () => {
  it("registers listener on the given element", () => {
    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener(div, "click", listener));

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("invokes listener when event fires on element", () => {
    const div = document.createElement("div");
    const listener = vi.fn();
    renderHook(() => useEventListener(div, "click", listener));

    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes listener from element on unmount", async () => {
    const div = document.createElement("div");
    const removeSpy = vi.spyOn(div, "removeEventListener");
    const listener = vi.fn();
    const { unmount } = renderHook(() => useEventListener(div, "click", listener));

    unmount();
    await Promise.resolve();

    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("does not register when target is null", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    addSpy.mockClear();
    const listener = vi.fn();

    renderHook(() => useEventListener(null as any, "click", listener));

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("does not register when target is undefined", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    addSpy.mockClear();
    const listener = vi.fn();

    renderHook(() => useEventListener(undefined as any, "click", listener));

    expect(addSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useEventListener — multiple targets / events / listeners
// ---------------------------------------------------------------------------

describe("useEventListener() — Arrayable targets / events / listeners", () => {
  it("fires listener when event fires on each element in a target array", () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    const listener = vi.fn();

    renderHook(() => useEventListener([wrapEl(a), wrapEl(b)], "click", listener));

    act(() => {
      a.dispatchEvent(new Event("click"));
      b.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("registers one handler per (target, event) pair for array targets", () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    const spyA = vi.spyOn(a, "addEventListener");
    const spyB = vi.spyOn(b, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener([wrapEl(a), wrapEl(b)], "click", listener));

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
  });

  it("fires listener for each event in an event-name array", () => {
    const div = document.createElement("div");
    const listener = vi.fn();

    renderHook(() => useEventListener(div, ["mouseenter", "mouseleave"], listener));

    act(() => {
      div.dispatchEvent(new Event("mouseenter"));
      div.dispatchEvent(new Event("mouseleave"));
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("invokes all listeners in a listener array when event fires", () => {
    const div = document.createElement("div");
    const l1 = vi.fn();
    const l2 = vi.fn();

    renderHook(() => useEventListener(div, "click", [l1, l2]));

    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });

  it("registers only one handler per event when multiple listeners are given", () => {
    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");
    const l1 = vi.fn();
    const l2 = vi.fn();

    renderHook(() => useEventListener(div, "click", [l1, l2]));

    // forwarder pattern: one registration regardless of listener array length
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it("removes the handler from all targets on unmount", async () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    const removeA = vi.spyOn(a, "removeEventListener");
    const removeB = vi.spyOn(b, "removeEventListener");
    const listener = vi.fn();
    const { unmount } = renderHook(() =>
      useEventListener([wrapEl(a), wrapEl(b)], "click", listener)
    );

    unmount();
    await Promise.resolve();

    expect(removeA).toHaveBeenCalledTimes(1);
    expect(removeB).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useEventListener — AddEventListenerOptions
// ---------------------------------------------------------------------------

describe("useEventListener() — options", () => {
  it("passes object options to addEventListener", () => {
    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");
    const listener = vi.fn();
    const opts = { passive: true, capture: false };

    renderHook(() => useEventListener(div, "click", listener, opts));

    expect(addSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      expect.objectContaining({ passive: true, capture: false })
    );
  });

  it("passes boolean capture option to addEventListener", () => {
    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");
    const listener = vi.fn();

    renderHook(() => useEventListener(div, "click", listener, true));

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
  });

  it("passes cloned options so mutation after registration does not affect removal", async () => {
    const div = document.createElement("div");
    const removeSpy = vi.spyOn(div, "removeEventListener");
    const listener = vi.fn();
    const opts: AddEventListenerOptions = { passive: true };

    const { unmount } = renderHook(() => useEventListener(div, "click", listener, opts));

    opts.passive = false;
    unmount();
    await Promise.resolve();

    expect(removeSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
  });
});

// ---------------------------------------------------------------------------
// useEventListener — manual cleanup (returned function)
// ---------------------------------------------------------------------------

describe("useEventListener() — returned cleanup function", () => {
  it("removes listener when the returned function is called", () => {
    const div = document.createElement("div");
    const removeSpy = vi.spyOn(div, "removeEventListener");
    const listener = vi.fn();
    const { result } = renderHook(() => useEventListener(div, "click", listener));

    act(() => {
      result.current();
    });

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not invoke listener after manual cleanup", () => {
    const div = document.createElement("div");
    const listener = vi.fn();
    const { result } = renderHook(() => useEventListener(div, "click", listener));

    act(() => {
      result.current();
    });
    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useEventListener — stale closure safety (forwarder pattern)
// ---------------------------------------------------------------------------

describe("useEventListener() — stale closure safety", () => {
  it("calls the latest listener after state changes without re-registering", () => {
    const div = document.createElement("div");
    const wrappedDiv = wrapEl(div);
    const addSpy = vi.spyOn(div, "addEventListener");

    const latestListener = vi.fn();

    const { rerender } = renderHook<() => void, { listener: (ev: MouseEvent) => void }>(
      ({ listener }) => useEventListener(wrappedDiv, "click", listener),
      { initialProps: { listener: vi.fn() } }
    );

    const callsBefore = addSpy.mock.calls.length;

    // Simulate re-render with a new listener (e.g. after state change)
    rerender({ listener: latestListener });

    // No additional addEventListener call — forwarder is stable
    expect(addSpy.mock.calls.length).toBe(callsBefore);

    // The latest listener is called when the event fires
    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(latestListener).toHaveBeenCalledOnce();
  });

  it("reads latest state-captured value when event fires after re-render", () => {
    const div = document.createElement("div");
    const calls: string[] = [];

    const { result } = renderHook(() => {
      // eslint-disable-next-line use-legend/prefer-use-observable -- intentional: testing behavior with non-observable state
      const [value, setValue] = useState("initial");
      useEventListener(div, "click", () => {
        calls.push(value);
      });
      return { setValue };
    });

    act(() => {
      result.current.setValue("updated");
    });

    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    // With forwarder, calls the post-re-render listener that captures "updated"
    expect(calls).toEqual(["updated"]);
  });
});

// ---------------------------------------------------------------------------
// useEventListener — Ref$ reactive target
// ---------------------------------------------------------------------------

describe("useEventListener() — Ref$ reactive target", () => {
  it("does not register listener before Ref$ is assigned", () => {
    const listener = vi.fn();
    renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      useEventListener(el$ as any, "click", listener);
      return { el$ };
    });

    act(() => {
      window.dispatchEvent(new Event("click"));
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("starts listening after Ref$ receives an element", () => {
    const listener = vi.fn();
    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      useEventListener(el$ as any, "click", listener);
      return { el$ };
    });

    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");

    act(() => {
      result.current.el$(div);
    });

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("invokes listener when event fires after Ref$ element is assigned", () => {
    const listener = vi.fn();
    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      useEventListener(el$ as any, "click", listener);
      return { el$ };
    });

    const div = document.createElement("div");
    act(() => {
      result.current.el$(div);
    });
    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes listener from old element and registers on new element when Ref$ changes", () => {
    const listener = vi.fn();
    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      useEventListener(el$ as any, "click", listener);
      return { el$ };
    });

    const elA = document.createElement("div");
    act(() => {
      result.current.el$(elA);
    });

    const removeSpyA = vi.spyOn(elA, "removeEventListener");
    const elB = document.createElement("div");
    const addSpyB = vi.spyOn(elB, "addEventListener");

    act(() => {
      result.current.el$(elB);
    });

    expect(removeSpyA).toHaveBeenCalledTimes(1);
    expect(addSpyB).toHaveBeenCalledTimes(1);
  });

  it("removes Ref$ listener on unmount", async () => {
    const listener = vi.fn();
    const { result, unmount } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      useEventListener(el$ as any, "click", listener);
      return { el$ };
    });

    const div = document.createElement("div");
    act(() => {
      result.current.el$(div);
    });
    const removeSpy = vi.spyOn(div, "removeEventListener");

    unmount();
    await Promise.resolve();

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useEventListener — Observable<Element> reactive target
// ---------------------------------------------------------------------------

describe("useEventListener() — Observable<Element> reactive target", () => {
  it("starts listening after Observable target is set to an element", () => {
    const target$ = observable<Element | null>(null);
    const listener = vi.fn();

    renderHook(() => useEventListener(target$ as any, "click", listener));

    const div = document.createElement("div");
    const addSpy = vi.spyOn(div, "addEventListener");

    act(() => {
      target$.set(div);
    });

    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), undefined);
  });

  it("invokes listener when event fires after Observable target is set", () => {
    const target$ = observable<Element | null>(null);
    const listener = vi.fn();

    renderHook(() => useEventListener(target$ as any, "click", listener));

    const div = document.createElement("div");
    act(() => {
      target$.set(div);
    });
    act(() => {
      div.dispatchEvent(new Event("click"));
    });

    expect(listener).toHaveBeenCalledOnce();
  });
});
