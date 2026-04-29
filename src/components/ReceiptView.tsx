/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CATEGORIES, ExtractedReceipt, Person } from "../types";
import { formatCurrency } from "../lib/utils";
import {
  Tag,
  User,
  Plus,
  Trash2,
  Minus,
  ChevronDown,
  ListPlus,
  Inbox,
} from "lucide-react";

interface ReceiptViewProps {
  receipt: ExtractedReceipt;
  people: Person[];
  onAddShare: (itemId: string, personId: string) => void;
  onRemoveShare: (itemId: string, personId: string) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onUpdateItemName: (itemId: string, newName: string) => void;
  onUpdateCategory: (itemId: string, newCategory: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: () => void;
  onUpdateMetadata: (
    field: keyof ExtractedReceipt,
    value: number | string,
  ) => void;
}

export default function ReceiptView({
  receipt,
  people,
  onAddShare,
  onRemoveShare,
  onUpdatePrice,
  onUpdateItemName,
  onUpdateCategory,
  onUpdateQuantity,
  onDeleteItem,
  onAddItem,
  onUpdateMetadata,
}: ReceiptViewProps) {
  const hasItems = receipt.items.length > 0;

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/80">
            <th className="py-5 px-7 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Item
            </th>
            <th className="py-5 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
              Qty
            </th>
            <th className="py-5 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">
              Price
            </th>
            <th className="py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Split With
            </th>
            <th className="py-5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 sr-only">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {hasItems ? (
            receipt.items.map((item) => (
              <tr
                key={item.id}
                className="group transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5"
              >
                <td className="py-6 px-7 align-top">
                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        onUpdateItemName(item.id, e.target.value)
                      }
                      className="font-bold text-sm text-slate-800 dark:text-slate-100 bg-transparent outline-none rounded-md px-1.5 -mx-1.5 py-1 -my-1 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-400 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-medium"
                      placeholder="Item name"
                    />
                    <div className="flex items-center gap-2">
                      <label
                        className="group/cat relative inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white dark:focus-within:bg-slate-800"
                        aria-label={`Category for ${item.name || "item"}`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{item.category || "Uncategorized"}</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60 group-hover/cat:opacity-100" />
                        <select
                          value={item.category}
                          onChange={(e) =>
                            onUpdateCategory(item.id, e.target.value)
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label="Item category"
                        >
                          {!CATEGORIES.includes(item.category) &&
                            item.category && (
                              <option value={item.category}>
                                {item.category}
                              </option>
                            )}
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4 text-center align-top">
                  <div
                    className="mx-auto inline-flex items-stretch overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-300 transition-colors"
                    role="group"
                    aria-label={`Quantity for ${item.name || "item"}`}
                  >
                    <button
                      type="button"
                      className="flex w-7 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 active:bg-slate-200 dark:active:bg-slate-600 disabled:pointer-events-none disabled:opacity-30"
                      disabled={item.quantity <= 0.01 + 1e-9}
                      onClick={() => {
                        const next = Math.max(
                          0.01,
                          +(item.quantity - 1).toFixed(4),
                        );
                        onUpdateQuantity(item.id, next);
                      }}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        onUpdateQuantity(
                          item.id,
                          Number.isFinite(v) ? v : item.quantity,
                        );
                      }}
                      className="w-10 border-x border-slate-200 dark:border-slate-700 bg-transparent py-1.5 text-center text-xs font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Quantity value"
                    />
                    <button
                      type="button"
                      className="flex w-7 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 active:bg-slate-200 dark:active:bg-slate-600"
                      onClick={() => {
                        const next = +(item.quantity + 1).toFixed(4);
                        onUpdateQuantity(item.id, next);
                      }}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                </td>
                <td className="py-6 px-5 text-right align-top">
                  <label className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 -mx-2 -my-1.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 transition-colors">
                    <span className="text-slate-400 dark:text-slate-500 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        onUpdatePrice(item.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 bg-transparent text-right outline-none font-black tabular-nums text-slate-900 dark:text-slate-100"
                      aria-label="Item price"
                    />
                  </label>
                </td>
                <td className="py-6 px-6 align-top">
                  <div className="grid grid-cols-[auto_auto] gap-2 justify-start">
                    {people.map((person) => {
                      const shares = item.splitWith.filter(
                        (id) => id === person.id,
                      ).length;
                      const isSelected = shares > 0;

                      if (!isSelected) {
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => onAddShare(item.id, person.id)}
                            className="flex w-full h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-bold tracking-tight whitespace-nowrap bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            title={`Add ${person.name}`}
                            aria-label={`Add ${person.name} to ${item.name || "item"}`}
                          >
                            <User
                              className="w-3.5 h-3.5 shrink-0"
                              strokeWidth={2.25}
                            />
                            <span>{person.name}</span>
                          </button>
                        );
                      }

                      return (
                        <div key={person.id} className="relative w-full">
                          <div
                            className="flex w-full items-stretch h-8 rounded-full overflow-hidden text-white font-bold text-[11px] tracking-tight transition-[filter] hover:brightness-105"
                            style={{
                              backgroundColor: person.color,
                              boxShadow: `0 1px 0 ${person.color}, 0 4px 12px -3px ${person.color}66`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onRemoveShare(item.id, person.id)}
                              className="w-7 shrink-0 flex items-center justify-center bg-black/10 hover:bg-black/25 active:bg-black/30 focus:outline-none focus:bg-black/30 transition-colors border-r border-white/15"
                              title={
                                shares > 1
                                  ? `Remove a share from ${person.name}`
                                  : `Remove ${person.name}`
                              }
                              aria-label={
                                shares > 1
                                  ? `Remove a share from ${person.name}`
                                  : `Remove ${person.name}`
                              }
                            >
                              <Minus className="w-3 h-3" strokeWidth={3} />
                            </button>
                            <div className="flex-1 px-3 flex items-center justify-center whitespace-nowrap">
                              <span>{person.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onAddShare(item.id, person.id)}
                              className="w-7 shrink-0 flex items-center justify-center bg-black/10 hover:bg-black/25 active:bg-black/30 focus:outline-none focus:bg-black/30 transition-colors border-l border-white/15"
                              title={`Add another share for ${person.name}`}
                              aria-label={`Add another share for ${person.name}`}
                            >
                              <Plus className="w-3 h-3" strokeWidth={3} />
                            </button>
                          </div>
                          {shares > 1 && (
                            <span
                              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-black tabular-nums text-white ring-2 ring-white dark:ring-slate-900 pointer-events-none"
                              style={{ backgroundColor: person.color }}
                              aria-label={`${shares} shares`}
                            >
                              ×{shares}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="py-6 px-3 align-top">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="py-14 px-6 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                  <Inbox className="w-8 h-8" strokeWidth={1.75} />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    No line items yet
                  </p>
                  <p className="text-xs font-medium">
                    Use the button below to add your first item.
                  </p>
                </div>
              </td>
            </tr>
          )}

          <tr>
            <td colSpan={5} className="py-4 px-7">
              <button
                type="button"
                onClick={onAddItem}
                className="group/add w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-transparent hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 border border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/60 px-4 py-2.5 rounded-xl transition-colors"
              >
                <ListPlus className="w-4 h-4 transition-transform group-hover/add:scale-110" />
                Add line item
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr className="bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/80">
            <td
              colSpan={2}
              className="py-3 px-7 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
            >
              Subtotal
            </td>
            <td className="py-3 px-5 text-right text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
              {formatCurrency(receipt.subtotal, receipt.currency)}
            </td>
            <td colSpan={2} />
          </tr>

          <tr className="bg-slate-50/60 dark:bg-slate-800/40">
            <td
              colSpan={2}
              className="py-2 px-7 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
            >
              Tax
            </td>
            <td className="py-2 px-5 text-right">
              <label className="inline-flex items-center justify-end gap-0.5 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-white/60 dark:hover:bg-slate-800/60 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 transition-colors">
                <span className="text-indigo-300 dark:text-indigo-500/70 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={receipt.tax}
                  onChange={(e) =>
                    onUpdateMetadata("tax", parseFloat(e.target.value) || 0)
                  }
                  className="w-16 bg-transparent text-right outline-none font-black tabular-nums text-indigo-600 dark:text-indigo-400"
                  aria-label="Tax amount"
                />
              </label>
            </td>
            <td colSpan={2} />
          </tr>

          <tr className="bg-slate-50/60 dark:bg-slate-800/40">
            <td
              colSpan={2}
              className="py-2 px-7 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
            >
              Tip
            </td>
            <td className="py-2 px-5 text-right">
              <label className="inline-flex items-center justify-end gap-0.5 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-white/60 dark:hover:bg-slate-800/60 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-400 transition-colors">
                <span className="text-emerald-300 dark:text-emerald-500/70 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={receipt.tip || 0}
                  onChange={(e) =>
                    onUpdateMetadata("tip", parseFloat(e.target.value) || 0)
                  }
                  className="w-16 bg-transparent text-right outline-none font-black tabular-nums text-emerald-600 dark:text-emerald-400"
                  aria-label="Tip amount"
                />
              </label>
            </td>
            <td colSpan={2} />
          </tr>

          <tr className="bg-slate-50/60 dark:bg-slate-800/40">
            <td
              colSpan={2}
              className="py-2 px-7 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"
            >
              Fees
            </td>
            <td className="py-2 px-5 text-right">
              <label className="inline-flex items-center justify-end gap-0.5 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-white/60 dark:hover:bg-slate-800/60 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-rose-400 transition-colors">
                <span className="text-rose-300 dark:text-rose-500/70 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={receipt.fees || 0}
                  onChange={(e) =>
                    onUpdateMetadata("fees", parseFloat(e.target.value) || 0)
                  }
                  className="w-16 bg-transparent text-right outline-none font-black tabular-nums text-rose-600 dark:text-rose-400"
                  aria-label="Fees amount"
                />
              </label>
            </td>
            <td colSpan={2} />
          </tr>

          <tr className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
            <td
              colSpan={2}
              className="py-5 px-7 text-right text-[11px] font-bold uppercase tracking-widest text-slate-300"
            >
              Grand Total
            </td>
            <td className="py-5 px-5 text-right text-lg font-black tabular-nums">
              {formatCurrency(receipt.total, receipt.currency)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
