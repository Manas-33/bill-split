/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedReceipt } from '../types';

export interface ExpenseReceiptEntry {
  id: string;
  merchantName: string;
  date: string;
  monthKey: string;
  monthLabel: string;
  total: number;
  currency: string;
  categoryBreakdown: { category: string; amount: number }[];
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export interface MonthTotal {
  monthKey: string;
  monthLabel: string;
  amount: number;
}

export interface MyExpensesResult {
  grandTotal: number;
  currency: string;
  receiptCount: number;
  byCategory: CategoryTotal[];
  byMonth: MonthTotal[];
  entries: ExpenseReceiptEntry[];
}

const TAX_FEES_CATEGORY = 'Tax & Fees';

function parseReceiptDate(dateStr: string | undefined, fallbackTs: number): Date {
  if (dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(fallbackTs);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function aggregateMyExpenses(
  history: SavedReceipt[],
  myDisplayName: string
): MyExpensesResult {
  const meLabel = (myDisplayName || 'You').trim().toLowerCase() || 'you';
  const isMe = (person: { id: string; name: string }) => {
    if (person.id === '1') return true;
    const n = person.name.trim().toLowerCase();
    return n === 'you' || n === meLabel;
  };

  const categoryMap = new Map<string, number>();
  const monthMap = new Map<string, { label: string; amount: number }>();
  const entries: ExpenseReceiptEntry[] = [];
  let grandTotal = 0;
  let currency = 'USD';

  history.forEach((entry) => {
    const me = entry.people.find(isMe);
    if (!me) return;

    const splitCount = entry.people.length || 1;
    const taxShare = (entry.data.tax || 0) / splitCount;
    const tipShare = (entry.data.tip || 0) / splitCount;
    const feesShare = (entry.data.fees || 0) / splitCount;
    const sharedFees = taxShare + tipShare + feesShare;

    const perCategory = new Map<string, number>();
    let myItemsTotal = 0;

    entry.data.items.forEach((item) => {
      const myShares = item.splitWith.filter((id) => id === me.id).length;
      if (myShares === 0 || item.splitWith.length === 0) return;
      const share = (item.price / item.splitWith.length) * myShares;
      myItemsTotal += share;
      const cat = item.category || 'Other';
      perCategory.set(cat, (perCategory.get(cat) || 0) + share);
    });

    if (sharedFees > 0) {
      perCategory.set(
        TAX_FEES_CATEGORY,
        (perCategory.get(TAX_FEES_CATEGORY) || 0) + sharedFees
      );
    }

    const myTotal = myItemsTotal + sharedFees;
    if (myTotal <= 0) return;

    grandTotal += myTotal;
    currency = entry.data.currency || currency;

    perCategory.forEach((amt, cat) => {
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
    });

    const d = parseReceiptDate(entry.data.date, entry.timestamp);
    const mKey = monthKey(d);
    const mLabel = monthLabel(d);
    const existing = monthMap.get(mKey);
    if (existing) {
      existing.amount += myTotal;
    } else {
      monthMap.set(mKey, { label: mLabel, amount: myTotal });
    }

    entries.push({
      id: entry.id,
      merchantName:
        entry.data.merchantName ||
        `Receipt from ${entry.data.date || new Date(entry.timestamp).toLocaleDateString()}`,
      date: entry.data.date || new Date(entry.timestamp).toLocaleDateString(),
      monthKey: mKey,
      monthLabel: mLabel,
      total: myTotal,
      currency: entry.data.currency || 'USD',
      categoryBreakdown: Array.from(perCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    });
  });

  const byCategory: CategoryTotal[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth: MonthTotal[] = Array.from(monthMap.entries())
    .map(([monthKey, v]) => ({ monthKey, monthLabel: v.label, amount: v.amount }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));

  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    grandTotal,
    currency,
    receiptCount: entries.length,
    byCategory,
    byMonth,
    entries,
  };
}
