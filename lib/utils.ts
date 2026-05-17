import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Reads the stored user object and returns the uppercase first letter of `name`. */
export function getStoredNameInitial(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const name: string = JSON.parse(raw)?.name ?? '';
    return name.trim().charAt(0).toUpperCase();
  } catch {
    return '';
  }
}

/** Returns the uppercase first letter of a name string. */
export function getNameInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
