// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { isObservable, observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { useMaybeObservable } from ".";
import { useRef$ } from "../../elements/useRef$";

interface SimpleOpts {
  val: string;
}

// =============================================================================
// No transform
// =============================================================================

describe("useMaybeObservable() — no transform", () => {
  it("undefined options → Observable<undefined>", () => {
    const { result } = renderHook(() => useMaybeObservable(undefined));
    expect(isObservable(result.current)).toBe(true);
    expect(result.current.get()).toBeUndefined();
  });

  it("plain object → fields readable via .get()", () => {
    const { result } = renderHook(() =>
      useMaybeObservable<{ x: number; y: number }>({ x: 10, y: 20 })
    );
    expect(result.current.x.get()).toBe(10);
    expect(result.current.y.get()).toBe(20);
  });

  it("per-field Observable → auto-deref, reactive", () => {
    const val$ = observable("hello");
    const opts = { val: val$ }; // stable reference
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts));
    expect(result.current.val.get()).toBe("hello");
    act(() => {
      val$.set("world");
    });
    expect(result.current.val.get()).toBe("world");
  });

  it("outer Observable → reacts to whole-object replace", () => {
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(options$));
    expect(result.current.val.get()).toBe("a");
    act(() => {
      options$.set({ val: "b" });
    });
    expect(result.current.val.get()).toBe("b");
  });

  it("outer Observable child-field mutation → opts$ recomputes (get() dep on options$ catches child notifications)", () => {
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(options$));
    act(() => {
      options$.val.set("b");
    });
    expect(result.current.val.get()).toBe("b");
  });

  it("returns an Observable", () => {
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>({ val: "x" }));
    expect(isObservable(result.current)).toBe(true);
  });
});

// =============================================================================
// Function-form transform
// =============================================================================

describe("useMaybeObservable() — function-form transform", () => {
  it("custom compute fn is called, its return value is what opts$ resolves to", () => {
    const compute = vi.fn((_raw) => ({ val: "computed" }));
    const { result } = renderHook(() =>
      useMaybeObservable<SimpleOpts>({ val: "ignored" }, compute)
    );
    expect(result.current.val.get()).toBe("computed");
    expect(compute).toHaveBeenCalled();
  });

  it("compute fn receives optionsRef.current (the raw options)", () => {
    const rawOpts = { val: "raw" };
    let captured: unknown;
    const { result } = renderHook(() =>
      useMaybeObservable<SimpleOpts>(rawOpts, (raw) => {
        captured = raw;
        return { val: "x" };
      })
    );
    result.current.get();
    expect(captured).toBe(rawOpts);
  });

  it("compute fn can register reactive deps via get() on outer Observable", () => {
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() =>
      useMaybeObservable<SimpleOpts>(options$, (raw) => {
        const v = isObservable(raw) ? (raw as typeof options$).get() : raw;
        return v ? { val: v.val + "!" } : undefined;
      })
    );
    expect(result.current.val.get()).toBe("a!");
    act(() => {
      options$.set({ val: "b" });
    });
    expect(result.current.val.get()).toBe("b!");
  });

  it("plain options reference change (new depKey Symbol) → compute re-evaluated", () => {
    let evalCount = 0;
    const { result, rerender } = renderHook(
      ({ opts }: { opts: SimpleOpts }) =>
        useMaybeObservable<SimpleOpts>(opts, () => {
          evalCount++;
          return undefined;
        }),
      { initialProps: { opts: { val: "a" } } }
    );
    result.current.get();
    const after1 = evalCount;
    rerender({ opts: { val: "b" } });
    result.current.get();
    expect(evalCount).toBeGreaterThan(after1);
  });
});

// =============================================================================
// Object-form: 'default' hint
// =============================================================================

describe("useMaybeObservable() — object-form: 'default' (explicit or omitted)", () => {
  it("explicit 'default' → per-field Observable is reactive via Legend-State auto-deref", () => {
    const val$ = observable("initial");
    const opts = { val: val$ };
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, { val: "default" }));
    act(() => {
      val$.set("updated");
    });
    expect(result.current.val.get()).toBe("updated");
  });

  it("omitted field defaults to 'default' → reactive", () => {
    const val$ = observable("initial");
    const opts = { val: val$ };
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, {}));
    act(() => {
      val$.set("updated");
    });
    expect(result.current.val.get()).toBe("updated");
  });

  it("resolves per-field Observable to its current value", () => {
    const val$ = observable("hello");
    const opts = { val: val$ };
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, { val: "default" }));
    expect(result.current.val.get()).toBe("hello");
  });

  it("plain field value is resolved as-is", () => {
    const opts = { val: "static" };
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, { val: "default" }));
    expect(result.current.val.get()).toBe("static");
  });
});

// =============================================================================
// Object-form: 'opaque' hint
// =============================================================================

describe("useMaybeObservable() — object-form: 'opaque'", () => {
  it("calls ObservableHint.opaque with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, "opaque");
    const element = document.createElement("div");
    const { result } = renderHook(() =>
      useMaybeObservable<{ element: HTMLElement }>({ element }, { element: "opaque" })
    );
    result.current.get();
    expect(spy).toHaveBeenCalledWith(element);
    spy.mockRestore();
  });

  it("value is accessible via .get()", () => {
    const element = document.createElement("div");
    const { result } = renderHook(() =>
      useMaybeObservable<{ element: HTMLElement }>({ element }, { element: "opaque" })
    );
    expect(result.current.element.get()).toBe(element);
  });

  it("null field value → ObservableHint.opaque NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, "opaque");
    const el$ = observable<HTMLElement | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable({ element: el$ } as any, { element: "opaque" } as any)
    );
    result.current.get();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("undefined field → ObservableHint.opaque NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, "opaque");
    const { result } = renderHook(() =>
      useMaybeObservable<{ element?: HTMLElement }>({ element: undefined }, { element: "opaque" })
    );
    result.current.get();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'plain' hint
// =============================================================================

describe("useMaybeObservable() — object-form: 'plain'", () => {
  it("calls ObservableHint.plain with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, "plain");
    const nested = { key: "value" };
    const { result } = renderHook(() =>
      useMaybeObservable<{ nested: object }>({ nested }, { nested: "plain" })
    );
    result.current.get();
    expect(spy).toHaveBeenCalledWith(nested);
    spy.mockRestore();
  });

  it("null field value → ObservableHint.plain NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, "plain");
    const nested$ = observable<object | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable({ nested: nested$ } as any, { nested: "plain" } as any)
    );
    result.current.get();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'function' hint
// =============================================================================

describe("useMaybeObservable() — object-form: 'function'", () => {
  it("calls ObservableHint.function with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, "function");
    const cb = () => {};
    const { result } = renderHook(() =>
      useMaybeObservable<{ cb: () => void }>({ cb }, { cb: "function" })
    );
    result.current.get();
    expect(spy).toHaveBeenCalledWith(cb);
    spy.mockRestore();
  });

  it("null field value → ObservableHint.function NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, "function");
    const cb$ = observable<(() => void) | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable({ cb: cb$ } as any, { cb: "function" } as any)
    );
    result.current.get();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'element' hint
// =============================================================================

describe("useMaybeObservable() — object-form: 'element'", () => {
  it("plain HTMLElement-bearing Observable → resolved and wrapped in ObservableHint.opaque", () => {
    const div = document.createElement("div");
    const el$ = observable<OpaqueObject<HTMLElement> | null>(ObservableHint.opaque(div));
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable<{ el: any }>({ el: el$ }, { el: "element" })
    );
    result.current.get();
    const stored = result.current.el.get();
    expect(stored).not.toBeNull();
    expect((stored as OpaqueObject<HTMLElement>).valueOf()).toBe(div);
  });

  it("Ref$ not yet mounted (null) → result[key] = null", () => {
    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return useMaybeObservable<{ el: any }>({ el: el$ }, { el: "element" });
    });
    result.current.get();
    expect(result.current.el.get()).toBeNull();
  });

  it("Ref$ mounted after render → opts$ recomputes, result[key] updates to OpaqueObject", () => {
    const div = document.createElement("div");
    const { result } = renderHook(() => {
      const el$ = useRef$<HTMLDivElement>();
      return {
        el$,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opts$: useMaybeObservable<{ el: any }>({ el: el$ }, { el: "element" }),
      };
    });
    expect(result.current.opts$.el.get()).toBeNull();

    act(() => result.current.el$(div));

    const stored = result.current.opts$.el.get();
    expect(stored).not.toBeNull();
    expect((stored as OpaqueObject<HTMLDivElement>).valueOf()).toBe(div);
  });

  it("null field → result[key] = null (null-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable<{ el: any }>({ el: null }, { el: "element" })
    );
    result.current.get();
    expect(result.current.el.get()).toBeNull();
  });

  it("undefined field → result[key] unchanged (undefined-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable<{ el?: any }>({ el: undefined }, { el: "element" })
    );
    result.current.get();
    expect(result.current.el.get()).toBeUndefined();
  });
});

// =============================================================================
// Object-form: custom function hint
// =============================================================================

describe("useMaybeObservable() — object-form: custom function hint", () => {
  it("calls custom fn with the raw field value (Observable or plain)", () => {
    const val$ = observable("hello");
    const opts = { val: val$ };
    const customHint = vi.fn((v: unknown) => (isObservable(v) ? (v as typeof val$).get() : v));
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, { val: customHint }));
    result.current.val.get();
    expect(customHint).toHaveBeenCalledWith(val$);
    expect(result.current.val.get()).toBe("hello");
  });

  it("custom fn return value is stored in opts$", () => {
    const customHint = (_v: unknown) => "custom-result";
    const opts = { val: "ignored" };
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(opts, { val: customHint }));
    expect(result.current.val.get()).toBe("custom-result");
  });
});

// =============================================================================
// Object-form bypassed for outer Observable
// =============================================================================

describe("useMaybeObservable() — object-form bypassed for outer Observable", () => {
  it("hints have no effect — opts$ reacts to whole-object replace as normal", () => {
    const options$ = observable<SimpleOpts>({ val: "initial" });
    const { result } = renderHook(() =>
      useMaybeObservable<SimpleOpts>(options$, { val: "opaque" })
    );
    expect(result.current.val.get()).toBe("initial");
    act(() => {
      options$.set({ val: "replaced" });
    });
    expect(result.current.val.get()).toBe("replaced");
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("useMaybeObservable() — edge cases", () => {
  it("plain options reference change between renders → opts$ recomputes with new value", () => {
    const { result, rerender } = renderHook(
      ({ opts }: { opts: SimpleOpts }) => useMaybeObservable<SimpleOpts>(opts),
      { initialProps: { opts: { val: "first" } } }
    );
    expect(result.current.val.get()).toBe("first");
    rerender({ opts: { val: "second" } });
    expect(result.current.val.get()).toBe("second");
  });

  it("same-reference options between renders → value is stable", () => {
    const opts = { val: "stable" };
    const { result, rerender } = renderHook(() => useMaybeObservable<SimpleOpts>(opts));
    rerender();
    expect(result.current.val.get()).toBe("stable");
  });

  it("null options with object-form transform → Observable<undefined> (null-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMaybeObservable<SimpleOpts>(null as any, { val: "default" })
    );
    expect(result.current.get()).toBeUndefined();
  });

  it("undefined options with object-form transform → Observable<undefined>", () => {
    const { result } = renderHook(() =>
      useMaybeObservable<SimpleOpts>(undefined, { val: "default" })
    );
    expect(result.current.get()).toBeUndefined();
  });

  it("undefined options with function-form transform → transform receives undefined", () => {
    const compute = vi.fn((_raw) => undefined);
    const { result } = renderHook(() => useMaybeObservable<SimpleOpts>(undefined, compute));
    result.current.get();
    expect(compute).toHaveBeenCalledWith(undefined);
  });
});
