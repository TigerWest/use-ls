import { describe, it, expect } from "vitest";
import { get } from ".";
import { observable } from "@legendapp/state";
describe("get() - single argument", () => {
  it("returns raw value as-is", () => {
    expect(get("hello")).toBe("hello");
    expect(get(42)).toBe(42);
    expect(get(true)).toBe(true);
  });

  it("extracts value from Observable", () => {
    const obs$ = observable("world");
    expect(get(obs$)).toBe("world");
  });

  it("handles null and undefined", () => {
    expect(get(null)).toBe(null);
    expect(get(undefined)).toBe(undefined);
    expect(get(observable(null))).toBe(null);
    expect(get(observable(undefined))).toBe(undefined);
  });

  it("handles objects", () => {
    const obj = { name: "John" };
    expect(get(obj)).toEqual(obj);
    expect(get(observable(obj))).toEqual(obj);
  });

  it("handles arrays", () => {
    const arr = [1, 2, 3];
    expect(get(arr)).toEqual(arr);
    expect(get(observable(arr))).toEqual(arr);
  });
});

describe("get() - two arguments (property access)", () => {
  it("extracts property from raw object", () => {
    const obj = { name: "John", age: 30 };
    expect(get(obj, "name")).toBe("John");
    expect(get(obj, "age")).toBe(30);
  });

  it("extracts property from Observable object", () => {
    const obs$ = observable({ name: "Jane", age: 25 });
    expect(get(obs$, "name")).toBe("Jane");
    expect(get(obs$, "age")).toBe(25);
  });

  it("returns undefined for missing keys", () => {
    const obj = { name: "John" };
    expect(get(obj, "age" as any)).toBe(undefined);
    expect(get(observable(obj), "age" as any)).toBe(undefined);
  });

  it("handles nested observable properties", () => {
    const filter$ = observable({ category: "electronics" });
    expect(get(filter$, "category")).toBe("electronics");
  });

  it("returns undefined when value is not an object", () => {
    expect(get("hello", "length" as any)).toBe(undefined);
    expect(get(observable("hello"), "length" as any)).toBe(undefined);
    expect(get(42, "toString" as any)).toBe(undefined);
  });

  it("handles null and undefined gracefully", () => {
    expect(get(null, "key" as any)).toBe(undefined);
    expect(get(undefined, "key" as any)).toBe(undefined);
    expect(get(observable(null), "key" as any)).toBe(undefined);
  });

  it("preserves property value types", () => {
    const obj = {
      str: "text",
      num: 42,
      bool: true,
      arr: [1, 2, 3],
      nested: { value: "deep" },
    };

    expect(get(obj, "str")).toBe("text");
    expect(get(obj, "num")).toBe(42);
    expect(get(obj, "bool")).toBe(true);
    expect(get(obj, "arr")).toEqual([1, 2, 3]);
    expect(get(obj, "nested")).toEqual({ value: "deep" });
  });
});
