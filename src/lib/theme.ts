/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const THEME_STORAGE_KEY = 'billsplit-theme';

export function readDomIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function getStoredTheme(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Toggle root `dark` class and persist choice (call from theme control only). */
export function toggleStoredTheme(): boolean {
  const next = !readDomIsDark();
  document.documentElement.classList.toggle('dark', next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
  } catch {
    /* ignore */
  }
  return next;
}
