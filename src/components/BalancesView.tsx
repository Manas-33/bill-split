/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { SavedReceipt } from '../types';
import { formatCurrency } from '../lib/utils';
import { aggregateOwedBalances } from '../lib/owedBalances';
import { exportBalancePdf, exportBalanceXlsx } from '../lib/exportExpenses';
import { Wallet, Users, ChevronDown, ChevronUp, Receipt, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BalancesViewProps {
  history: SavedReceipt[];
  /** Current display name for you (participant id "1"); legacy saved name "You" is merged with this. */
  myDisplayName: string;
}

export default function BalancesView({ history, myDisplayName }: BalancesViewProps) {
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const { meLabel, youBalance, others, grandTotalOwedToYou } = useMemo(
    () => aggregateOwedBalances(history, myDisplayName),
    [history, myDisplayName]
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
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Overview Card */}
      <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
        <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10 group-hover:scale-110 transition-transform">
          <Wallet className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Total Owed To You</p>
          <h2 className="text-5xl font-black">{formatCurrency(grandTotalOwedToYou)}</h2>
          <p className="text-indigo-200 mt-2 font-medium">Across {history.length} saved receipt(s)</p>
        </div>
      </div>

      {/* Individual Balances */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" /> Breakdown by Person
        </h3>
        
        <div className="space-y-4">
          {others.length > 0 ? others.map((person) => {
            const isExpanded = expandedPerson === person.key;

            return (
            <div key={person.key} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 group"
                onClick={() => setExpandedPerson(isExpanded ? null : person.key)}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-inner"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{person.displayName}</h4>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">Owes you</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className="text-xl font-bold text-indigo-600">{formatCurrency(person.total, person.currency)}</div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportBalanceXlsx(person);
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportBalancePdf(person);
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
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
                    <div className="p-4 space-y-4">
                      {person.receiptDetails.map((rd, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-xl p-4 text-sm border border-slate-100">
                          <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                              <Receipt className="w-4 h-4 text-slate-400" />
                              {rd.merchantName}
                            </div>
                            <span className="text-xs font-medium text-slate-500">{rd.date}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {rd.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-slate-600 font-medium text-xs">
                                <span>{item.name}</span>
                                <span>{formatCurrency(item.sharePrice, rd.currency)}</span>
                              </div>
                            ))}
                            {rd.sharedFees > 0 && (
                              <div className="flex justify-between text-slate-500 font-medium text-xs pt-2 mt-2 border-t border-slate-200/60 border-dashed">
                                <span>Shared Fees & Tax</span>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}) : (
            <p className="text-center text-slate-500 py-4 font-medium italic">Only your own expenses are recorded so far.</p>
          )}

          {youBalance && (() => {
            const isExpanded = expandedPerson === youBalance.key;
            return (
            <div className="mt-8 pt-6 border-t border-slate-100">
               <div 
                 className="flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity cursor-pointer group"
                 onClick={() => setExpandedPerson(isExpanded ? null : youBalance.key)}
               >
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg">
                      {meLabel[0]?.toUpperCase() ?? 'Y'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Your share ({meLabel})</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total self expenses</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="text-lg font-bold text-slate-500">{formatCurrency(youBalance.total, youBalance.currency)}</div>
                   <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                     <button
                       type="button"
                       onClick={(event) => {
                         event.stopPropagation();
                         exportBalanceXlsx(youBalance);
                       }}
                       className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                     >
                       <FileDown className="w-3.5 h-3.5" /> Excel
                     </button>
                     <button
                       type="button"
                       onClick={(event) => {
                         event.stopPropagation();
                         exportBalancePdf(youBalance);
                       }}
                       className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                     >
                       <FileDown className="w-3.5 h-3.5" /> PDF
                     </button>
                   </div>
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
                    <div className="space-y-4">
                      {youBalance.receiptDetails.map((rd, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-xl p-4 text-sm border border-slate-100">
                          <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                              <Receipt className="w-4 h-4 text-slate-400" />
                              {rd.merchantName}
                            </div>
                            <span className="text-xs font-medium text-slate-500">{rd.date}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {rd.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-slate-600 font-medium text-xs">
                                <span>{item.name}</span>
                                <span>{formatCurrency(item.sharePrice, rd.currency)}</span>
                              </div>
                            ))}
                            {rd.sharedFees > 0 && (
                              <div className="flex justify-between text-slate-500 font-medium text-xs pt-2 mt-2 border-t border-slate-200/60 border-dashed">
                                <span>Shared Fees & Tax</span>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
          })()}
        </div>
      </div>
    </div>
  );
}
