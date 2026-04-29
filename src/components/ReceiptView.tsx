/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedReceipt, Person } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Tag, User, Plus, Trash2, Minus } from 'lucide-react';

interface ReceiptViewProps {
  receipt: ExtractedReceipt;
  people: Person[];
  onAddShare: (itemId: string, personId: string) => void;
  onRemoveShare: (itemId: string, personId: string) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onUpdateItemName: (itemId: string, newName: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: () => void;
  onUpdateMetadata: (field: keyof ExtractedReceipt, value: number | string) => void;
}

export default function ReceiptView({ 
  receipt, 
  people, 
  onAddShare, 
  onRemoveShare,
  onUpdatePrice,
  onUpdateItemName,
  onUpdateQuantity,
  onDeleteItem,
  onAddItem,
  onUpdateMetadata
}: ReceiptViewProps) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <th className="py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Item Details</th>
            <th className="py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Qty</th>
            <th className="py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Price</th>
            <th className="py-5 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Split With</th>
            <th className="py-5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {receipt.items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80 group transition-colors">
              <td className="py-4 px-6">
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdateItemName(item.id, e.target.value)}
                    className="font-bold text-sm text-slate-800 bg-transparent outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 -mx-1"
                    placeholder="Item name"
                  />
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      <Tag className="w-2.5 h-2.5" />
                      {item.category}
                    </span>
                  </div>
                </div>
              </td>
              <td className="py-4 px-6 text-center">
                <div
                  className="mx-auto inline-flex max-w-[9.5rem] items-stretch overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
                  role="group"
                  aria-label={`Quantity for ${item.name || 'item'}`}
                >
                  <button
                    type="button"
                    className="flex w-9 shrink-0 items-center justify-center border-r border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-35"
                    disabled={item.quantity <= 0.01 + 1e-9}
                    onClick={() => {
                      const next = Math.max(0.01, +(item.quantity - 1).toFixed(4));
                      onUpdateQuantity(item.id, next);
                    }}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={item.quantity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onUpdateQuantity(item.id, Number.isFinite(v) ? v : item.quantity);
                    }}
                    className="min-w-[2.75rem] max-w-[4rem] flex-1 border-0 bg-transparent py-2 text-center text-sm font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Quantity value"
                  />
                  <button
                    type="button"
                    className="flex w-9 shrink-0 items-center justify-center border-l border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200"
                    onClick={() => {
                      const next = +(item.quantity + 1).toFixed(4);
                      onUpdateQuantity(item.id, next);
                    }}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex justify-end items-center gap-1 text-slate-900 font-black">
                  <span className="text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => onUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-black p-1 -m-1"
                  />
                </div>
              </td>
              <td className="py-4 px-5">
                <div className="flex flex-wrap gap-1.5">
                  {people.map((person) => {
                    const shares = item.splitWith.filter(id => id === person.id).length;
                    const isSelected = shares > 0;
                    
                    if (!isSelected) {
                      return (
                        <button
                          key={person.id}
                          onClick={() => onAddShare(item.id, person.id)}
                          className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 justify-center text-[10px] font-black transition-all whitespace-nowrap bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                          title={`Add ${person.name}`}
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>{person.name}</span>
                        </button>
                      );
                    }

                    return (
                      <div 
                        key={person.id} 
                        className="flex items-center rounded-xl text-white shadow-lg font-bold text-xs ring-2 ring-offset-2 overflow-hidden"
                        style={{ 
                          backgroundColor: person.color,
                          borderColor: person.color,
                          boxShadow: `0 8px 16px ${person.color}44` 
                        }}
                      >
                         <button 
                           onClick={() => onRemoveShare(item.id, person.id)}
                           className="px-2.5 py-1.5 bg-black/10 hover:bg-black/20 focus:outline-none transition-colors border-r border-black/10"
                           title="Remove a share"
                         >
                           -
                         </button>
                         <div className="px-2.5 py-1.5 flex items-center gap-1 bg-black/5">
                            <span className="text-[10px] uppercase tracking-widest">{person.name}</span>
                            {shares > 1 && <span className="opacity-90 font-black tracking-widest text-[#ffffff] ml-1">x{shares}</span>}
                         </div>
                         <button 
                           onClick={() => onAddShare(item.id, person.id)}
                           className="px-2.5 py-1.5 bg-black/10 hover:bg-black/20 focus:outline-none transition-colors border-l border-black/10"
                           title="Add another share"
                         >
                           +
                         </button>
                      </div>
                    );
                  })}
                </div>
              </td>
              <td className="py-4 px-2">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onDeleteItem(item.id)} 
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          
          <tr className="bg-slate-50/20">
            <td colSpan={5} className="py-3 px-6 text-center">
              <button 
                onClick={onAddItem}
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </td>
          </tr>

          {/* Subtotal & Taxes Rows */}
          <tr className="bg-slate-50/40">
            <td colSpan={2} className="py-4 px-6 text-right text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end"><span className="leading-8">Subtotal</span></td>
            <td className="py-4 px-6 text-right text-sm font-black text-slate-900">{formatCurrency(receipt.subtotal, receipt.currency)}</td>
            <td colSpan={2}></td>
          </tr>
          <tr className="bg-slate-50/40">
            <td colSpan={2} className="py-2 px-6 text-right text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end"><span className="leading-8">Tax</span></td>
            <td className="py-2 px-6 text-right text-sm font-black text-indigo-600">
               <div className="flex justify-end items-center gap-1">
                  <span className="text-indigo-300">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={receipt.tax}
                    onChange={(e) => onUpdateMetadata('tax', parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-black p-1 -m-1"
                  />
                </div>
            </td>
            <td colSpan={2}></td>
          </tr>
          <tr className="bg-slate-50/40">
            <td colSpan={2} className="py-2 px-6 text-right text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end"><span className="leading-8">Tip</span></td>
            <td className="py-2 px-6 text-right text-sm font-black text-emerald-600">
               <div className="flex justify-end items-center gap-1">
                  <span className="text-emerald-300">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={receipt.tip || 0}
                    onChange={(e) => onUpdateMetadata('tip', parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded font-black p-1 -m-1"
                  />
                </div>
            </td>
            <td colSpan={2}></td>
          </tr>
          <tr className="bg-slate-50/40">
            <td colSpan={2} className="py-2 px-6 text-right text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end"><span className="leading-8">Fees</span></td>
            <td className="py-2 px-6 text-right text-sm font-black text-rose-600">
               <div className="flex justify-end items-center gap-1">
                  <span className="text-rose-300">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={receipt.fees || 0}
                    onChange={(e) => onUpdateMetadata('fees', parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent text-right focus:outline-none focus:ring-1 focus:ring-rose-500 rounded font-black p-1 -m-1"
                  />
                </div>
            </td>
            <td colSpan={2}></td>
          </tr>
          <tr className="bg-slate-900 text-white">
            <td colSpan={2} className="py-4 px-6 text-right text-xs font-bold uppercase tracking-widest"><span className="leading-6 inline-block">Grand Total</span></td>
            <td className="py-4 px-6 text-right text-lg font-black">{formatCurrency(receipt.total, receipt.currency)}</td>
            <td colSpan={2}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
