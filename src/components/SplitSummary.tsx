/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedReceipt, Person } from '../types';
import { formatCurrency } from '../lib/utils';
import { PieChart, Info, DollarSign } from 'lucide-react';

interface SplitSummaryProps {
  receipt: ExtractedReceipt;
  people: Person[];
}

export default function SplitSummary({ receipt, people }: SplitSummaryProps) {
  // Calculate shares
  const personShares = people.map(person => {
    let subtotal = 0;
    receipt.items.forEach(item => {
      const sharesOfPerson = item.splitWith.filter(id => id === person.id).length;
      if (sharesOfPerson > 0) {
        subtotal += (item.price / item.splitWith.length) * sharesOfPerson;
      }
    });
    return { id: person.id, subtotal };
  });

  const assignedSubtotal = personShares.reduce((acc, p) => acc + p.subtotal, 0);
  
  // We use the extracted subtotal as the target, but track if items sum up to it
  const itemsSum = receipt.items.reduce((acc, item) => acc + item.price, 0);
  const unassignedSubtotal = itemsSum - assignedSubtotal;

  const summary = personShares.map(share => {
    const person = people.find(p => p.id === share.id);
    const ratio = itemsSum > 0 ? share.subtotal / itemsSum : 0;
    
    // Equal splitting for tax, tip, fees
    const splitCount = people.length || 1;
    const taxShare = (receipt.tax || 0) / splitCount;
    const tipShare = (receipt.tip || 0) / splitCount;
    const feesShare = (receipt.fees || 0) / splitCount;
    
    return {
      person,
      subtotal: share.subtotal,
      tax: taxShare,
      tip: tipShare,
      fees: feesShare,
      total: share.subtotal + taxShare + tipShare + feesShare,
      percentage: receipt.total > 0 ? ((share.subtotal + taxShare + tipShare + feesShare) / receipt.total) * 100 : 0
    };
  });

  // Calculate category aggregates for Bento feel
  const categories = Array.from(new Set(receipt.items.map(i => i.category)));
  const categorySummary = categories.map(cat => ({
    name: cat,
    total: receipt.items.filter(i => i.category === cat).reduce((acc, i) => acc + i.price, 0)
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Visual Splits Card */}
      <section className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Split Overview</h3>
          <span className="px-3 py-1 bg-green-500 text-[10px] font-black rounded-full text-white uppercase tracking-widest">
            {unassignedSubtotal < 0.05 ? 'Balanced' : 'Pending'}
          </span>
        </div>
        
        <div className="space-y-6">
          {summary.map((s) => (
            <div key={s.person?.id} className="space-y-3">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-inner"
                    style={{ backgroundColor: s.person?.color }}
                  >
                    {s.person?.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{s.person?.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {s.percentage.toFixed(0)}% Share
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-400">{formatCurrency(s.total, receipt.currency)}</p>
                  <div className="w-16 bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                     <div 
                       className="h-full transition-all duration-700" 
                       style={{ width: `${s.percentage}%`, backgroundColor: s.person?.color }} 
                     />
                  </div>
                </div>
              </div>
              
              {/* Detailed Breakdown tooltip-like info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-13 text-[9px] font-mono text-slate-500">
                <div className="flex justify-between border-b border-slate-800 pb-0.5">
                  <span>Items:</span>
                  <span>{formatCurrency(s.subtotal, receipt.currency)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-0.5">
                  <span>Tax:</span>
                  <span>{formatCurrency(s.tax, receipt.currency)}</span>
                </div>
                {s.fees > 0 && (
                  <div className="flex justify-between border-b border-slate-800 pb-0.5">
                    <span>Fees:</span>
                    <span>{formatCurrency(s.fees, receipt.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-indigo-900/50 active:scale-[0.98]">
            REQUEST PAYMENTS
          </button>
        </div>
      </section>

      {/* Category Card */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Expenses by Category</h3>
        <div className="space-y-4">
          {categorySummary.slice(0, 3).map((cat) => (
            <div key={cat.name}>
              <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                <span>{cat.name}</span>
                <span>{formatCurrency(cat.total, receipt.currency)}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-slate-900 h-full transition-all duration-700" 
                  style={{ width: `${(cat.total / receipt.subtotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {unassignedSubtotal > 0.01 && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3 items-start animate-pulse">
          <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-[10px] uppercase font-bold text-orange-700 leading-tight tracking-wider">
            {formatCurrency(unassignedSubtotal, receipt.currency)} Unassigned
          </p>
        </div>
      )}
    </div>
  );
}
