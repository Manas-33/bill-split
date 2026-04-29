/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  splitWith: string[]; // IDs of people sharing this item
}

export interface ExtractedReceipt {
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  fees: number;    // New: To track bag fees, delivery fees
  merchantName?: string;
  total: number;
  date: string;
  orderNumber?: string;
  currency: string;
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface SavedReceipt {
  id: string;
  data: ExtractedReceipt;
  people: Person[];
  timestamp: number;
}

export const CATEGORIES = [
  'Grocery',
  'Electronics',
  'Household',
  'Clothing',
  'Personal Care',
  'Pet',
  'Pharmacy',
  'Kitchen',
  'Entertainment',
  'Transportation',
  'Subscriptions',
  'Health',
  'Dining',
  'Other'
];

export const PERSON_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];
