/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedReceipt } from '../types';

export const ME_AGGREGATE_KEY = '__ME__';

export interface PersonReceiptDetail {
  merchantName: string;
  date: string;
  currency: string;
  items: { name: string; sharePrice: number }[];
  sharedFees: number;
  totalForReceipt: number;
}

export interface BalanceRow {
  key: string;
  displayName: string;
  total: number;
  currency: string;
  color: string;
  receiptDetails: PersonReceiptDetail[];
}

export interface OwedBalancesResult {
  meLabel: string;
  balanceList: BalanceRow[];
  youBalance: BalanceRow | undefined;
  others: BalanceRow[];
  /** Sum of non–"you" participants' totals across saved receipts (same as Totals tab). */
  grandTotalOwedToYou: number;
}

export function aggregateOwedBalances(
  history: SavedReceipt[],
  myDisplayName: string
): OwedBalancesResult {
  const meLabel = (myDisplayName || 'You').trim() || 'You';
  const isMePersonName = (name: string) => {
    const n = name.trim().toLowerCase();
    const me = meLabel.toLowerCase();
    return n === 'you' || n === me;
  };

  const balances = new Map<
    string,
    { total: number; currency: string; color: string; receiptDetails: PersonReceiptDetail[] }
  >();

  history.forEach((entry) => {
    const splitCount = entry.people.length || 1;
    const taxShare = (entry.data.tax || 0) / splitCount;
    const tipShare = (entry.data.tip || 0) / splitCount;
    const feesShare = (entry.data.fees || 0) / splitCount;
    const combinedSharedFees = taxShare + tipShare + feesShare;

    entry.people.forEach((person) => {
      let itemsTotal = 0;
      const myItems: { name: string; sharePrice: number }[] = [];

      entry.data.items.forEach((item) => {
        const sharesOfPerson = item.splitWith.filter((id) => id === person.id).length;
        if (sharesOfPerson > 0) {
          const share = (item.price / item.splitWith.length) * sharesOfPerson;
          itemsTotal += share;
          myItems.push({ name: item.name, sharePrice: share });
        }
      });

      const personTotal = itemsTotal + combinedSharedFees;
      const nameKey = isMePersonName(person.name) ? ME_AGGREGATE_KEY : person.name.trim();
      const merchant =
        entry.data.merchantName ||
        `Receipt from ${entry.data.date || new Date(entry.timestamp).toLocaleDateString()}`;

      const detail: PersonReceiptDetail = {
        merchantName: merchant,
        date: entry.data.date || new Date(entry.timestamp).toLocaleDateString(),
        currency: entry.data.currency || 'USD',
        items: myItems,
        sharedFees: combinedSharedFees,
        totalForReceipt: personTotal,
      };

      if (balances.has(nameKey)) {
        const b = balances.get(nameKey)!;
        b.total += personTotal;
        b.receiptDetails.push(detail);
      } else {
        balances.set(nameKey, {
          total: personTotal,
          currency: detail.currency,
          color: person.color,
          receiptDetails: [detail],
        });
      }
    });
  });

  const balanceList: BalanceRow[] = Array.from(balances.entries())
    .map(([key, data]) => ({
      key,
      displayName: key === ME_AGGREGATE_KEY ? meLabel : key,
      ...data,
    }))
    .sort((a, b) => b.total - a.total);

  const youBalance = balanceList.find((b) => b.key === ME_AGGREGATE_KEY);
  const others = balanceList.filter((b) => b.key !== ME_AGGREGATE_KEY);
  const grandTotalOwedToYou = others.reduce((sum, p) => sum + p.total, 0);

  return { meLabel, balanceList, youBalance, others, grandTotalOwedToYou };
}
