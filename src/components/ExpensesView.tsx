/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Calendar, PieChart, Receipt, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { SavedReceipt } from '../types';
import { formatCurrency } from '../lib/utils';
import { aggregateMyExpenses } from '../lib/myExpenses';

interface ExpensesViewProps {
  history: SavedReceipt[];
  myDisplayName: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Grocery: '#10B981',
  Electronics: '#3B82F6',
  Household: '#F59E0B',
  Clothing: '#EC4899',
  'Personal Care': '#8B5CF6',
  Pet: '#84CC16',
  Pharmacy: '#06B6D4',
  Kitchen: '#EF4444',
  Entertainment: '#F97316',
  'Tax & Fees': '#64748B',
  Other: '#94A3B8',
};

const colorFor = (cat: string) => CATEGORY_COLORS[cat] || '#94A3B8';

export default function ExpensesView({ history, myDisplayName }: ExpensesViewProps) {
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);

  const result = useMemo(
    () => aggregateMyExpenses(history, myDisplayName),
    [history, myDisplayName]
  );

  const filtered = useMemo(() => {
    if (!monthFilter) return result;
    const entries = result.entries.filter((e) => e.monthKey === monthFilter);
    const total = entries.reduce((s, e) => s + e.total, 0);
    const catMap = new Map<string, number>();
    entries.forEach((e) =>
      e.categoryBreakdown.forEach((c) =>
        catMap.set(c.category, (catMap.get(c.category) || 0) + c.amount)
      )
    );
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      ...result,
      entries,
      grandTotal: total,
      receiptCount: entries.length,
      byCategory,
    };
  }, [result, monthFilter]);

  if (history.length === 0 || result.receiptCount === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-indigo-300">
          <Wallet className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-slate-400">No expenses tracked yet</h3>
        <p className="text-slate-500 max-w-sm mx-auto font-medium">
          Save receipts where you're a participant to see your spending here.
        </p>
      </div>
    );
  }

  const maxCategory = filtered.byCategory[0]?.amount || 1;
  const maxMonth = result.byMonth.reduce((m, x) => Math.max(m, x.amount), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Hero total */}
      <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
        <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10 group-hover:scale-110 transition-transform">
          <TrendingUp className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">
            {monthFilter ? `Your spending — ${filtered.entries[0]?.monthLabel ?? ''}` : 'Your total spending'}
          </p>
          <h2 className="text-5xl font-black">{formatCurrency(filtered.grandTotal, filtered.currency)}</h2>
          <p className="text-indigo-200 mt-2 font-medium">
            Across {filtered.receiptCount} receipt{filtered.receiptCount === 1 ? '' : 's'}
            {monthFilter && (
              <button
                onClick={() => setMonthFilter(null)}
                className="ml-3 underline hover:no-underline font-bold"
              >
                Clear filter
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By month */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> By Month
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-5 italic">Click a month to filter below</p>
          <div className="space-y-3">
            {result.byMonth.map((m) => {
              const pct = (m.amount / maxMonth) * 100;
              const active = monthFilter === m.monthKey;
              return (
                <button
                  key={m.monthKey}
                  onClick={() => setMonthFilter(active ? null : m.monthKey)}
                  className={`w-full text-left rounded-2xl p-3 border transition-all ${
                    active
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {m.monthLabel}
                    </span>
                    <span className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-900'}`}>
                      {formatCurrency(m.amount, result.currency)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* By category */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-500" /> By Category
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-5 italic">
            {monthFilter ? 'For selected month' : 'All time'}
          </p>
          <div className="space-y-3">
            {filtered.byCategory.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No categorized spending.</p>
            ) : (
              filtered.byCategory.map((c) => {
                const pct = (c.amount / maxCategory) * 100;
                const totalPct = filtered.grandTotal > 0 ? (c.amount / filtered.grandTotal) * 100 : 0;
                return (
                  <div key={c.category} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: colorFor(c.category) }}
                        />
                        <span className="text-sm font-bold text-slate-800">{c.category}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {totalPct.toFixed(0)}%
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(c.amount, result.currency)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: colorFor(c.category) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Receipts list */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-500" /> Receipts
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-2">
            {filtered.entries.length}
          </span>
        </h3>
        <div className="space-y-3">
          {filtered.entries.map((e) => {
            const isOpen = expandedReceipt === e.id;
            return (
              <div
                key={e.id}
                className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedReceipt(isOpen ? null : e.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-bold text-slate-900 truncate">{e.merchantName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {e.date} · {e.monthLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-bold text-indigo-600">
                      {formatCurrency(e.total, e.currency)}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200 bg-white"
                    >
                      <div className="p-4 space-y-2">
                        {e.categoryBreakdown.map((c) => (
                          <div
                            key={c.category}
                            className="flex justify-between items-center text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: colorFor(c.category) }}
                              />
                              <span className="text-slate-700 font-medium">{c.category}</span>
                            </div>
                            <span className="text-slate-900 font-bold">
                              {formatCurrency(c.amount, e.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
