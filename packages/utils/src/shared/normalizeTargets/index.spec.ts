// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable } from "@legendapp/state";
import { describe, it, expect } from "vitest";
import { useEl$ } from "../../elements/useEl$";
import type { El$ } from "../../elements/useEl$";
import { normalizeTargets } from ".";

describe("normalizeTargets()", () => {
  it("returns empty array for null plain value", () => {
    expect(normalizeTargets(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeTargets(undefined)).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    expect(normalizeTargets([])).toEqual([]);
  });

  it("returns element for plain Element input", () => {
    const div = document.createElement("div");
    expect(normalizeTargets(div)).toEqual([div]);
  });

  it("returns elements for array of plain Elements", () => {
    const a = document.createElement("div");
    const b = document.createElement("span");
    expect(normalizeTargets([a, b])).toEqual([a, b]);
  });

  it("unwraps Observable<Element>", () => {
    const div = document.createElement("div");
    const obs = observable<Element | null>(div);
    expect(normalizeTargets(obs)).toEqual([div]);
  });

  it("filters out Observable<null>", () => {
    const obs = observable<Element | null>(null);
    expect(normalizeTargets(obs)).toEqual([]);
  });

  it("unwraps El$ target and returns the raw DOM element", () => {
    const div = document.createElement("div");
    const { result } = renderHook(() => useEl$<HTMLDivElement>());

    act(() => result.current(div));

    const elements = normalizeTargets(result.current as El$<Element>);
    expect(elements).toEqual([div]);
  });

  it("returns empty array when El$ has no element assigned", () => {
    const { result } = renderHook(() => useEl$<HTMLDivElement>());

    const elements = normalizeTargets(result.current as El$<Element>);
    expect(elements).toEqual([]);
  });

  it("handles mixed array of El$, Observable, and plain Element", () => {
    const div = document.createElement("div");
    const span = document.createElement("span");
    const p = document.createElement("p");

    const { result } = renderHook(() => useEl$<HTMLDivElement>());
    act(() => result.current(div));

    const obs = observable<Element | null>(span);

    const elements = normalizeTargets([result.current as El$<Element>, obs, p]);
    expect(elements).toEqual([div, span, p]);
  });
});
