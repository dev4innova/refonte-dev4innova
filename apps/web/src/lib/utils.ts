import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names and resolves conflicting Tailwind utilities (last wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
