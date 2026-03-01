// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { observable, ObservableHint } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useDropZone } from ".";

// ---------------------------------------------------------------------------
// jsdom DragEvent polyfill
// ---------------------------------------------------------------------------
if (typeof window !== "undefined" && !window.DragEvent) {
  (global as any).DragEvent = class DragEvent extends MouseEvent {
    dataTransfer: DataTransfer | null = null;
    constructor(type: string, init: DragEventInit = {}) {
      super(type, init);
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapEl = (el: Element) =>
  observable<OpaqueObject<Element> | null>(ObservableHint.opaque(el));

function createDiv() {
  return document.createElement("div");
}

function createFile(name: string, type: string): File {
  return new File(["content"], name, { type });
}

function createDragEvent(
  type: string,
  files: File[] = [],
  mimeTypes: string[] = [],
): DragEvent {
  const event = new DragEvent(type, { bubbles: true, cancelable: true });

  // Build DataTransferItemList-like object
  const items = mimeTypes.map((mime) => ({
    type: mime,
    kind: "file" as const,
  }));

  const itemsProxy = new Proxy(items, {
    get(target, prop) {
      if (prop === "length") return target.length;
      if (prop === Symbol.iterator) return target[Symbol.iterator].bind(target);
      const idx = Number(prop);
      if (!isNaN(idx)) return target[idx];
      return undefined;
    },
  }) as unknown as DataTransferItemList;

  // Build FileList-like object
  const filesProxy = new Proxy(files, {
    get(target, prop) {
      if (prop === "length") return target.length;
      if (prop === Symbol.iterator) return target[Symbol.iterator].bind(target);
      const idx = Number(prop);
      if (!isNaN(idx)) return target[idx];
      return undefined;
    },
  }) as unknown as FileList;

  const dataTransfer = {
    items: itemsProxy,
    files: filesProxy,
    dropEffect: "none" as DataTransfer["dropEffect"],
  };

  Object.defineProperty(event, "dataTransfer", {
    value: dataTransfer,
    writable: true,
    configurable: true,
  });

  return event;
}

function fireDragEvent(target: EventTarget, event: DragEvent) {
  act(() => {
    target.dispatchEvent(event);
  });
}

// ---------------------------------------------------------------------------
// useDropZone tests
// ---------------------------------------------------------------------------

describe("useDropZone()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("valid file type drop updates files$ and resets isOverDropZone$", () => {
    const div = createDiv();
    const file = createFile("image.png", "image/png");

    const { result } = renderHook(() =>
      useDropZone(wrapEl(div) as any, { dataTypes: ["image/png"] }),
    );

    const dropEvent = createDragEvent("drop", [file], ["image/png"]);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).toHaveLength(1);
    expect(result.current.files$.get()![0].type).toBe("image/png");
    expect(result.current.isOverDropZone$.get()).toBe(false);
  });

  it("invalid file type drop keeps files$ null and calls onDrop(null)", () => {
    const div = createDiv();
    const onDrop = vi.fn();
    const file = createFile("doc.txt", "text/plain");

    const { result } = renderHook(() =>
      useDropZone(wrapEl(div) as any, {
        dataTypes: ["image/png"],
        onDrop,
      }),
    );

    const dropEvent = createDragEvent("drop", [file], ["text/plain"]);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).toBeNull();
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0]).toBeNull();
  });

  it("nested child dragenter/dragleave keeps isOverDropZone$ stable", () => {
    const div = createDiv();
    const child = document.createElement("div");
    div.appendChild(child);

    const { result } = renderHook(() => useDropZone(wrapEl(div) as any));

    // dragenter on target → counter = 1
    fireDragEvent(div, createDragEvent("dragenter", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(true);

    // dragenter on child → counter = 2
    fireDragEvent(div, createDragEvent("dragenter", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(true);

    // dragleave from target → counter = 1 (moved to child)
    fireDragEvent(div, createDragEvent("dragleave", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(true); // counter > 0, still over

    // dragleave from child → counter = 0 (fully left zone)
    fireDragEvent(div, createDragEvent("dragleave", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(false);
  });

  it("dragleave when counter is 0 does not underflow", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDropZone(wrapEl(div) as any));

    fireDragEvent(div, createDragEvent("dragleave", [], []));

    expect(result.current.isOverDropZone$.get()).toBe(false);
  });

  it("multiple: false returns only first file", () => {
    const div = createDiv();
    const files = [
      createFile("a.png", "image/png"),
      createFile("b.png", "image/png"),
      createFile("c.png", "image/png"),
    ];

    const { result } = renderHook(() =>
      useDropZone(wrapEl(div) as any, { multiple: false }),
    );

    const mimeTypes = files.map((f) => f.type);
    const dropEvent = createDragEvent("drop", files, mimeTypes);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).toHaveLength(1);
    expect(result.current.files$.get()![0].name).toBe("a.png");
  });

  it("multiple: true (default) returns all files", () => {
    const div = createDiv();
    const files = [
      createFile("a.png", "image/png"),
      createFile("b.png", "image/png"),
      createFile("c.png", "image/png"),
    ];

    const { result } = renderHook(() => useDropZone(wrapEl(div) as any));

    const mimeTypes = files.map((f) => f.type);
    const dropEvent = createDragEvent("drop", files, mimeTypes);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).toHaveLength(3);
  });

  it("dataTypes as function — custom validation", () => {
    const div = createDiv();

    const { result } = renderHook(() =>
      useDropZone(wrapEl(div) as any, {
        dataTypes: (types) => types.every((t) => t.startsWith("image/")),
      }),
    );

    // valid: all image/
    const validFiles = [
      createFile("a.jpeg", "image/jpeg"),
      createFile("b.png", "image/png"),
    ];
    fireDragEvent(
      div,
      createDragEvent("drop", validFiles, validFiles.map((f) => f.type)),
    );
    expect(result.current.files$.get()).toHaveLength(2);

    // invalid: includes text/plain
    const invalidFiles = [
      createFile("a.png", "image/png"),
      createFile("b.txt", "text/plain"),
    ];
    fireDragEvent(
      div,
      createDragEvent("drop", invalidFiles, invalidFiles.map((f) => f.type)),
    );
    expect(result.current.files$.get()).toBeNull();
  });

  it("checkValidity takes priority over dataTypes", () => {
    const div = createDiv();
    const file = createFile("doc.txt", "text/plain");

    const { result } = renderHook(() =>
      useDropZone(wrapEl(div) as any, {
        dataTypes: ["image/png"],
        checkValidity: () => true, // always allow
      }),
    );

    const dropEvent = createDragEvent("drop", [file], ["text/plain"]);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).not.toBeNull();
  });

  it("options as function — treated as onDrop shorthand", () => {
    const div = createDiv();
    const onDrop = vi.fn();
    const file = createFile("a.png", "image/png");

    const { result } = renderHook(() => useDropZone(wrapEl(div) as any, onDrop));

    const dropEvent = createDragEvent("drop", [file], ["image/png"]);
    fireDragEvent(div, dropEvent);

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0]).toHaveLength(1);
    expect(result.current.files$.get()).not.toBeNull();
  });

  it("onEnter, onOver, onLeave callbacks are called", () => {
    const div = createDiv();
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const onOver = vi.fn();

    renderHook(() =>
      useDropZone(wrapEl(div) as any, { onEnter, onLeave, onOver }),
    );

    fireDragEvent(div, createDragEvent("dragenter", [], []));
    expect(onEnter).toHaveBeenCalledTimes(1);

    fireDragEvent(div, createDragEvent("dragover", [], []));
    expect(onOver).toHaveBeenCalledTimes(1);

    fireDragEvent(div, createDragEvent("dragleave", [], []));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave.mock.calls[0][0]).toBeNull();
  });

  it("isOverDropZone$ is true after dragenter, false after drop", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDropZone(wrapEl(div) as any));

    fireDragEvent(div, createDragEvent("dragenter", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(true);

    fireDragEvent(div, createDragEvent("drop", [], []));
    expect(result.current.isOverDropZone$.get()).toBe(false);
  });

  it("drop with no files keeps files$ null", () => {
    const div = createDiv();
    const { result } = renderHook(() => useDropZone(wrapEl(div) as any));

    const dropEvent = createDragEvent("drop", [], []);
    fireDragEvent(div, dropEvent);

    expect(result.current.files$.get()).toBeNull();
  });

  it("unmount removes event listeners", () => {
    const div = createDiv();
    const removeSpy = vi.spyOn(div, "removeEventListener");

    const { unmount } = renderHook(() => useDropZone(wrapEl(div) as any));
    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });
});
