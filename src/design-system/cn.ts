import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves Tailwind conflicts, so that a `className`
 * passed by a caller reliably wins over a component's own default rather than
 * depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
