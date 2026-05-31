import React, { useState, useEffect } from 'react';
import { Transaction, CashAccount, BankCard } from '../types';
import { X, Save, Trash2 } from 'lucide-react';

interface TransactionEditModalProps {
  transaction: Transaction | null;
  cashAccounts: CashAccount[];
  cards: BankCard[];
  onClose: () => void;
  onSave: (txId: string, newData: any) => void;
  onDelete: (txId: string) => void;
  currency: string;
}

export default function TransactionEditModal({
  transaction,
  cashAccounts,
  cards,
  onClose,
  onSave,
  onDelete,
  currency
}: TransactionEditModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'card'>('cash');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.title);
      setAmount(transaction.amount);
      setDate(transaction.date);
      setCategory(transaction.category);
      setAccountId(transaction.accountId || '');
      setAccountType(transaction.accountType || 'cash');
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !date || !accountId) return;
    onSave(transaction.id, {
      title,
      amount: Number(amount),
      date,
      category,
      accountId,
      accountType
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animation-fade-in">
      <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-bold text-sm">Edit Transaction</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Title / Description</label>
            <input 
              type="text" 
              required
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Amount ({currency})</label>
            <input 
              type="number" 
              required min="0.01" step="0.01"
              value={amount} 
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 font-mono transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Date</label>
            <input 
              type="date" 
              required
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl px-3 py-2 text-[13px] uppercase focus:outline-none focus:border-zinc-500 font-mono transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Sub-tag / Category</label>
            <input 
              type="text" 
              required
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Account Source</label>
            <select
              value={`${accountId}:${accountType}`}
              onChange={e => {
                const [id, type] = e.target.value.split(':');
                setAccountId(id);
                setAccountType(type as 'cash'|'card');
              }}
              required
              className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="" disabled>Select Account</option>
              <optgroup label="Wallets / Cash">
                {cashAccounts.map(c => (
                  <option key={c.id} value={`${c.id}:cash`}>Cash: {c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Bank Cards">
                {cards.filter(c => !c.isCanceled).map(card => (
                  <option key={card.id} value={`${card.id}:card`}>Card: {card.bankName} - {card.cardName}</option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-zinc-800/50">
            {showDeleteConfirm ? (
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(transaction.id); }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteConfirm(true); }}
                className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs rounded-xl transition-colors border border-red-500/20 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/5"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-white/10"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
