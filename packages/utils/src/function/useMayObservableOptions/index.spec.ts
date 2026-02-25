// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { isObservable, observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { useMayObservableOptions } from ".";
import { useEl$ } from "../../elements/useEl$";

interface SimpleOpts {
  val: string;
}

// =============================================================================
// No transform
// =============================================================================

describe("useMayObservableOptions() — no transform", () => {
  it("undefined options → Observable<undefined>", () => {
    const { result } = renderHook(() => useMayObservableOptions(undefined));
    expect(isObservable(result.current)).toBe(true);
    expect(result.current.get()).toBeUndefined();
  });

  it("plain object → fields readable via .get()", () => {
    const { result } = renderHook(() =>
      useMayObservableOptions<{ x: number; y: number }>({ x: 10, y: 20 }),
    );
    expect(result.current.x.get()).toBe(10);
    expect(result.current.y.get()).toBe(20);
  });

  it("per-field Observable → auto-deref, reactive", () => {
    const val$ = observable("hello");
    const opts = { val: val$ }; // stable reference
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts),
    );
    expect(result.current.val.get()).toBe("hello");
    act(() => { val$.set("world"); });
    expect(result.current.val.get()).toBe("world");
  });

  it("outer Observable → reacts to whole-object replace", () => {
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(options$),
    );
    expect(result.current.val.get()).toBe("a");
    act(() => { options$.set({ val: "b" }); });
    expect(result.current.val.get()).toBe("b");
  });

  it("outer Observable child-field mutation → opts$ recomputes (Legend-State tracks children via .get())", () => {
    // options$.get() inside the reactive compute context tracks the observable AND its children.
    // Child-field mutations therefore DO trigger a recompute of opts$.
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(options$),
    );
    act(() => { options$.val.set("b"); });
    expect(result.current.val.get()).toBe("b");
  });

  it("returns an Observable", () => {
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>({ val: "x" }),
    );
    expect(isObservable(result.current)).toBe(true);
  });
});

// =============================================================================
// Function-form transform
// =============================================================================

describe("useMayObservableOptions() — function-form transform", () => {
  it("custom compute fn is called, its return value is what opts$ resolves to", () => {
    const compute = vi.fn((_raw) => ({ val: "computed" }));
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>({ val: "ignored" }, compute),
    );
    // useObservable is lazy — trigger the compute by reading the value
    expect(result.current.val.get()).toBe("computed");
    expect(compute).toHaveBeenCalled();
  });

  it("compute fn receives optionsRef.current (the raw options)", () => {
    const rawOpts = { val: "raw" };
    let captured: unknown;
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(rawOpts, (raw) => {
        captured = raw;
        return { val: "x" };
      }),
    );
    result.current.get(); // trigger lazy compute
    expect(captured).toBe(rawOpts);
  });

  it("compute fn can register reactive deps via get() on outer Observable", () => {
    const options$ = observable<SimpleOpts>({ val: "a" });
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(options$, (raw) => {
        const v = isObservable(raw) ? (raw as typeof options$).get() : raw;
        return v ? { val: v.val + "!" } : undefined;
      }),
    );
    expect(result.current.val.get()).toBe("a!");
    act(() => { options$.set({ val: "b" }); });
    expect(result.current.val.get()).toBe("b!");
  });

  it("plain options reference change (new depKey Symbol) → compute re-evaluated", () => {
    let evalCount = 0;
    const { result, rerender } = renderHook(
      ({ opts }: { opts: SimpleOpts }) =>
        useMayObservableOptions<SimpleOpts>(opts, () => {
          evalCount++;
          return undefined;
        }),
      { initialProps: { opts: { val: "a" } } },
    );
    result.current.get(); // trigger initial lazy compute
    const after1 = evalCount;
    rerender({ opts: { val: "b" } }); // new object reference → new Symbol depKey
    result.current.get(); // trigger recompute
    expect(evalCount).toBeGreaterThan(after1);
  });
});

// =============================================================================
// Object-form: 'peek' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'peek'", () => {
  it("resolves per-field Observable to its current value at compute time", () => {
    const val$ = observable("initial");
    const opts = { val: val$ }; // stable reference
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: 'peek' }),
    );
    expect(result.current.val.get()).toBe("initial");
  });

  it("plain field value is resolved as-is", () => {
    const opts = { val: "static" };
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: 'peek' }),
    );
    expect(result.current.val.get()).toBe("static");
  });

  it("changing source Observable does NOT update field when options ref is stable (non-reactive)", () => {
    // Stable options ref → depKey stays the same Symbol → compute does NOT re-run on val$ change.
    // peek() inside compute does not register a dep on val$ → field stays at compute-time snapshot.
    const val$ = observable("initial");
    const opts = { val: val$ }; // stable: same reference every render
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: 'peek' }),
    );
    expect(result.current.val.get()).toBe("initial");
    act(() => { val$.set("updated"); });
    // No dep registered (peek) + stable options ref (no depKey change) → stays "initial"
    expect(result.current.val.get()).toBe("initial");
  });
});

// =============================================================================
// Object-form: 'get' hint (explicit and default)
// =============================================================================

describe("useMayObservableOptions() — object-form: 'get' (explicit or omitted)", () => {
  it("explicit 'get' → per-field Observable is reactive via Legend-State auto-deref", () => {
    const val$ = observable("initial");
    const opts = { val: val$ };
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: 'get' }),
    );
    act(() => { val$.set("updated"); });
    expect(result.current.val.get()).toBe("updated");
  });

  it("omitted field defaults to 'get' → reactive", () => {
    const val$ = observable("initial");
    const opts = { val: val$ };
    const { result } = renderHook(() =>
      // empty FieldTransformMap: val is unspecified → defaults to 'get'
      useMayObservableOptions<SimpleOpts>(opts, {}),
    );
    act(() => { val$.set("updated"); });
    expect(result.current.val.get()).toBe("updated");
  });

  it("mixed: 'peek' freezes one field, default 'get' keeps another reactive (stable options ref)", () => {
    interface Opts { reactive: string; frozen: string }
    const reactive$ = observable("r-init");
    const frozen$ = observable("f-init");
    const opts = { reactive: reactive$, frozen: frozen$ }; // stable reference
    const { result } = renderHook(() =>
      useMayObservableOptions<Opts>(
        opts,
        { frozen: 'peek' }, // reactive: omitted → defaults to 'get'
      ),
    );
    expect(result.current.reactive.get()).toBe("r-init");
    expect(result.current.frozen.get()).toBe("f-init");
    act(() => {
      reactive$.set("r-updated");
      frozen$.set("f-updated");
    });
    expect(result.current.reactive.get()).toBe("r-updated"); // reactive ✓
    expect(result.current.frozen.get()).toBe("f-init");       // frozen (peek) ✓
  });
});

// =============================================================================
// Object-form: 'get.opaque' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'get.opaque'", () => {
  it("calls ObservableHint.opaque with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, 'opaque');
    const element = document.createElement("div");
    const { result } = renderHook(() =>
      useMayObservableOptions<{ element: HTMLElement }>({ element }, { element: 'get.opaque' }),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).toHaveBeenCalledWith(element);
    spy.mockRestore();
  });

  it("value is accessible via .get()", () => {
    const element = document.createElement("div");
    const { result } = renderHook(() =>
      useMayObservableOptions<{ element: HTMLElement }>({ element }, { element: 'get.opaque' }),
    );
    expect(result.current.element.get()).toBe(element);
  });

  it("null field value (via Observable) → ObservableHint.opaque NOT called (null-safe)", () => {
    // get(el$) resolves to null → v != null is false → opaque NOT applied
    const spy = vi.spyOn(ObservableHint, 'opaque');
    const el$ = observable<HTMLElement | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions({ element: el$ } as any, { element: 'get.opaque' } as any),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("undefined field → ObservableHint.opaque NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, 'opaque');
    const { result } = renderHook(() =>
      useMayObservableOptions<{ element?: HTMLElement }>(
        { element: undefined },
        { element: 'get.opaque' },
      ),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'get.plain' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'get.plain'", () => {
  it("calls ObservableHint.plain with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, 'plain');
    const nested = { key: "value" };
    const { result } = renderHook(() =>
      useMayObservableOptions<{ nested: object }>({ nested }, { nested: 'get.plain' }),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).toHaveBeenCalledWith(nested);
    spy.mockRestore();
  });

  it("null field value (via Observable) → ObservableHint.plain NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, 'plain');
    const nested$ = observable<object | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions({ nested: nested$ } as any, { nested: 'get.plain' } as any),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'get.function' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'get.function'", () => {
  it("calls ObservableHint.function with the resolved value", () => {
    const spy = vi.spyOn(ObservableHint, 'function');
    const cb = () => {};
    const { result } = renderHook(() =>
      useMayObservableOptions<{ cb: () => void }>({ cb }, { cb: 'get.function' }),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).toHaveBeenCalledWith(cb);
    spy.mockRestore();
  });

  it("null field value (via Observable) → ObservableHint.function NOT called (null-safe)", () => {
    const spy = vi.spyOn(ObservableHint, 'function');
    const cb$ = observable<(() => void) | null>(null);
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions({ cb: cb$ } as any, { cb: 'get.function' } as any),
    );
    result.current.get(); // trigger lazy compute
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// =============================================================================
// Object-form: 'get.element' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'get.element'", () => {
  it("plain HTMLElement-bearing Observable → resolved and wrapped in ObservableHint.opaque", () => {
    const div = document.createElement("div");
    const el$ = observable<OpaqueObject<HTMLElement> | null>(ObservableHint.opaque(div));
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions<{ el: any }>({ el: el$ }, { el: 'get.element' }),
    );
    result.current.get(); // trigger lazy compute
    const stored = result.current.el.get();
    expect(stored).not.toBeNull();
    // valueOf() on the stored OpaqueObject returns the raw element
    expect((stored as OpaqueObject<HTMLElement>).valueOf()).toBe(div);
  });

  it("El$ not yet mounted (null) → result[key] = null", () => {
    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLDivElement>();
      return useMayObservableOptions<{ el: any }>({ el: el$ }, { el: 'get.element' });
    });
    result.current.get(); // trigger lazy compute
    expect(result.current.el.get()).toBeNull();
  });

  it("El$ mounted after render → opts$ recomputes, result[key] updates to OpaqueObject", () => {
    const div = document.createElement("div");
    const { result } = renderHook(() => {
      const el$ = useEl$<HTMLDivElement>();
      return { el$, opts$: useMayObservableOptions<{ el: any }>({ el: el$ }, { el: 'get.element' }) };
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
      useMayObservableOptions<{ el: any }>({ el: null }, { el: 'get.element' }),
    );
    result.current.get();
    expect(result.current.el.get()).toBeNull();
  });

  it("undefined field → result[key] unchanged (undefined-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions<{ el?: any }>({ el: undefined }, { el: 'get.element' }),
    );
    result.current.get();
    expect(result.current.el.get()).toBeUndefined();
  });
});

// =============================================================================
// Object-form: 'peek.element' hint
// =============================================================================

describe("useMayObservableOptions() — object-form: 'peek.element'", () => {
  it("Observable<OpaqueObject<Element>> → peekElement() called, result wrapped in opaque", () => {
    const div = document.createElement("div");
    const el$ = observable<OpaqueObject<HTMLElement> | null>(ObservableHint.opaque(div));
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions<{ el: any }>({ el: el$ }, { el: 'peek.element' }),
    );
    result.current.get(); // trigger lazy compute
    const stored = result.current.el.get();
    expect(stored).not.toBeNull();
    expect((stored as OpaqueObject<HTMLElement>).valueOf()).toBe(div);
  });

  it("null field → result[key] = null (null-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions<{ el: any }>({ el: null }, { el: 'peek.element' }),
    );
    result.current.get();
    expect(result.current.el.get()).toBeNull();
  });

  it("undefined field → result[key] unchanged (undefined-safe)", () => {
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMayObservableOptions<{ el?: any }>({ el: undefined }, { el: 'peek.element' }),
    );
    result.current.get();
    expect(result.current.el.get()).toBeUndefined();
  });
});

// =============================================================================
// Object-form: custom function hint
// =============================================================================

describe("useMayObservableOptions() — object-form: custom function hint", () => {
  it("calls custom fn with the raw field value (Observable or plain)", () => {
    const val$ = observable("hello");
    const opts = { val: val$ };
    const customHint = vi.fn((v: unknown) =>
      isObservable(v) ? (v as typeof val$).get() : v,
    );
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: customHint }),
    );
    result.current.val.get(); // trigger lazy compute
    expect(customHint).toHaveBeenCalledWith(val$);
    expect(result.current.val.get()).toBe("hello");
  });

  it("custom fn return value is stored in opts$", () => {
    const customHint = (_v: unknown) => "custom-result";
    const opts = { val: "ignored" };
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts, { val: customHint }),
    );
    expect(result.current.val.get()).toBe("custom-result");
  });
});

// =============================================================================
// Object-form bypassed for outer Observable
// (applyObjectTransform is skipped when options is an Observable — isObservable check)
// =============================================================================

describe("useMayObservableOptions() — object-form bypassed for outer Observable", () => {
  it("'peek' hints have no effect — opts$ reacts to whole-object replace as normal", () => {
    // When options is Observable<T>: isObservable(raw) === true →
    // applyObjectTransform is NOT called → transform hints are irrelevant.
    // opts$ still reactively tracks the outer observable via get(options$) dep.
    const options$ = observable<SimpleOpts>({ val: "initial" });
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(options$, { val: 'peek' }),
    );
    expect(result.current.val.get()).toBe("initial");
    act(() => { options$.set({ val: "replaced" }); });
    expect(result.current.val.get()).toBe("replaced");
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("useMayObservableOptions() — edge cases", () => {
  it("plain options reference change between renders → opts$ recomputes with new value", () => {
    const { result, rerender } = renderHook(
      ({ opts }: { opts: SimpleOpts }) =>
        useMayObservableOptions<SimpleOpts>(opts),
      { initialProps: { opts: { val: "first" } } },
    );
    expect(result.current.val.get()).toBe("first");
    rerender({ opts: { val: "second" } });
    expect(result.current.val.get()).toBe("second");
  });

  it("same-reference options between renders → value is stable", () => {
    const opts = { val: "stable" };
    const { result, rerender } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(opts),
    );
    rerender();
    expect(result.current.val.get()).toBe("stable");
  });

  it("null options with object-form transform → Observable<undefined> (null-safe)", () => {
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(null as any, { val: 'peek' }),
    );
    expect(result.current.get()).toBeUndefined();
  });

  it("undefined options with object-form transform → Observable<undefined>", () => {
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(undefined, { val: 'peek' }),
    );
    expect(result.current.get()).toBeUndefined();
  });

  it("undefined options with function-form transform → transform receives undefined", () => {
    const compute = vi.fn((_raw) => undefined);
    const { result } = renderHook(() =>
      useMayObservableOptions<SimpleOpts>(undefined, compute),
    );
    result.current.get(); // trigger lazy compute
    expect(compute).toHaveBeenCalledWith(undefined);
  });
});
