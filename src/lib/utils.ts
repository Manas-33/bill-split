/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** YYYY-MM-DD in local timezone (for date inputs, not UTC midnight). */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize a receipt date string for <input type="date" />.
 * Accepts ISO YYYY-MM-DD or parses common date strings; falls back to today.
 */
export function toDateInputValue(raw: string | undefined): string {
  if (!raw?.trim()) {
    return toIsoDateLocal(new Date());
  }
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDateLocal(parsed);
  }
  return toIsoDateLocal(new Date());
}
