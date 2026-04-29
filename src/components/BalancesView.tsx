/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { SavedReceipt } from '../types';
import { formatCurrency } from '../lib/utils';
import { BalanceRow, aggregateOwedBalances } from '../lib/owedBalances';
import { exportBalancePdf, exportBalanceXlsx } from '../lib/exportExpenses';
import { Wallet, Users, ChevronDown, ChevronUp, Receipt, FileDown, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BalancesViewProps {
  history: SavedReceipt[];
  /** Current display name for you (participant id "1"); legacy saved name "You" is merged with this. */
  myDisplayName: string;
}

export default function BalancesView({ history, myDisplayName }: BalancesViewProps) {
  const [expandedPeople, setExpandedPeople] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'amount' | 'name' | 'receipts'>('amount');

  const { meLabel, youBalance, others, grandTotalOwedToYou } = useMemo(
    () => aggregateOwedBalances(history, myDisplayName),
    [history, myDisplayName]
  );
  const visibleOthers = useMemo(() => {
    return [...others].sort((a, b) => {
      if (sortMode === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortMode === 'receipts') {
        return b.receiptDetails.length - a.receiptDetails.length;
      }
      return b.total - a.total;
    });
  }, [others, sortMode]);
  const highestBalance = others[0];
  const allVisibleExpanded =
    visibleOthers.length > 0 && visibleOthers.every((person) => expandedPeople.includes(person.key));

  const toggleExpanded = (key: string) => {
    setExpandedPeople((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const toggleAllVisible = () => {
    setExpandedPeople((current) => {
      if (allVisibleExpanded) {
        const visibleKeys = new Set(visibleOthers.map((person) => person.key));
        return current.filter((key) => !visibleKeys.has(key));
      }
      return Array.from(new Set([...current, ...visibleOthers.map((person) => person.key)]));
    });
  };

  const renderReceiptDetails = (person: BalanceRow) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {person.receiptDetails.map((rd, idx) => (
        <div key={`${rd.merchantName}-${idx}`} className="bg-slate-50 rounded-2xl p-4 text-sm border border-slate-100">
          <div className="flex justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-slate-800 font-bold min-w-0">
              <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{rd.merchantName}</span>
            </div>
            <span className="text-xs font-medium text-slate-500 shrink-0">{rd.date}</span>
          </div>

          <div className="space-y-2">
            {rd.items.length > 0 ? rd.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4 text-slate-600 font-medium text-xs">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0">{formatCurrency(item.sharePrice, rd.currency)}</span>
              </div>
            )) : (
              <p className="text-xs font-medium text-slate-400 italic">No assigned line items</p>
            )}
            {rd.sharedFees > 0 && (
              <div className="flex justify-between text-slate-500 font-medium text-xs pt-2 mt-2 border-t border-slate-200/60 border-dashed">
                <span>Shared fees and tax</span>
                <span>{formatCurrency(rd.sharedFees, rd.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 mt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="text-indigo-600">{formatCurrency(rd.totalForReceipt, rd.currency)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (history.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
         <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-indigo-300">
           <Wallet className="w-10 h-10" />
         </div>
         <h3 className="text-xl font-bold text-slate-400">No balances yet</h3>
         <p className="text-slate-500 max-w-sm mx-auto font-medium">Process some receipts and save them to see who owes you money.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-indigo-600 rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10">
            <Wallet className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Total owed to you</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{formatCurrency(grandTotalOwedToYou)}</h2>
            <p className="text-indigo-100 mt-3 font-medium">
              From {others.length} {others.length === 1 ? 'person' : 'people'} across {history.length} saved {history.length === 1 ? 'receipt' : 'receipts'}.
            </p>
          </div>
        </div>

        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Largest balance</p>
            <p className="mt-3 text-xl font-bold text-slate-900 truncate">
              {highestBalance?.displayName ?? 'None'}
            </p>
            <p className="mt-1 text-sm font-bold text-indigo-600">
              {highestBalance ? formatCurrency(highestBalance.total, highestBalance.currency) : formatCurrency(0)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your share</p>
            <p className="mt-3 text-xl font-bold text-slate-900">
              {youBalance ? formatCurrency(youBalance.total, youBalance.currency) : formatCurrency(0)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{meLabel}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">
              Collect balances
            </p>
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" /> Breakdown by person
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              Sort balances, expand receipt details, or export a person’s total as Excel or PDF.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative block">
              <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as 'amount' | 'name' | 'receipts')}
                className="h-11 w-full sm:w-44 rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="amount">Amount owed</option>
                <option value="name">Name</option>
                <option value="receipts">Receipt count</option>
              </select>
            </label>
            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={visibleOthers.length === 0}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleOthers.length > 0 ? visibleOthers.map((person) => {
            const isExpanded = expandedPeople.includes(person.key);

            return (
              <div key={person.key} className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden transition-all duration-300">
                <div
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-100 group"
                  onClick={() => toggleExpanded(person.key)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-inner shrink-0"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.displayName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-lg truncate">{person.displayName}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {person.receiptDetails.length} {person.receiptDetails.length === 1 ? 'receipt' : 'receipts'} with shared costs
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="h-10 rounded-2xl bg-white border border-slate-200 px-4 flex items-center text-lg font-bold text-indigo-600">
                      {formatCurrency(person.total, person.currency)}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportBalanceXlsx(person);
                      }}
                      className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportBalancePdf(person);
                      }}
                      className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200/60 bg-white"
                    >
                      <div className="p-4">
                        {renderReceiptDetails(person)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="font-bold text-slate-700">No balances from other people</p>
              <p className="text-sm text-slate-500 mt-1">Only your own expenses are recorded so far.</p>
            </div>
          )}
        </div>
      </div>

      {youBalance && (() => {
        const isExpanded = expandedPeople.includes(youBalance.key);
        return (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm">
            <div
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
              onClick={() => toggleExpanded(youBalance.key)}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg">
                  {meLabel[0]?.toUpperCase() ?? 'Y'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Your share ({meLabel})</h4>
                  <p className="text-xs text-slate-500 font-semibold">Self expenses included in saved splits</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <div className="h-10 rounded-2xl bg-slate-50 border border-slate-200 px-4 flex items-center text-lg font-bold text-slate-600">
                  {formatCurrency(youBalance.total, youBalance.currency)}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    exportBalanceXlsx(youBalance);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <FileDown className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    exportBalancePdf(youBalance);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4"
                >
                  {renderReceiptDetails(youBalance)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}
    </div>
  );
}
