/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Calendar, PieChart, Receipt, ChevronDown, ChevronUp, Wallet, FileDown } from 'lucide-react';
import { SavedReceipt } from '../types';
import { formatCurrency } from '../lib/utils';
import { aggregateMyExpenses } from '../lib/myExpenses';
import { exportExpensesPdf, exportExpensesXlsx } from '../lib/exportExpenses';

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
  Transportation: '#14B8A6',
  Subscriptions: '#0EA5E9',
  Health: '#F43F5E',
  Dining: '#EAB308',
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
    const month = result.byMonth.find((m) => m.monthKey === monthFilter);
    return {
      ...result,
      entries,
      grandTotal: total,
      receiptCount: entries.length,
      byCategory,
      byMonth: month ? [{ ...month, amount: total }] : [],
    };
  }, [result, monthFilter]);

  const exportTitle = monthFilter
    ? `expenses-${filtered.entries[0]?.monthLabel ?? monthFilter}`
    : 'all-expenses';

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
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-indigo-200 font-medium">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportExpensesXlsx(filtered, exportTitle)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition-colors hover:bg-white/25"
              >
                <FileDown className="w-4 h-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportExpensesPdf(filtered, exportTitle)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition-colors hover:bg-white/25"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MonthBarChart
          months={result.byMonth}
          maxMonth={maxMonth}
          currency={result.currency}
          activeMonthKey={monthFilter}
          onSelect={(key) => setMonthFilter(key)}
        />

        <CategoryDonutChart
          categories={filtered.byCategory}
          grandTotal={filtered.grandTotal}
          currency={filtered.currency}
          subtitle={monthFilter ? 'For selected month' : 'All time'}
        />
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
                      <div className="p-4 space-y-5">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            By Category
                          </p>
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

                        <div className="space-y-2 border-t border-slate-100 pt-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Items Purchased
                          </p>
                          {e.items.length > 0 ? (
                            e.items.map((item, index) => (
                              <div
                                key={`${item.name}-${index}`}
                                className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-3 text-sm"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 truncate">{item.name}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {item.category}
                                    {item.quantity !== 1 ? ` · Qty ${item.quantity}` : ''}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-bold text-indigo-600">
                                    {formatCurrency(item.sharePrice, e.currency)}
                                  </p>
                                  {Math.abs(item.fullPrice - item.sharePrice) > 0.01 && (
                                    <p className="text-[10px] font-medium text-slate-400">
                                      of {formatCurrency(item.fullPrice, e.currency)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm font-medium italic text-slate-400">
                              No item-level expenses for this receipt.
                            </p>
                          )}
                        </div>
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

interface MonthBarChartProps {
  months: { monthKey: string; monthLabel: string; amount: number }[];
  maxMonth: number;
  currency: string;
  activeMonthKey: string | null;
  onSelect: (monthKey: string | null) => void;
}

function MonthBarChart({ months, maxMonth, currency, activeMonthKey, onSelect }: MonthBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = hovered ?? activeMonthKey ?? months[months.length - 1]?.monthKey ?? null;
  const visibleMonth = months.find((m) => m.monthKey === visible) ?? months[months.length - 1];
  const niceMax = niceCeil(maxMonth);
  const avg = months.length > 0 ? months.reduce((s, m) => s + m.amount, 0) / months.length : 0;
  const avgPct = niceMax > 0 ? (avg / niceMax) * 100 : 0;
  const visibleDelta = visibleMonth ? visibleMonth.amount - avg : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1 gap-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" /> By Month
        </h3>
        {visibleMonth && (
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {visibleMonth.monthLabel}
            </p>
            <div className="flex items-baseline justify-end gap-2">
              <p className="text-lg font-black text-slate-900 tabular-nums leading-tight">
                {formatCurrency(visibleMonth.amount, currency)}
              </p>
              {avg > 0 && Math.abs(visibleDelta) > 0.01 && (
                <span
                  className={`text-[10px] font-black tabular-nums ${
                    visibleDelta > 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                  title={`vs average ${formatCompactCurrency(avg, currency)}`}
                >
                  {visibleDelta > 0 ? '↑' : '↓'} {formatCompactCurrency(Math.abs(visibleDelta), currency)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 font-medium mb-5 italic">Click a month to filter below</p>

      {months.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No monthly data.</p>
      ) : (
        <div className="relative pl-11 pr-1">
          <div className="absolute left-0 top-0 bottom-7 flex flex-col justify-between text-[10px] font-bold text-slate-400 tabular-nums">
            <span>{formatCompactCurrency(niceMax, currency)}</span>
            <span>{formatCompactCurrency(niceMax * 0.75, currency)}</span>
            <span>{formatCompactCurrency(niceMax / 2, currency)}</span>
            <span>{formatCompactCurrency(niceMax * 0.25, currency)}</span>
            <span>{formatCompactCurrency(0, currency)}</span>
          </div>

          <div className="relative h-52">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-100" />
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" />

            {avg > 0 && (
              <div
                className="absolute inset-x-0 z-10 pointer-events-none"
                style={{ bottom: `${avgPct}%` }}
              >
                <div className="border-t border-dashed border-amber-400" />
                <div className="absolute -top-2 right-0 text-[9px] font-black tracking-widest uppercase text-amber-600 bg-white px-1.5 rounded">
                  Avg {formatCompactCurrency(avg, currency)}
                </div>
              </div>
            )}

            <div className="relative h-full flex items-end gap-1.5 z-20">
              {months.map((m) => {
                const pct = niceMax > 0 ? (m.amount / niceMax) * 100 : 0;
                const heightPct = Math.max(pct, m.amount > 0 ? 2 : 0);
                const isActive = activeMonthKey === m.monthKey;
                const isHovered = hovered === m.monthKey;
                const showTooltip = isHovered || isActive;
                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => onSelect(isActive ? null : m.monthKey)}
                    onMouseEnter={() => setHovered(m.monthKey)}
                    onMouseLeave={() => setHovered(null)}
                    className="group relative flex-1 h-full flex flex-col justify-end min-w-0"
                    aria-label={`${m.monthLabel}: ${formatCurrency(m.amount, currency)}`}
                  >
                    {showTooltip && m.amount > 0 && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                        style={{ bottom: `calc(${heightPct}% + 10px)` }}
                      >
                        <div className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black text-white tabular-nums whitespace-nowrap shadow-lg">
                          {formatCurrency(m.amount, currency)}
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-slate-900" />
                      </div>
                    )}
                    <div
                      className={`relative w-full rounded-t-md transition-all duration-300 overflow-hidden ${
                        isActive
                          ? 'bg-gradient-to-t from-indigo-700 to-indigo-500 shadow-lg shadow-indigo-200'
                          : isHovered
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-md shadow-indigo-100'
                          : 'bg-gradient-to-t from-indigo-400/85 to-indigo-300/75'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/30 rounded-t-md" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-1.5 mt-2 pl-0">
            {months.map((m) => {
              const isActive = activeMonthKey === m.monthKey;
              const isHovered = hovered === m.monthKey;
              const short = m.monthLabel.split(' ')[0]?.slice(0, 3) ?? m.monthLabel;
              return (
                <div
                  key={`${m.monthKey}-label`}
                  className={`flex-1 text-center text-[10px] font-bold uppercase tracking-wider truncate transition-colors ${
                    isActive
                      ? 'text-indigo-600'
                      : isHovered
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                >
                  {short}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryDonutChartProps {
  categories: { category: string; amount: number }[];
  grandTotal: number;
  currency: string;
  subtitle: string;
}

function CategoryDonutChart({ categories, grandTotal, currency, subtitle }: CategoryDonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = categories.reduce((s, c) => s + c.amount, 0) || grandTotal;

  const size = 208;
  const stroke = 30;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = categories.length > 1 ? 3 : 0;

  let cursor = 0;
  const segments = categories.map((c) => {
    const fraction = total > 0 ? c.amount / total : 0;
    const arcLen = fraction * circumference;
    const dash = Math.max(0, arcLen - gap);
    const seg = { category: c.category, amount: c.amount, fraction, dash, offset: cursor };
    cursor += arcLen;
    return seg;
  });

  const focused = hovered ? categories.find((c) => c.category === hovered) : null;
  const focusedColor = focused ? colorFor(focused.category) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-indigo-500" /> By Category
      </h3>
      <p className="text-xs text-slate-400 font-medium mb-5 italic">{subtitle}</p>

      {categories.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400 italic">
          No categorized spending.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90 overflow-visible">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth={stroke}
              />
              {segments.map((seg) => {
                const isHovered = hovered === seg.category;
                const isDimmed = hovered !== null && !isHovered;
                return (
                  <circle
                    key={seg.category}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={colorFor(seg.category)}
                    strokeWidth={isHovered ? stroke + 8 : stroke}
                    strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                    strokeDashoffset={-seg.offset}
                    strokeLinecap="butt"
                    className="transition-all duration-300 cursor-pointer"
                    style={{ opacity: isDimmed ? 0.28 : 1 }}
                    onMouseEnter={() => setHovered(seg.category)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-5">
              {focused ? (
                <>
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mb-2"
                    style={{ backgroundColor: focusedColor || undefined }}
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate max-w-full">
                    {focused.category}
                  </p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight mt-1">
                    {formatCurrency(focused.amount, currency)}
                  </p>
                  <p
                    className="text-xs font-black tabular-nums mt-1"
                    style={{ color: focusedColor || undefined }}
                  >
                    {((focused.amount / total) * 100).toFixed(1)}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Total
                  </p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-tight mt-1">
                    {formatCurrency(grandTotal, currency)}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 w-full min-w-0 space-y-1 max-h-52 overflow-y-auto pr-1">
            {categories.map((c) => {
              const pct = total > 0 ? (c.amount / total) * 100 : 0;
              const isHovered = hovered === c.category;
              const isDimmed = hovered !== null && !isHovered;
              const color = colorFor(c.category);
              return (
                <button
                  key={c.category}
                  type="button"
                  onMouseEnter={() => setHovered(c.category)}
                  onMouseLeave={() => setHovered(null)}
                  className="relative w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-all overflow-hidden"
                  style={{ opacity: isDimmed ? 0.45 : 1 }}
                >
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-300 rounded-xl"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      opacity: isHovered ? 0.2 : 0.08,
                    }}
                  />
                  <div className="relative flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-md shrink-0 ring-1 ring-black/5"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-bold text-slate-800 truncate">{c.category}</span>
                  </div>
                  <div className="relative flex items-center gap-3 shrink-0 tabular-nums">
                    <span
                      className="text-[10px] font-black uppercase tracking-wider w-9 text-right"
                      style={{ color: isHovered ? color : undefined }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-xs font-bold text-slate-900 w-16 text-right">
                      {formatCurrency(c.amount, currency)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const n = value / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function formatCompactCurrency(value: number, currency: string): string {
  if (value >= 1000) {
    const k = value / 1000;
    const symbol = formatCurrency(0, currency).replace(/[\d.,\s]/g, '') || '$';
    return `${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return formatCurrency(value, currency);
}
