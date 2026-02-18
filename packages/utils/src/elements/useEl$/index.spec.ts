// @vitest-environment jsdom
import { render, renderHook, act } from "@testing-library/react";
import { useObserve } from "@legendapp/state/react";
import { createElement, createRef, forwardRef, useRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { useEl$ } from ".";

const noop = () => {};

describe("useEl$()", () => {
  it("initial value is null", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>(noop));
    expect(result.current.get()).toBe(null);
  });

  it("registers element in observable when called with an element", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>(noop));
    const div = document.createElement("div");

    act(() => {
      result.current(div);
    });

    expect(result.current.get()).toBe(div);
  });

  it("resets observable to null when called with null", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>(noop));
    const div = document.createElement("div");

    act(() => result.current(div));
    act(() => result.current(null));

    expect(result.current.get()).toBe(null);
  });

  it("el$ maintains stable reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useEl$<HTMLDivElement>(noop));
    const el$1 = result.current;

    rerender();

    expect(result.current).toBe(el$1);
  });

  it("el$ is callable and exposes get/peek as functions", () => {
    const { result } = renderHook(() => useEl$(noop));
    expect(typeof result.current).toBe("function");
    expect(typeof result.current.get).toBe("function");
    expect(typeof result.current.peek).toBe("function");
  });

  it("calls externalRef first then updates observable", () => {
    const callOrder: string[] = [];
    const externalRef = vi.fn((_node: HTMLDivElement | null) => {
      callOrder.push("externalRef");
    });

    const { result } = renderHook(() => useEl$<HTMLDivElement>(externalRef));
    const div = document.createElement("div");

    act(() => {
      result.current(div);
    });

    expect(externalRef).toHaveBeenCalledWith(div);
    expect(result.current.get()).toBe(div);
    expect(callOrder[0]).toBe("externalRef"); // external runs first
  });

  it("uses latest externalRef after re-render", () => {
    let currentRef = vi.fn();

    const { result, rerender } = renderHook(
      ({ ref }) => useEl$<HTMLDivElement>(ref),
      { initialProps: { ref: currentRef } }
    );

    const newRef = vi.fn();
    rerender({ ref: newRef });

    const div = document.createElement("div");
    act(() => {
      result.current(div);
    });

    expect(currentRef).not.toHaveBeenCalled();
    expect(newRef).toHaveBeenCalledWith(div);
  });

  it("works without any argument (standalone useRef replacement)", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>());
    const div = document.createElement("div");

    act(() => result.current(div));

    expect(result.current.get()).toBe(div);
  });

  it("syncs RefObject.current when RefObject is provided", () => {
    const refObject = createRef<HTMLDivElement>();

    const { result } = renderHook(() => useEl$<HTMLDivElement>(refObject));
    const div = document.createElement("div");

    act(() => result.current(div));

    expect(refObject.current).toBe(div);
    expect(result.current.get()).toBe(div);
  });

  it("clears RefObject.current to null on unmount", () => {
    const refObject = createRef<HTMLDivElement>();

    const { result } = renderHook(() => useEl$<HTMLDivElement>(refObject));
    const div = document.createElement("div");

    act(() => result.current(div));
    act(() => result.current(null));

    expect(refObject.current).toBe(null);
    expect(result.current.get()).toBe(null);
  });

  it("handles null externalRef gracefully (forwardRef passing null)", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>(null));
    const div = document.createElement("div");

    act(() => result.current(div));

    expect(result.current.get()).toBe(div);
  });

  it("updates latest RefObject when externalRef changes between renders", () => {
    const { result, rerender } = renderHook(
      ({ ref }) => useEl$<HTMLDivElement>(ref),
      { initialProps: { ref: createRef<HTMLDivElement>() } }
    );

    const newRef = createRef<HTMLDivElement>();
    rerender({ ref: newRef });

    const div = document.createElement("div");
    act(() => result.current(div));

    expect(newRef.current).toBe(div);
  });

  it("can be used with useRef inside forwardRef pattern", () => {
    const { result } = renderHook(() => {
      const localRef = useRef<HTMLDivElement>(null);
      return { el$: useEl$<HTMLDivElement>(localRef), localRef };
    });

    const div = document.createElement("div");
    act(() => result.current.el$(div));

    expect(result.current.localRef.current).toBe(div);
    expect(result.current.el$.get()).toBe(div);
  });

  it("reactivity works inside forwardRef component", () => {
    const observeSpy = vi.fn();

    const Component = forwardRef<HTMLDivElement, object>((_, ref) => {
      const el$ = useEl$(ref);
      useObserve(() => {
        el$.get();
        observeSpy();
      });
      return createElement("div", { ref: el$ });
    });

    const parentRef = createRef<HTMLDivElement>();
    render(createElement(Component, { ref: parentRef }));

    // 1st: initial useObserve (el = null), 2nd: element assigned
    expect(observeSpy).toHaveBeenCalledTimes(2);
    expect(parentRef.current).not.toBe(null);
  });

  it("triggers useObserve when element is assigned", () => {
    const observeSpy = vi.fn();

    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLDivElement>(noop);
      useObserve(() => {
        el$.get(); // register as selector
        observeSpy();
      });
      return el$;
    });

    // called once on mount
    expect(observeSpy).toHaveBeenCalledTimes(1);

    const div = document.createElement("div");
    act(() => {
      result.current(div);
    });

    // called again when element changes
    expect(observeSpy).toHaveBeenCalledTimes(2);
  });
});
