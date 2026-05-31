import React, { useState } from 'react';
import { CashAccount, BankCard, CategoryIncome, CategoryExpense } from '../types';
import { PlusCircle, MinusCircle, Wallet, CreditCard, Calendar, RefreshCcw, Landmark, ShieldAlert, Tag } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface InflowsOutflowsProps {
  cashAccounts: CashAccount[];
  cards: BankCard[];
  onAddIncome: (amount: number, date: string, source: string, category: CategoryIncome, targetId: string, targetType: 'cash' | 'card') => void;
  onAddExpense: (title: string, description: string, amount: number, date: string, category: CategoryExpense, paymentMethodId: string, paymentMethodType: 'cash' | 'card') => void;
  currency: string;
}

export default function InflowsOutflows({
  cashAccounts,
  cards,
  onAddIncome,
  onAddExpense,
  currency,
}: InflowsOutflowsProps) {
  const { showToast } = useNotifications();
  // Navigation trigger Inside Inflows Tab
  const [toggleForm, setToggleForm] = useState<'income' | 'expense'>('income');

  // Income Fields
  const [incAmount, setIncAmount] = useState('');
  const [incSource, setIncSource] = useState('');
  const [incCategory, setIncCategory] = useState<CategoryIncome>('Salary');
  const [incTargetId, setIncTargetId] = useState('');
  const [incTargetType, setIncTargetType] = useState<'cash' | 'card'>('cash');
  const [incDate, setIncDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Expense/Invoice Fields
  const [expTitle, setExpTitle] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<CategoryExpense>('Utilities');
  const [expMethodId, setExpMethodId] = useState('');
  const [expMethodType, setExpMethodType] = useState<'cash' | 'card'>('cash');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Balance Insufficiency state
  const [insufficiencyError, setInsufficiencyError] = useState<string | null>(null);

  // Auto-populate first target/method on component load
  React.useEffect(() => {
    if (cashAccounts.length > 0 && !incTargetId) {
      setIncTargetId(cashAccounts[0].id);
      setIncTargetType('cash');
    } else if (cards.length > 0 && !incTargetId) {
      setIncTargetId(cards[0].id);
      setIncTargetType('card');
    }

    if (cashAccounts.length > 0 && !expMethodId) {
      setExpMethodId(cashAccounts[0].id);
      setExpMethodType('cash');
    } else if (cards.length > 0 && !expMethodId) {
      setExpMethodId(cards[0].id);
      setExpMethodType('card');
    }
  }, [cashAccounts, cards, incTargetId, expMethodId]);

  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(incAmount) || 0;
    if (amountNum <= 0) {
      showToast('error', 'Amount must be positive');
      return;
    }

    if (!incTargetId) {
      showToast('error', 'Please select a target cash asset or bank card account');
      return;
    }

    onAddIncome(amountNum, incDate, incSource || 'Anonymous Inflow', incCategory, incTargetId, incTargetType);
    setIncAmount('');
    setIncSource('');
    setIncCategory('Salary');
    showToast('success', 'Income received and ledger balanced successfully!');
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInsufficiencyError(null);
    const amountNum = parseFloat(expAmount) || 0;
    if (amountNum <= 0) {
      showToast('error', 'Amount must be positive');
      return;
    }

    if (!expMethodId) {
      showToast('error', 'Please select a valid payment source account');
      return;
    }

    // Guard: Prevent payments with insufficient balances!
    let availableBalance = 0;
    if (expMethodType === 'cash') {
      const match = cashAccounts.find(c => c.id === expMethodId);
      availableBalance = match ? match.balance : 0;
    } else {
      const match = cards.find(c => c.id === expMethodId);
      availableBalance = match ? match.currentBalance : 0;
    }

    if (availableBalance < amountNum) {
      setInsufficiencyError(`Incomplete Transaction: Insufficient balance in chosen account! Available: ${currency} ${availableBalance.toLocaleString()}, required: ${currency} ${amountNum.toLocaleString()}`);
      return;
    }

    onAddExpense(
      expTitle || 'Instant Invoice',
      expDesc || 'Uncategorized charge log',
      amountNum,
      expDate,
      expCategory,
      expMethodId,
      expMethodType
    );

    setExpAmount('');
    setExpTitle('');
    setExpDesc('');
    showToast('success', 'Invoice payment settled automatically! Account balance reduced.');
  };

  const handleSelectTargetAccount = (value: string) => {
    const [id, type] = value.split(':');
    setIncTargetId(id);
    setIncTargetType(type as 'cash' | 'card');
  };

  const handleSelectPaymentMethod = (value: string) => {
    const [id, type] = value.split(':');
    setExpMethodId(id);
    setExpMethodType(type as 'cash' | 'card');
    setInsufficiencyError(null);
  };

  return (
    <div id="inflows-outflows-view" className="space-y-5">
      
      {/* Tab Selectors */}
      <div className="grid grid-cols-2 p-1.5 bg-[#050505] border border-zinc-850 rounded-2xl" id="tab-selectors">
        <button
          onClick={() => {
            setToggleForm('income');
            setInsufficiencyError(null);
          }}
          className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            toggleForm === 'income'
              ? 'bg-zinc-800 border border-zinc-700 text-white shadow-md font-sans font-bold'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <PlusCircle size={14} className="text-emerald-400" />
          Log Inflow
        </button>

        <button
          onClick={() => setToggleForm('expense')}
          className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            toggleForm === 'expense'
              ? 'bg-zinc-800 border border-zinc-700 text-white shadow-md font-sans font-bold'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MinusCircle size={14} className="text-rose-400" />
          Log Outflow
        </button>
      </div>

      {/* 2. FORM MODULES */}
      <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl">
        
        {toggleForm === 'income' ? (
          /* ================== INCOME ENTRY FORM ================== */
          <form onSubmit={handleIncomeSubmit} className="space-y-4" id="log-income-form">
            <div>
              <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Receipt Source Title</label>
              <input
                type="text"
                placeholder="e.g. Website Overhaul project bonus"
                value={incSource}
                onChange={(e) => setIncSource(e.target.value)}
                required
                className="w-full bg-[#050505] border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Received Sum ({currency})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={incAmount}
                  onChange={(e) => setIncAmount(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Inflow Category</label>
                <select
                  value={incCategory}
                  onChange={(e) => setIncCategory(e.target.value as CategoryIncome)}
                  className="w-full bg-[#050505] border border-zinc-800 text-zinc-300 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Salary">Salary</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Business">Business</option>
                  <option value="Bonus">Bonus</option>
                  <option value="Commission">Commission</option>
                  <option value="Other">Other Income</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold block mb-1 uppercase">Record Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={incDate}
                    onChange={(e) => setIncDate(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold block mb-1 uppercase">Receipt Target Account</label>
                <select
                  value={`${incTargetId}:${incTargetType}`}
                  onChange={(e) => handleSelectTargetAccount(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 text-white text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-zinc-500 font-medium font-mono"
                  required
                >
                  <optgroup label="Cash Wallets">
                    {cashAccounts.map(c => (
                      <option key={c.id} value={`${c.id}:cash`}>Wallet: {c.name} (Bal: {currency}{c.balance})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Bank Card Accounts">
                    {cards.filter(c => !c.isCanceled).map(card => (
                      <option key={card.id} value={`${card.id}:card`}>{card.bankName} - {card.cardName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-white text-black font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-lg"
            >
              <PlusCircle size={14} className="text-emerald-600" />
              Collect and Increment Balance
            </button>
          </form>
        ) : (
          /* ================== EXPENSE DEBIT FORM ================== */
          <form onSubmit={handleExpenseSubmit} className="space-y-4" id="log-expense-form">
            <div>
              <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Expense / Invoice Title</label>
              <input
                type="text"
                placeholder="e.g. Electric bill payment, restaurant burger"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                required
                className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Invoice Notes / Description</label>
              <input
                type="text"
                placeholder="e.g. Account code: ELE-291, reference 1"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Settled Sum ({currency})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={expAmount}
                  onChange={(e) => {
                    setExpAmount(e.target.value);
                    setInsufficiencyError(null);
                  }}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold uppercase block mb-1">Usage Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as CategoryExpense)}
                  className="w-full bg-[#050505] border border-zinc-805 border-zinc-800 text-white text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Medical">Medical</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold block mb-1 uppercase">Transaction Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#888888] font-mono font-bold block mb-1 uppercase">Deduct Balance From</label>
                <select
                  value={`${expMethodId}:${expMethodType}`}
                  onChange={(e) => handleSelectPaymentMethod(e.target.value)}
                  className="w-full bg-[#050505] border border-zinc-808 border-zinc-800 text-white text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-zinc-500"
                  required
                >
                  <optgroup label="Cash Wallets">
                    {cashAccounts.map(c => (
                      <option key={c.id} value={`${c.id}:cash`}>{c.name} ({currency}{c.balance})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Saved Bank Cards">
                    {cards.filter(c => !c.isCanceled).map(card => (
                      <option key={card.id} value={`${card.id}:card`}>{card.bankName} - {card.cardName} ({currency}{card.currentBalance})</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* ERROR TRIGGER INDICATOR */}
            {insufficiencyError && (
              <div className="p-4 bg-rose-950/40 border border-rose-900/65 rounded-xl flex items-start gap-2 text-rose-300 font-semibold text-xs leading-relaxed animation-bounce mt-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-400 font-extrabold" />
                <span>{insufficiencyError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-white text-black font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-lg"
            >
              <MinusCircle size={14} className="text-rose-600" />
              Settle Invoice & Deduct
            </button>
          </form>
        )}
      </div>

      <div className="bg-zinc-900/10 border border-zinc-850 rounded-[20px] p-4 flex gap-2 justify-center text-center">
        <span className="text-[10px] font-mono text-zinc-500">
          * Dynamic system triggers will sync balances & log audit lines instantly.
        </span>
      </div>
    </div>
  );
}
