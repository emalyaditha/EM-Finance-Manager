import React, { useState } from 'react';
import { CashAccount, BankCard } from '../types';
import { Plus, Trash2, Wallet, CreditCard, ChevronRight, CornerDownRight, Landmark, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface CashCardManagementProps {
  cashAccounts: CashAccount[];
  cards: BankCard[];
  onAddCashAccount: (name: string, balance: number) => void;
  onEditCashAccount: (id: string, newBalance: number) => void;
  onAddCard: (card: Omit<BankCard, 'id'>) => void;
  onDeleteCard: (id: string) => void;
  onDeleteCashAccount: (id: string) => void;
  currency: string;
}

export default function CashCardManagement({
  cashAccounts,
  cards,
  onAddCashAccount,
  onEditCashAccount,
  onAddCard,
  onDeleteCard,
  onDeleteCashAccount,
  currency,
}: CashCardManagementProps) {
  // Cash form states
  const [cashName, setCashName] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [errorCash, setErrorCash] = useState('');

  // Card form states
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState<'Debit' | 'Credit'>('Debit');
  const [cardBalance, setCardBalance] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardTheme, setCardTheme] = useState('obsidian'); // obsidian, sapphire, emerald, copper, ruby

  // Quick action states
  const [selectedCashId, setSelectedCashId] = useState<string | null>(null);
  const [qtyAction, setQtyAction] = useState('');
  const [actionType, setActionType] = useState<'deposit' | 'withdraw' | null>(null);

  // Deletion confirmation
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const handleCreateCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashName.trim()) {
      setErrorCash('Account name is required');
      return;
    }
    const balanceNum = parseFloat(cashBalance) || 0;
    onAddCashAccount(cashName, balanceNum);
    setCashName('');
    setCashBalance('');
    setErrorCash('');
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !bankName.trim()) {
      alert('Card name and bank source are required');
      return;
    }
    const balanceNum = parseFloat(cardBalance) || 0;
    
    // Mask helper
    let cleanNum = cardNumber.replace(/\s+/g, '');
    if (cleanNum.length > 0) {
      if (cleanNum.length > 4) {
        cleanNum = `**** **** **** ${cleanNum.slice(-4)}`;
      } else {
        cleanNum = `**** **** **** ${cleanNum}`;
      }
    } else {
      cleanNum = `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`;
    }

    onAddCard({
      cardName,
      bankName,
      cardType,
      currentBalance: balanceNum,
      cardNumber: cleanNum,
    });

    // Reset card form
    setCardName('');
    setBankName('');
    setCardBalance('');
    setCardNumber('');
    setIsAddingCard(false);
  };

  const handleQuickAdjustCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashId || !actionType) return;
    const account = cashAccounts.find(c => c.id === selectedCashId);
    if (!account) return;

    const amountNum = parseFloat(qtyAction) || 0;
    if (amountNum <= 0) {
      alert('Amount must be positive');
      return;
    }

    let nextBalance = account.balance;
    if (actionType === 'deposit') {
      nextBalance += amountNum;
    } else if (actionType === 'withdraw') {
      if (account.balance < amountNum) {
        alert('Insufficient cash in hand to withdraw this amount');
        return;
      }
      nextBalance -= amountNum;
    }

    onEditCashAccount(selectedCashId, nextBalance);
    setQtyAction('');
    setSelectedCashId(null);
    setActionType(null);
  };

  const getCardGradient = (theme: string) => {
    switch (theme) {
      case 'sapphire': return 'from-blue-900 via-zinc-950 to-indigo-900 border-blue-500/30';
      case 'emerald': return 'from-emerald-950 via-zinc-950 to-teal-900 border-emerald-500/30';
      case 'copper': return 'from-amber-950 via-zinc-950 to-orange-950 border-amber-600/30';
      case 'ruby': return 'from-rose-950 via-zinc-950 to-red-950 border-rose-500/30';
      default: return 'from-zinc-900 via-neutral-950 to-zinc-900 border-zinc-800';
    }
  };

  return (
    <div id="cash-card-vault-view" className="space-y-6">
      
      {/* 1. Cash Accounts Drawer Setup */}
      <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet size={16} className="text-zinc-400" />
              Cash in Hand Repositories
            </h3>
            <p className="text-[10px] text-zinc-500">Add physical cash holdings (e.g., wallet cash, home savings safe)</p>
          </div>
        </div>

        {/* List Cash Accounts */}
        <div className="grid grid-cols-1 gap-3 mb-5">
          {cashAccounts.map(account => (
            <div key={account.id} id={`cash-row-${account.id}`} className="bg-[#050505]/60 border border-zinc-800/80 p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition-all duration-300 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shadow-md">
                  <Wallet size={18} className="text-zinc-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">{account.name}</h4>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Asset Drawer</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold font-mono text-white block">
                    {currency} {account.balance.toLocaleString()}
                  </span>
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      onClick={() => {
                        setSelectedCashId(account.id);
                        setActionType('deposit');
                      }}
                      className="text-[9px] font-bold text-emerald-400 hover:underline px-2 py-0.5 rounded bg-emerald-950/20 uppercase tracking-widest"
                    >
                      + Deposit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCashId(account.id);
                        setActionType('withdraw');
                      }}
                      className="text-[9px] font-bold text-rose-400 hover:underline px-2 py-0.5 rounded bg-rose-950/20 uppercase tracking-widest"
                    >
                      - Withdraw
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Delete ${account.name} wallet?`)) {
                      onDeleteCashAccount(account.id);
                    }
                  }}
                  className="p-2 bg-[#050505] border border-zinc-800 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Deposit/Withdraw Action Slider */}
        {selectedCashId && actionType && (
          <form onSubmit={handleQuickAdjustCash} className="bg-[#050505] border border-zinc-800 p-4 rounded-xl mb-5 space-y-3.5 animation-fade-in border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CornerDownRight size={12} className="text-emerald-400 animate-pulse" />
                Quick {actionType}: {cashAccounts.find(c => c.id === selectedCashId)?.name}
              </span>
              <button
                type="button"
                className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors"
                onClick={() => {
                  setSelectedCashId(null);
                  setActionType(null);
                }}
              >
                Cancel
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={`Amount in ${currency}`}
                value={qtyAction}
                onChange={(e) => setQtyAction(e.target.value)}
                className="flex-1 bg-zinc-900 text-white rounded-lg border border-zinc-800 text-xs px-3 focus:outline-none focus:border-zinc-500 font-mono"
                required
              />
              <button
                type="submit"
                className="bg-white text-black font-semibold text-xs px-4 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Perform
              </button>
            </div>
          </form>
        )}

        {/* Add Cash Account Form inline */}
        <form onSubmit={handleCreateCash} className="border-t border-zinc-800/80 pt-4 flex gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="e.g. Office Desk Safe"
              value={cashName}
              onChange={(e) => setCashName(e.target.value)}
              className="bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-medium"
            />
            <input
              type="number"
              placeholder={`Starting amount (${currency})`}
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              className="bg-[#050505] border border-zinc-800 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="p-2.5 bg-white text-black rounded-xl hover:bg-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus size={14} /> Add Account
          </button>
        </form>
        {errorCash && <p className="text-red-400 text-[10px] mt-1.5">{errorCash}</p>}
      </div>

      {/* 2. Cards Setup and Displays */}
      <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard size={16} className="text-zinc-400" />
              Debit & Credit Bank Cards
            </h3>
            <p className="text-[10px] text-zinc-500">Manage unlimited electronic bank card accounts</p>
          </div>
          {!isAddingCard && (
            <button
              onClick={() => setIsAddingCard(true)}
              className="text-[10px] font-bold text-white uppercase bg-zinc-800 border border-zinc-700 px-3 py-2 rounded-xl flex items-center gap-1 hover:border-zinc-500 cursor-pointer transition-all"
            >
              <Plus size={12} /> New Card
            </button>
          )}
        </div>

        {/* Card Creation form toggle sheet */}
        {isAddingCard && (
          <form onSubmit={handleCreateCard} className="bg-[#050505] border border-zinc-800 p-5 rounded-2xl mb-5 space-y-4 animation-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Issue Electronic Card</span>
              <button
                type="button"
                className="text-xs font-mono font-bold text-zinc-500 hover:text-white uppercase transition-colors"
                onSubmit={() => setIsAddingCard(false)}
                onClick={() => setIsAddingCard(false)}
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-bold block mb-1">Card Nickname</label>
                <input
                  type="text"
                  placeholder="e.g. Travel Silver Black"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-zinc-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-[#888888] font-bold block mb-1">Bank Issuer Name</label>
                <input
                  type="text"
                  placeholder="e.g. HNB Bank, BOC"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-zinc-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-bold block mb-1">Card Type</label>
                <select
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as 'Debit' | 'Credit')}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-zinc-500 font-semibold"
                >
                  <option value="Debit">Debit Account</option>
                  <option value="Credit">Credit Card</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#888888] font-bold block mb-1">Starting Balance ({currency})</label>
                <input
                  type="number"
                  placeholder="Amount"
                  value={cardBalance}
                  onChange={(e) => setCardBalance(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-zinc-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[#888888] font-bold block mb-1">Card Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 4201 9283"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                maxLength={19}
                className="w-full bg-[#050505] border border-zinc-850 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-zinc-550 font-mono"
              />
            </div>

            {/* Custom Aesthetic Theme Selectors */}
            <div>
              <span className="text-[10px] text-[#888888] font-bold block mb-2">Gloss/Hologram Hue</span>
              <div className="flex gap-2">
                {[
                  { name: 'obsidian', color: 'bg-zinc-800 ring-white' },
                  { name: 'sapphire', color: 'bg-blue-600 ring-blue-400' },
                  { name: 'emerald', color: 'bg-emerald-600 ring-emerald-400' },
                  { name: 'copper', color: 'bg-amber-600 ring-amber-400' },
                  { name: 'ruby', color: 'bg-rose-600 ring-rose-400' },
                ].map((th) => (
                  <button
                    key={th.name}
                    type="button"
                    onClick={() => setCardTheme(th.name)}
                    className={`w-7 h-7 rounded-lg ${th.color} border border-black transition-all cursor-pointer ${
                      cardTheme === th.name ? 'ring-2 ring-offset-2 ring-offset-[#050505] scale-110' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-205 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Verify & Add Electronic Card
            </button>
          </form>
        )}

        {/* Display Beautiful Physical Card Previews */}
        <div className="space-y-4">
          {cards.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
              No active cards. Add a credit/debit card.
            </div>
          ) : (
            cards.map((card, idx) => {
              // Assign a theme based on card position or choose randomly
              const themesCodes = ['obsidian', 'sapphire', 'emerald', 'copper', 'ruby'];
              const derivedTheme = themesCodes[idx % themesCodes.length];
              const isCanceled = card.isCanceled || (card as any).is_canceled;

              return (
                <div
                  key={card.id}
                  id={`card-view-${card.id}`}
                  className={`relative p-5 rounded-2xl bg-gradient-to-br ${getCardGradient(derivedTheme)} border shadow-xl flex flex-col justify-between h-36 overflow-hidden transition-all duration-300 ${
                    isCanceled ? 'opacity-50 filter grayscale contrast-75 brightness-90 hover:grayscale-0 hover:opacity-85' : 'hover:scale-[1.01]'
                  }`}
                >
                  {/* Glowing background circles */}
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">{card.bankName}</p>
                      <h4 className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1.5">
                        <span>{card.cardName}</span>
                        {isCanceled && (
                          <span className="text-[8px] bg-red-950/80 text-red-500 border border-red-900/40 px-1 py-0.5 rounded font-bold uppercase tracking-widest font-mono">
                            INACTIVE
                          </span>
                        )}
                      </h4>
                    </div>
                    {isCanceled ? (
                      <span className="text-[9px] uppercase tracking-widest font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded text-rose-400 border border-rose-900/50">
                        CANCELED
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-white/90">
                        {card.cardType}
                      </span>
                    )}
                  </div>

                  <div className="z-10 flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-white/40 block">Available Balance</span>
                      <span className={`text-sm font-bold font-mono tracking-tight ${isCanceled ? 'text-white/50 line-through' : 'text-white'}`}>
                        {currency} {card.currentBalance.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] font-mono text-white/60 tracking-widest">
                        {card.cardNumber || '**** **** **** 0000'}
                      </span>
                      {isCanceled ? (
                        <span className="text-[9px] text-red-400/80 font-mono font-bold uppercase mt-1 tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          CANCELED SECURELY
                        </span>
                      ) : (
                        <button
                          onClick={() => setCardToDelete(card.id)}
                          className="text-[10px] text-rose-400 opacity-60 hover:opacity-100 flex items-center gap-1 mt-1 font-semibold cursor-pointer"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Confirmation Dialog */}
      {cardToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animation-fade-in">
          <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-xs w-full">
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
              <Trash2 size={16} className="text-red-500" />
              Delete Card?
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              Are you sure you want to delete <strong className="text-white">{cards.find(c => c.id === cardToDelete)?.cardName}</strong>? This action will mark it as inactive.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteCard(cardToDelete);
                  setCardToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
