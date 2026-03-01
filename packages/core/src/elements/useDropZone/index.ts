"use client";
import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useRef } from "react";
import { useMaybeObservable } from "../../function/useMaybeObservable";
import type { DeepMaybeObservable } from "../../types";
import { type MaybeElement } from "../useRef$";
import { useEventListener } from "../../browser/useEventListener";

export interface UseDropZoneOptions {
  dataTypes?: string[] | ((types: readonly string[]) => boolean);
  checkValidity?: (items: DataTransferItemList) => boolean;
  onDrop?: (files: File[] | null, event: DragEvent) => void;
  onEnter?: (files: File[] | null, event: DragEvent) => void;
  onLeave?: (files: File[] | null, event: DragEvent) => void;
  onOver?: (files: File[] | null, event: DragEvent) => void;
  multiple?: boolean;
  preventDefaultForUnhandled?: boolean;
}

export interface UseDropZoneReturn {
  files$: Observable<File[] | null>;
  isOverDropZone$: Observable<boolean>;
}

/**
 * Turns any element into a file drop zone. Tracks drag-over state and validates
 * file types before accepting drops.
 *
 * @param target - Element to watch: Ref$, Observable<OpaqueObject<Element>|null>, Document, Window, or null
 * @param options - Configuration options (supports DeepMaybeObservable) or an onDrop callback shorthand
 * @returns { files$, isOverDropZone$ } — reactive observables
 *
 * @example
 * ```tsx
 * const el$ = useRef$<HTMLDivElement>()
 * const { files$, isOverDropZone$ } = useDropZone(el$, {
 *   onDrop: (files) => console.log(files),
 * })
 * return <div ref={el$}>Drop files here</div>
 * ```
 */
export function useDropZone(
  target: MaybeElement,
  options?: DeepMaybeObservable<UseDropZoneOptions> | UseDropZoneOptions["onDrop"]
): UseDropZoneReturn {
  // If options is a function, treat it as the onDrop shorthand
  const normalizedOptions = typeof options === "function" ? { onDrop: options } : options;

  // Normalize DeepMaybeObservable options with per-field resolution hints.
  // 'function': callback fields — Legend-State stores the function directly,
  //             not as a child observable → access via opts$.peek()?.fieldName
  // 'plain':    dataTypes — string[] | fn union, prevents deep-proxy wrapping
  const opts$ = useMaybeObservable(normalizedOptions, {
    onDrop: "function",
    onEnter: "function",
    onLeave: "function",
    onOver: "function",
    checkValidity: "function",
    dataTypes: "plain",
  });

  const files$ = useObservable<File[] | null>(null);
  const isOver$ = useObservable<boolean>(false);

  // Plain React ref for counter — access via .current
  const counter = useRef(0);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek() does not create reactive subscription, empty deps [] is intentional
  const isValidDrop = useCallback((event: DragEvent): boolean => {
    const items = event.dataTransfer?.items;
    if (!items) return false;

    // Safari detection: UA contains 'Safari' but not 'Chrome' (SSR guard required)
    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) return true;

    // 'get.function' hint fields: access via opts$.peek()?.fieldName pattern
    const checkValidity = opts$.peek()?.checkValidity;
    if (checkValidity) return checkValidity(items);

    const dataTypes = opts$.peek()?.dataTypes;
    if (dataTypes) {
      const types = Array.from(items).map((i) => i.type);
      if (typeof dataTypes === "function") return dataTypes(types);
      return dataTypes.some((t) => types.includes(t));
    }
    return true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.get() does not create reactive subscription, empty deps [] is intentional
  const getFiles = useCallback((event: DragEvent): File[] | null => {
    const fileList = Array.from(event.dataTransfer?.files ?? []);
    if (!fileList.length) return null;
    const multiple = opts$.multiple?.get();
    return multiple === false ? [fileList[0]] : fileList;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.set() does not create reactive subscription, empty deps [] is intentional
  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    counter.current++;
    const valid = isValidDrop(e);
    if (valid) {
      e.dataTransfer!.dropEffect = "copy";
      isOver$.set(true);
      opts$.peek()?.onEnter?.(getFiles(e), e);
    } else {
      e.dataTransfer!.dropEffect = "none";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.set() does not create reactive subscription, empty deps [] is intentional
  const onDragLeave = useCallback((e: DragEvent) => {
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) {
      isOver$.set(false);
      opts$.peek()?.onLeave?.(null, e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.set() does not create reactive subscription, empty deps [] is intentional
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (isValidDrop(e)) {
      e.dataTransfer!.dropEffect = "copy";
      opts$.peek()?.onOver?.(getFiles(e), e);
    } else {
      e.dataTransfer!.dropEffect = "none";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Legend-State: .peek()/.set() does not create reactive subscription, empty deps [] is intentional
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    counter.current = 0;
    isOver$.set(false);
    if (isValidDrop(e)) {
      const droppedFiles = getFiles(e);
      files$.set(droppedFiles);
      opts$.peek()?.onDrop?.(droppedFiles, e);
    } else {
      files$.set(null);
      opts$.peek()?.onDrop?.(null, e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEventListener(target, "dragenter", onDragEnter);
  useEventListener(target, "dragleave", onDragLeave);
  useEventListener(target, "dragover", onDragOver);
  useEventListener(target, "drop", onDrop);

  return { files$, isOverDropZone$: isOver$ };
}
