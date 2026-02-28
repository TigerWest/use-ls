"use client";
import { type UseScrollOptions, type UseScrollReturn, useScroll } from "../useScroll";
import { defaultWindow } from "../../shared/configurable";

export type { UseScrollOptions, UseScrollReturn };

export function useWindowScroll(options?: UseScrollOptions): UseScrollReturn {
  return useScroll(
    defaultWindow ?? null,
    options,
  );
}
