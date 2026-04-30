/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { SavedReceipt, Settlement } from '../types';
import { formatCurrency, toIsoDateLocal } from '../lib/utils';
import { BalanceRow, aggregateOwedBalances } from '../lib/owedBalances';
import { exportBalancePdf, exportBalanceXlsx } from '../lib/exportExpenses';
import { Wallet, Users, ChevronDown, ChevronUp, Receipt, FileDown, ArrowUpDown, Banknote, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BalancesViewProps {
  history: SavedReceipt[];
  myDisplayName: string;
  settlements: Settlement[];
  onAddSettlement: (data: Omit<Settlement, 'id' | 'timestamp'>) => Promise<void>;
  onDeleteSettlement: (id: string) => Promise<void>;
}

export default function BalancesView({ history, myDisplayName, settlements, onAddSettlement, onDeleteSettlement }: BalancesViewProps) {
  const [expandedPeople, setExpandedPeople] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'amount' | 'name' | 'receipts'>('amount');
  const [settleModal, setSettleModal] = useState<{
    personKey: string;
    personName: string;
    netBalance: number;
    currency: string;
  } | null>(null);
  const [settleDraft, setSettleDraft] = useState({ amount: '', date: '', note: '' });
  const [settling, setSettling] = useState(false);

  const { meLabel, youBalance, others, grandTotalOwedToYou } = useMemo(
    () => aggregateOwedBalances(history, myDisplayName),
    [history, myDisplayName]
  );

  const settledByKey = useMemo(() => {
    const map = new Map<string, number>();
    settlements.forEach(s => {
      map.set(s.personName, (map.get(s.personName) ?? 0) + s.amount);
    });
    return map;
  }, [settlements]);

  const settlementsByKey = useMemo(() => {
    const map = new Map<string, Settlement[]>();
    settlements.forEach(s => {
      const list = map.get(s.personName) ?? [];
      list.push(s);
      map.set(s.personName, list);
    });
    map.forEach(list => list.sort((a, b) => b.timestamp - a.timestamp));
    return map;
  }, [settlements]);

  const grandNetTotal = useMemo(() =>
    others.reduce((sum, p) => {
      const settled = settledByKey.get(p.key) ?? 0;
      return sum + Math.max(0, p.total - settled);
    }, 0),
    [others, settledByKey]
  );

  const highestNetPerson = useMemo(() => {
    if (others.length === 0) return undefined;
    return others.reduce((best, p) => {
      const netP = Math.max(0, p.total - (settledByKey.get(p.key) ?? 0));
      const netBest = Math.max(0, best.total - (settledByKey.get(best.key) ?? 0));
      return netP > netBest ? p : best;
    });
  }, [others, settledByKey]);

  const visibleOthers = useMemo(() => {
    return [...others].sort((a, b) => {
      if (sortMode === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortMode === 'receipts') return b.receiptDetails.length - a.receiptDetails.length;
      const netA = Math.max(0, a.total - (settledByKey.get(a.key) ?? 0));
      const netB = Math.max(0, b.total - (settledByKey.get(b.key) ?? 0));
      return netB - netA;
    });
  }, [others, sortMode, settledByKey]);

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

  const openSettleModal = (person: BalanceRow, netBalance: number) => {
    setSettleModal({ personKey: person.key, personName: person.displayName, netBalance, currency: person.currency });
    setSettleDraft({
      amount: netBalance.toFixed(2),
      date: toIsoDateLocal(new Date()),
      note: '',
    });
  };

  const submitSettle = async () => {
    if (!settleModal) return;
    const amount = parseFloat(settleDraft.amount);
    if (!amount || amount <= 0) return;
    setSettling(true);
    try {
      await onAddSettlement({
        personName: settleModal.personKey,
        amount,
        currency: settleModal.currency,
        date: settleDraft.date,
        note: settleDraft.note.trim() || undefined,
      });
      setSettleModal(null);
    } finally {
      setSettling(false);
    }
  };

  const renderExpandedContent = (person: BalanceRow) => {
    const personSettlements = settlementsByKey.get(person.key) ?? [];
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Receipts</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {person.receiptDetails.map((rd, idx) => (
              <div key={`${rd.merchantName}-${idx}`} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold min-w-0">
                    <Receipt className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">{rd.merchantName}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{rd.date}</span>
                </div>
                <div className="space-y-2">
                  {rd.items.length > 0 ? rd.items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-4 text-slate-600 dark:text-slate-300 font-medium text-xs">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0">{formatCurrency(item.sharePrice, rd.currency)}</span>
                    </div>
                  )) : (
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">No assigned line items</p>
                  )}
                  {rd.sharedFees > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium text-xs pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-600/60 border-dashed">
                      <span>Shared fees and tax</span>
                      <span>{formatCurrency(rd.sharedFees, rd.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 dark:text-slate-100 font-bold text-sm pt-2 mt-2 border-t border-slate-200 dark:border-slate-600">
                    <span>Total</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(rd.totalForReceipt, rd.currency)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {personSettlements.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Settlements</p>
            <div className="space-y-2">
              {personSettlements.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{formatCurrency(s.amount, s.currency)}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-medium ml-2">{s.date}</span>
                      {s.note && <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate mt-0.5">{s.note}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSettlement(s.id)}
                    title="Remove settlement"
                    className="p-1.5 rounded-xl text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (history.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-indigo-300 dark:text-indigo-500">
          <Wallet className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500">No balances yet</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">Process some receipts and save them to see who owes you money.</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-indigo-600 dark:bg-indigo-700 rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-950/50 relative overflow-hidden">
            <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10">
              <Wallet className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Net owed to you</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">{formatCurrency(grandNetTotal)}</h2>
              {grandNetTotal < grandTotalOwedToYou && (
                <p className="text-indigo-200 text-sm font-medium mt-1">
                  {formatCurrency(grandTotalOwedToYou - grandNetTotal)} settled of {formatCurrency(grandTotalOwedToYou)} total
                </p>
              )}
              <p className="text-indigo-100 mt-3 font-medium">
                From {others.length} {others.length === 1 ? 'person' : 'people'} across {history.length} saved {history.length === 1 ? 'receipt' : 'receipts'}.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Largest balance</p>
              <p className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {highestNetPerson?.displayName ?? 'None'}
              </p>
              <p className="mt-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {highestNetPerson
                  ? formatCurrency(Math.max(0, highestNetPerson.total - (settledByKey.get(highestNetPerson.key) ?? 0)), highestNetPerson.currency)
                  : formatCurrency(0)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Your share</p>
              <p className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">
                {youBalance ? formatCurrency(youBalance.total, youBalance.currency) : formatCurrency(0)}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">{meLabel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 md:p-6 shadow-sm">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                Collect balances
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Breakdown by person
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Record settlements, expand receipt details, or export a person's total as Excel or PDF.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative block">
                <ArrowUpDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as 'amount' | 'name' | 'receipts')}
                  className="h-11 w-full sm:w-44 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-300 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50"
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
                className="h-11 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {visibleOthers.length > 0 ? visibleOthers.map((person) => {
              const isExpanded = expandedPeople.includes(person.key);
              const settled = settledByKey.get(person.key) ?? 0;
              const netBalance = Math.max(0, person.total - settled);
              const isFullySettled = netBalance === 0;

              return (
                <div key={person.key} className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-300">
                  <div
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 group"
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg truncate">{person.displayName}</h4>
                          {isFullySettled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Settled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {person.receiptDetails.length} {person.receiptDetails.length === 1 ? 'receipt' : 'receipts'}
                          {settled > 0 && ` · ${formatCurrency(settled, person.currency)} settled`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className={`h-10 rounded-2xl border px-4 flex items-center text-lg font-bold ${
                        isFullySettled
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {formatCurrency(netBalance, person.currency)}
                      </div>
                      {!isFullySettled && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openSettleModal(person, netBalance);
                          }}
                          className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700"
                        >
                          <Banknote className="w-3.5 h-3.5" /> Settle
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          exportBalanceXlsx(person);
                        }}
                        className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Excel
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          exportBalancePdf(person);
                        }}
                        className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </button>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-200/60 dark:border-slate-600/60 bg-white dark:bg-slate-900"
                      >
                        <div className="p-4">
                          {renderExpandedContent(person)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }) : (
              <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-10 text-center">
                <p className="font-bold text-slate-700 dark:text-slate-200">No balances from other people</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Only your own expenses are recorded so far.</p>
              </div>
            )}
          </div>
        </div>

        {youBalance && (() => {
          const isExpanded = expandedPeople.includes(youBalance.key);
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 md:p-6 shadow-sm">
              <div
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                onClick={() => toggleExpanded(youBalance.key)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-300 text-lg">
                    {meLabel[0]?.toUpperCase() ?? 'Y'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100">Your share ({meLabel})</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Self expenses included in saved splits</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <div className="h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 flex items-center text-lg font-bold text-slate-600 dark:text-slate-300">
                    {formatCurrency(youBalance.total, youBalance.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      exportBalanceXlsx(youBalance);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      exportBalancePdf(youBalance);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <FileDown className="w-3.5 h-3.5" /> PDF
                  </button>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
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
                    {renderExpandedContent(youBalance)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}
      </div>

      {/* Settle Modal */}
      <AnimatePresence>
        {settleModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settle-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              aria-label="Dismiss"
              onClick={() => setSettleModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/50 p-6 md:p-8"
            >
              <button
                type="button"
                onClick={() => setSettleModal(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5">
                <Banknote className="w-6 h-6" />
              </div>
              <h2 id="settle-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 pr-10">
                Record settlement
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {settleModal.personName} owes {formatCurrency(settleModal.netBalance, settleModal.currency)}.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    Amount paid
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={settleDraft.amount}
                    onChange={(e) => setSettleDraft(d => ({ ...d, amount: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={settleDraft.date}
                    onChange={(e) => setSettleDraft(d => ({ ...d, date: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    Note <span className="normal-case font-medium text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={settleDraft.note}
                    onChange={(e) => setSettleDraft(d => ({ ...d, note: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g. Venmo, cash, etc."
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSettleModal(null)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitSettle}
                  disabled={settling || !settleDraft.amount || parseFloat(settleDraft.amount) <= 0}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200 dark:shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settling ? 'Saving…' : 'Record settlement'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
