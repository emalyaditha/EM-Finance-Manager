import React, { useState } from 'react';
import { CashAccount, BankCard, CreditCardPurchase } from '../types';
import { CreditCard as CcIcon, Plus, CheckSquare, Lock, Unlock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface Props {
  creditCards: BankCard[];
  cashAccounts: CashAccount[];
  cards: BankCard[];
  currency: string;
  onPayCard: (cardId: string, amount: number, fromId: string, fromType: 'cash' | 'card') => void;
  onAddPurchase: (purchase: Omit<CreditCardPurchase, 'id'>) => void;
  onUpdateCard: (card: BankCard) => void;
}

export default function CreditCardManagement({ creditCards, cashAccounts, cards, currency, onPayCard, onAddPurchase, onUpdateCard }: Props) {
  const { showToast } = useNotifications();
  
  const [payAmount, setPayAmount] = useState('');
  const [sourceId, setSourceId] = useState('');

  const [purAmount, setPurAmount] = useState('');
  const [purDesc, setPurDesc] = useState('');
  const [purMerchant, setPurMerchant] = useState('');
  const [purCardId, setPurCardId] = useState('');

  const fundingAccounts = [
      ...cashAccounts.map(c => ({ id: c.id, name: c.name, type: 'cash' as const })),
      ...cards.map(c => ({ id: c.id, name: c.cardName, type: 'card' as const })),
  ];

  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purAmount || !purCardId) {
        showToast('error', 'Amount and card are required');
        return;
    }
    onAddPurchase({ cardId: purCardId, amount: parseFloat(purAmount), description: purDesc, merchant: purMerchant, date: new Date().toISOString().split('T')[0] });
    setPurAmount(''); setPurDesc(''); setPurMerchant('');
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl space-y-6">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <CcIcon size={16} className="text-emerald-500" />
        Credit Cards
      </h3>
      
      {/* List */}
      <div className="space-y-3">
        {creditCards.map(c => (
            <div key={c.id} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                    <h4 className="text-white font-bold text-sm">{c.cardName}</h4>
                    <p className="text-xs text-zinc-400">
                        Balance: {currency} {c.currentBalance.toFixed(2)} |
                        Avail: {currency} {((c.limit ?? 0) - c.currentBalance).toFixed(2)}
                    </p>
                    <div className='flex items-center gap-2 mt-1'>
                        <span className='text-[10px] text-zinc-500'>{c.bankName} - {c.cardType}</span>
                        <input
                            type="number"
                            placeholder="Limit"
                            value={c.limit ?? ''}
                            disabled={!!(c.isLimitLocked ?? true)}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateCard({ ...c, limit: isNaN(val) ? undefined : val });
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onUpdateCard({ ...c, isLimitLocked: true });
                                    e.currentTarget.blur();
                                    showToast('success', `Limit of ${currency}${c.limit || 0} locked & synchronized!`);
                                }
                            }}
                            className={`w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-white ${c.isLimitLocked ?? true ? 'opacity-50 font-normal' : 'border-emerald-500 font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-550'}`}
                            title={c.isLimitLocked ?? true ? "Limit is locked. Toggle the icon to edit." : "Edit the limit and press Enter to save & lock."}
                        />
                        <button 
                            type="button"
                            onClick={() => {
                                const nextLock = !(c.isLimitLocked ?? true);
                                onUpdateCard({ ...c, isLimitLocked: nextLock });
                                if (!nextLock) {
                                    showToast('info', 'Limit unlocked. Type value then press Enter to save & lock.');
                                } else {
                                    showToast('success', `Limit of ${currency}${c.limit || 0} locked & synchronized!`);
                                }
                            }}
                            className="p-0.5 hover:bg-zinc-800 rounded transition"
                            title={c.isLimitLocked ?? true ? "Unlock limit editing" : "Lock and save limit"}
                        >
                            {c.isLimitLocked ?? true ? <Lock size={12} className="text-zinc-500" /> : <Unlock size={12} className="text-emerald-500 animate-pulse" />}
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input type="number" placeholder="Amt" className="w-16 bg-zinc-900 border border-zinc-800 rounded p-1 text-xs text-white" 
                        onChange={(e) => setPayAmount(e.target.value)} />
                    <select className="bg-zinc-900 border border-zinc-800 rounded p-1 text-xs text-white"
                        onChange={(e) => setSourceId(e.target.value)}>
                        <option value="">Source</option>
                        {fundingAccounts.map(a => <option key={`${a.type}-${a.id}`} value={`${a.type}-${a.id}`}>{a.name}</option>)}
                    </select>
                    <button 
                        onClick={() => {
                            if(!sourceId) {
                                showToast('error', 'Select a funding account for settlement');
                                return;
                            }
                            onPayCard(c.id, c.currentBalance, sourceId.split('-')[1], sourceId.split('-')[0] as 'cash' | 'card');
                        }}
                        className="bg-purple-500 p-1.5 rounded text-neutral-950 font-bold text-[10px]"
                    >Settle</button>
                    <button onClick={() => {
                        if(!payAmount || !sourceId) return;
                        const source = fundingAccounts.find(a => `${a.type}-${a.id}` === sourceId);
                        if(source) onPayCard(c.id, parseFloat(payAmount), source.id, source.type);
                    }} className="bg-emerald-500 p-1.5 rounded text-neutral-950"><CheckSquare size={14}/></button>
                </div>
            </div>
        ))}
      </div>

      {/* Add Purchase */}
      <form onSubmit={handleAddPurchase} className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
        <h4 className='col-span-2 text-white font-bold text-xs'>Record Purchase</h4>
        <select className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white"
            onChange={(e) => setPurCardId(e.target.value)}>
            <option value="">Select Card</option>
            {creditCards.map(c => <option key={c.id} value={c.id}>{c.cardName}</option>)}
        </select>
        <input type="number" placeholder="Amount" value={purAmount} onChange={e => setPurAmount(e.target.value)} className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white" />
        <input placeholder="Merchant" value={purMerchant} onChange={e => setPurMerchant(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white" />
        <input placeholder="Desc" value={purDesc} onChange={e => setPurDesc(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white" />
        <button type="submit" className="col-span-2 bg-blue-500 text-white font-bold text-xs py-3 rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> Record Purchase
        </button>
      </form>
    </div>
  );
}
