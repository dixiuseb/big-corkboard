"use client";

import { createContext, useContext } from "react";
import type { NoteColorKey } from "@/lib/noteColors";

/** Active category filter color, or `null` when no filter. */
export type CategoryFilterValue = NoteColorKey | null;

export const CategoryFilterContext = createContext<CategoryFilterValue>(null);

export function useCategoryFilter(): CategoryFilterValue {
  return useContext(CategoryFilterContext);
}
