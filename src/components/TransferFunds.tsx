import React, { useState } from 'react';
import { CashAccount, BankCard } from '../types';
import { ArrowRightLeft } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface TransferFundsProps {
  cashAccounts: CashAccount[];
  cards: BankCard[];
  currency: string;
  onTransferFunds: (
    fromId: string,
    fromType: 'cash' | 'card',
    toId: string,
    toType: 'cash' | 'card',
    amount: number,
    note: string,
    date: string
  ) => void;
}

export default function TransferFunds({
  cashAccounts,
  cards,
  currency,
  onTransferFunds,
}: TransferFundsProps) {
  const { showToast } = useNotifications();
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const accounts = [
    ...cashAccounts.map(c => ({ id: c.id, name: c.name, type: 'cash' as const })),
    ...cards.map(c => ({ id: c.id, name: c.cardName, type: 'card' as const })),
  ];

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const source = accounts.find(a => `${a.type}-${a.id}` === fromAccount);
    const destination = accounts.find(a => `${a.type}-${a.id}` === toAccount);

    if (!source || !destination) return;
    if (source.id === destination.id && source.type === destination.type) {
      showToast('error', "Source and destination cannot be the same.");
      return;
    }

    onTransferFunds(
      source.id,
      source.type,
      destination.id,
      destination.type,
      parseFloat(amount),
      note,
      new Date().toISOString().split('T')[0]
    );

    setAmount('');
    setNote('');
  };

  return (
    <form onSubmit={handleTransfer} className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
        <ArrowRightLeft size={16} className="text-zinc-400" />
        Transfer Funds
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-zinc-500 font-bold block mb-1">From Account</label>
          <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none">
            <option value="">Select source</option>
            {accounts.map(a => <option key={`${a.type}-${a.id}`} value={`${a.type}-${a.id}`}>{a.name} ({a.type})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-bold block mb-1">To Account</label>
          <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none">
            <option value="">Select destination</option>
            {accounts.map(a => <option key={`${a.type}-${a.id}`} value={`${a.type}-${a.id}`}>{a.name} ({a.type})</option>)}
          </select>
        </div>
      </div>

      <input
        type="number"
        placeholder={`Amount (${currency})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-3 focus:outline-none"
        required
      />
      <input
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-3 focus:outline-none"
      />
      
      <button type="submit" className="w-full bg-emerald-500 text-neutral-950 font-bold text-xs py-3 rounded-xl hover:bg-emerald-600 transition-colors">
        Transfer Now
      </button>
    </form>
  );
}
