// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { useObserve } from "@legendapp/state/react";
import { describe, it, expect, vi } from "vitest";
import { useEl$ } from ".";

describe("useEl$()", () => {
  it("initial value is null", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>());
    expect(result.current.get()).toBe(null);
  });

  it("registers element in observable when ref is called with an element", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>());
    const div = document.createElement("div");

    act(() => {
      result.current.ref(div);
    });

    expect(result.current.get()).toBe(div);
  });

  it("resets observable to null when ref is called with null", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>());
    const div = document.createElement("div");

    act(() => {
      result.current.ref(div);
    });
    act(() => {
      result.current.ref(null);
    });

    expect(result.current.get()).toBe(null);
  });

  it("ref maintains stable reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useEl$<HTMLDivElement>());
    const ref1 = result.current.ref;

    rerender();

    expect(result.current.ref).toBe(ref1);
  });

  it("el$ exposes both get and ref as functions", () => {
    const { result } = renderHook(() => useEl$());
    expect(typeof result.current.get).toBe("function");
    expect(typeof result.current.ref).toBe("function");
  });

  it("triggers useObserve when element is assigned via ref", () => {
    const observeSpy = vi.fn();

    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLDivElement>();
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
      result.current.ref(div);
    });

    // called again when element changes
    expect(observeSpy).toHaveBeenCalledTimes(2);
  });
});
