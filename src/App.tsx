import React, { useState, useEffect } from 'react';
import { AppState, CashAccount, BankCard, Income, Expense, Debt, Transaction, AppNotification, CategoryIncome, CategoryExpense } from './types';
import { DEFAULT_APP_STATE } from './initialData';
import { loadStateFromStorage, saveStateToStorage, exportStateAsJSON } from './utils';
import { 
  Plus, Search, Bell, CreditCard, Wallet, Percent, ChevronRight, 
  TrendingUp, User, Lock, Unlock, Settings, HelpCircle, RefreshCw, 
  FileDown, Share2, Landmark, ShieldAlert, ArrowUpRight, ArrowDownLeft,
  DollarSign, CircleDot, Database, CheckSquare, Zap, BadgeCheck, AlertCircle,
  Cloud, CloudOff
} from 'lucide-react';

import EmailLogin from './components/EmailLogin';
import NotificationDrawer from './components/NotificationDrawer';
import CashCardManagement from './components/CashCardManagement';
import InflowsOutflows from './components/InflowsOutflows';
import DebtTracker from './components/DebtTracker';
import ReportsCentre from './components/ReportsCentre';
import SettingsModal from './components/SettingsModal';
import { getSupabaseConfig, syncStateToSupabase } from './supabase';

export default function App() {
  // 1. Core State
  const [state, setState] = useState<AppState>(() => loadStateFromStorage(DEFAULT_APP_STATE));
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'inflow_outflow' | 'debts' | 'reports'>('dashboard');
  
  // Modals & Panels Toggles
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [newPinCode, setNewPinCode] = useState('');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Supabase real-time status tracker
  const [realtimeSyncStatus, setRealtimeSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'disabled'>('idle');
  const [realtimeSyncError, setRealtimeSyncError] = useState<string | null>(null);

  // States for Unified search & filters on history
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');

  // Verify remembered device on mount
  useEffect(() => {
    const verifyDevice = async () => {
      const storedToken = localStorage.getItem('vault_device_token');
      if (!storedToken) {
        setIsCheckingAuth(false);
        setIsUnlocked(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken: storedToken })
        });
        const data = await res.json();
        if (data && data.success) {
          setIsUnlocked(true);
        } else {
          // Token is invalid or expired
          localStorage.removeItem('vault_device_token');
          setIsUnlocked(false);
        }
      } catch (err) {
        console.error("Device token verification failed:", err);
        setIsUnlocked(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    verifyDevice();
  }, []);

  // Synchronize state with Storage whenever it edits
  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      saveStateToStorage(next);
      return next;
    });
  };

  // Automatic background push to Supabase if config exists and auto-sync is checked
  useEffect(() => {
    const { url, key, autoSync } = getSupabaseConfig();
    
    if (!url || !key) {
      setRealtimeSyncStatus('disabled');
      return;
    }
    
    if (!autoSync) {
      setRealtimeSyncStatus('disabled');
      return;
    }

    setRealtimeSyncStatus('syncing');
    setRealtimeSyncError(null);

    const syncTimeout = setTimeout(() => {
      syncStateToSupabase('emalyaditha@gmail.com', state)
        .then(res => {
          if (!res.success) {
            console.warn('Real-time Supabase Auto-sync warned:', res.error);
            setRealtimeSyncStatus('error');
            setRealtimeSyncError(res.error || 'Failed to sync check RLS/Table');
          } else {
            console.log('Real-time Supabase Auto-sync success!');
            setRealtimeSyncStatus('synced');
            setRealtimeSyncError(null);
          }
        })
        .catch(err => {
          console.error('Real-time Supabase Auto-sync failed:', err);
          setRealtimeSyncStatus('error');
          setRealtimeSyncError(err.message || 'Database error.');
        });
    }, 1500);

    return () => clearTimeout(syncTimeout);
  }, [state, isSettingsOpen]);

  // 2. FINANCIAL IMPLEMENTATION LOGICS (SMART AUTOMATION RULES)

  // Rule: Add Income Inflow
  const handleAddIncome = (
    amount: number,
    date: string,
    source: string,
    category: CategoryIncome,
    targetAccountId: string,
    targetType: 'cash' | 'card'
  ) => {
    const incomeId = `inc-${Date.now()}`;
    const transactionId = `trans-${Date.now()}`;

    const newIncome: Income = {
      id: incomeId,
      amount,
      date,
      source,
      category,
      targetAccountId,
      targetType,
    };

    updateState(prev => {
      // 1. Increment target account balances
      let updatedCash = [...prev.cashAccounts];
      let updatedCards = [...prev.cards];

      if (targetType === 'cash') {
        updatedCash = updatedCash.map(c => 
          c.id === targetAccountId ? { ...c, balance: c.balance + amount } : c
        );
      } else {
        updatedCards = updatedCards.map(c => 
          c.id === targetAccountId ? { ...c, currentBalance: c.currentBalance + amount } : c
        );
      }

      // 2. Draft Transaction Record
      const nameOfTarget = targetType === 'cash' 
        ? prev.cashAccounts.find(x => x.id === targetAccountId)?.name || 'Cash'
        : prev.cards.find(x => x.id === targetAccountId)?.cardName || 'Bank Card';

      const newTransaction: Transaction = {
        id: transactionId,
        type: 'income',
        title: source,
        amount,
        date,
        category,
        accountId: targetAccountId,
        accountType: targetType,
        referenceId: incomeId,
      };

      // 3. Optional balance threshold triggers
      const newNotif: AppNotification = {
        id: `nt-${Date.now()}`,
        type: 'system',
        message: `Ledger balanced: Income of ${prev.currency} ${amount.toLocaleString()} credited to ${nameOfTarget}.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
      };

      return {
        ...prev,
        incomes: [...prev.incomes, newIncome],
        cashAccounts: updatedCash,
        cards: updatedCards,
        transactions: [newTransaction, ...prev.transactions],
        notifications: [newNotif, ...prev.notifications],
      };
    });
  };

  // Rule: Add Expense / Invoice
  const handleAddExpense = (
    title: string,
    description: string,
    amount: number,
    date: string,
    category: CategoryExpense,
    paymentMethodId: string,
    paymentMethodType: 'cash' | 'card'
  ) => {
    const expenseId = `exp-${Date.now()}`;
    const transactionId = `trans-${Date.now()}`;

    const newExpense: Expense = {
      id: expenseId,
      title,
      description,
      amount,
      date,
      category,
      paymentMethodId,
      paymentMethodType,
    };

    updateState(prev => {
      // 1. Deduct target account balances
      let updatedCash = [...prev.cashAccounts];
      let updatedCards = [...prev.cards];
      let newAlertNotifications: AppNotification[] = [];

      if (paymentMethodType === 'cash') {
        updatedCash = updatedCash.map(c => {
          if (c.id === paymentMethodId) {
            const nextVal = c.balance - amount;
            if (nextVal < 5000) {
              newAlertNotifications.push({
                id: `nt-alert-${Date.now()}`,
                type: 'alert',
                message: `Low balance alert! ${c.name} is critically low: ${prev.currency} ${nextVal.toLocaleString()}`,
                date: new Date().toISOString().split('T')[0],
                read: false,
              });
            }
            return { ...c, balance: nextVal };
          }
          return c;
        });
      } else {
        updatedCards = updatedCards.map(c => {
          if (c.id === paymentMethodId) {
            const nextVal = c.currentBalance - amount;
            if (nextVal < 10000) {
              newAlertNotifications.push({
                id: `nt-alert-${Date.now()}`,
                type: 'alert',
                message: `Low balance alert! Card ${c.cardName} balance is low: ${prev.currency} ${nextVal.toLocaleString()}`,
                date: new Date().toISOString().split('T')[0],
                read: false,
              });
            }
            return { ...c, currentBalance: nextVal };
          }
          return c;
        });
      }

      // 2. Draft Transaction Record
      const newTransaction: Transaction = {
        id: transactionId,
        type: 'expense',
        title,
        amount,
        date,
        category,
        accountId: paymentMethodId,
        accountType: paymentMethodType,
        referenceId: expenseId,
      };

      return {
        ...prev,
        expenses: [...prev.expenses, newExpense],
        cashAccounts: updatedCash,
        cards: updatedCards,
        transactions: [newTransaction, ...prev.transactions],
        notifications: [...newAlertNotifications, ...prev.notifications],
      };
    });
  };

  // Rule: Debt Registered
  const handleAddDebt = (debtData: Omit<Debt, 'id' | 'payments' | 'remainingAmount'>) => {
    const newDebt: Debt = {
      ...debtData,
      id: `debt-${Date.now()}`,
      remainingAmount: debtData.totalAmount,
      payments: [],
    };

    updateState(prev => {
      const newNotif: AppNotification = {
        id: `nt-${Date.now()}`,
        type: 'reminder',
        message: `Debt due alert set! Repay principal Rs. ${debtData.totalAmount.toLocaleString()} to ${debtData.debtSource} before ${debtData.dueDate}.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
      };

      return {
        ...prev,
        debts: [...prev.debts, newDebt],
        notifications: [newNotif, ...prev.notifications],
      };
    });
  };

  // Rule: Partial Debt Repayment Deductions
  const handleMakeDebtPayment = (
    debtId: string,
    amount: number,
    paidFromId: string,
    paidFromType: 'cash' | 'card'
  ) => {
    const paymentId = `dp-${Date.now()}`;
    const transactionId = `trans-${Date.now()}`;
    const paymentDate = new Date().toISOString().split('T')[0];

    updateState(prev => {
      // 1. Deduct principal accounts
      let updatedCash = [...prev.cashAccounts];
      let updatedCards = [...prev.cards];

      if (paidFromType === 'cash') {
        updatedCash = updatedCash.map(c => 
          c.id === paidFromId ? { ...c, balance: c.balance - amount } : c
        );
      } else {
        updatedCards = updatedCards.map(c => 
          c.id === paidFromId ? { ...c, currentBalance: c.currentBalance - amount } : c
        );
      }

      // 2. Reduce remaining debt
      const updatedDebts = prev.debts.map(debt => {
        if (debt.id === debtId) {
          const newPayment = {
            id: paymentId,
            debtId,
            amount,
            date: paymentDate,
            paidFromId,
            paidFromType,
          };
          return {
            ...debt,
            remainingAmount: Math.max(0, debt.remainingAmount - amount),
            payments: [...debt.payments, newPayment],
          };
        }
        return debt;
      });

      const matchedDebt = prev.debts.find(d => d.id === debtId);
      const newTransaction: Transaction = {
        id: transactionId,
        type: 'debt_payment',
        title: `Debt Repayment - ${matchedDebt?.debtSource || 'Private Loan'}`,
        amount,
        date: paymentDate,
        category: 'Debt Repayment',
        accountId: paidFromId,
        accountType: paidFromType,
        referenceId: paymentId,
      };

      const systemAlert: AppNotification = {
        id: `nt-${Date.now()}`,
        type: 'system',
        message: `Settle Repayment: Reduced loan from ${matchedDebt?.debtSource} by Rs. ${amount.toLocaleString()}.`,
        date: paymentDate,
        read: false,
      };

      return {
        ...prev,
        cashAccounts: updatedCash,
        cards: updatedCards,
        debts: updatedDebts,
        transactions: [newTransaction, ...prev.transactions],
        notifications: [systemAlert, ...prev.notifications],
      };
    });
  };

  // Core cash account list modifiers
  const handleAddCashAccount = (name: string, balance: number) => {
    const newAcct: CashAccount = {
      id: `cash-${Date.now()}`,
      name,
      balance,
    };
    updateState(prev => ({
      ...prev,
      cashAccounts: [...prev.cashAccounts, newAcct],
    }));
  };

  const handleEditCashAccount = (id: string, newBalance: number) => {
    updateState(prev => {
      const match = prev.cashAccounts.find(c => c.id === id);
      const delta = match ? newBalance - match.balance : 0;

      const updatedCash = prev.cashAccounts.map(c => 
        c.id === id ? { ...c, balance: newBalance } : c
      );

      // Log adjustments trace on Transactions Audit ledger
      let updatedTrans = [...prev.transactions];
      if (delta !== 0) {
        updatedTrans = [{
          id: `trans-adjust-${Date.now()}`,
          type: delta > 0 ? 'deposit' : 'withdrawal',
          title: `Balance adjustment: ${match?.name || 'Cash'}`,
          amount: Math.abs(delta),
          date: new Date().toISOString().split('T')[0],
          category: 'Adjustment',
          accountId: id,
          accountType: 'cash',
        }, ...prev.transactions];
      }

      return {
        ...prev,
        cashAccounts: updatedCash,
        transactions: updatedTrans,
      };
    });
  };

  const handleAddCard = (newCardData: Omit<BankCard, 'id'>) => {
    const rawCard: BankCard = {
      ...newCardData,
      id: `card-${Date.now()}`,
    };
    updateState(prev => ({
      ...prev,
      cards: [...prev.cards, rawCard],
    }));
  };

  const handleDeleteCard = (id: string) => {
    updateState(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id),
    }));
  };

  const handleDeleteCashAccount = (id: string) => {
    updateState(prev => ({
      ...prev,
      cashAccounts: prev.cashAccounts.filter(c => c.id !== id),
    }));
  };

  // Notification Modifiers
  const handleMarkNotificationRead = (id: string) => {
    updateState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  };

  const handleClearNotification = (id: string) => {
    updateState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  };

  // Reset demo setup
  const triggerResetDemo = () => {
    if (confirm('Are you sure you want to restore all ledger books to initial demo genesis states? This replaces modifications.')) {
      updateState(() => DEFAULT_APP_STATE);
      alert('Ledger re-seeded beautifully.');
    }
  };

  // JSON state upload restoration
  const handleJSONRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedJson = JSON.parse(event.target?.result as string);
        if (loadedJson.cashAccounts && loadedJson.cards && loadedJson.transactions) {
          updateState(() => loadedJson);
          alert('Database restored successfully! Ledger tracks have re-balanced.');
        } else {
          alert('Invalid backup file. Requisites database elements were missing.');
        }
      } catch (err) {
        alert('File decode failure. Try with a valid export JSON backup.');
      }
    };
    reader.readAsText(file);
  };

  // 3. AGGREGATES & BALANCES COMPUTERS
  const totalCashAmount = state.cashAccounts.reduce((sum, c) => sum + c.balance, 0);
  const totalCardsAmount = state.cards.reduce((sum, c) => sum + c.currentBalance, 0);
  const totalDebtsAmount = state.debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const aggregateActiveWealth = totalCashAmount + totalCardsAmount;

  const currentMonthInflow = state.transactions
    .filter(t => t.type === 'income' && t.date.includes('-05-')) // Filter to May
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthOutflow = state.transactions
    .filter(t => t.type === 'expense' && t.date.includes('-05-'))
    .reduce((sum, t) => sum + t.amount, 0);

  // 4. TRANSACTION FILTERING METHOD
  const filteredHistory = state.transactions.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesAccount = filterAccount === 'all' || t.accountId === filterAccount;

    return matchesSearch && matchesType && matchesAccount;
  });

  // Render loading state while validating device identity
  if (isCheckingAuth) {
    return (
      <div id="auth-loading-screen" className="min-h-screen bg-[#050505] text-white flex flex-col justify-center items-center p-6 font-mono select-none">
        <div className="flex flex-col items-center gap-4 text-center animate-pulse">
          <div className="w-12 h-12 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-700 rounded-full border-t-emerald-400 animate-spin" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Secure Connection</span>
            <p className="text-zinc-500 text-[10px] mt-1.5">Checking trusted owner device...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="full-workspace-view" className="min-h-screen bg-[#050505] text-white flex flex-col justify-between font-sans selection:bg-white selection:text-black antialiased">
      
      {/* 1. TOP HEADER BRAND RAIL */}
      <header className="px-6 py-4 bg-[#050505] border-b border-zinc-900 flex justify-between items-center z-20" id="header-brand-rail">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white flex items-center justify-center rounded-xl shadow-lg shadow-white/5 shrink-0">
            <div className="w-5 h-5 border-4 border-black rounded-full border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-1.5 leading-none">
              Finance Manager
            </h1>
            <p className="text-[9px] text-zinc-500 font-mono mt-1">Owner Device Secured</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Supabase Sync Badge Indicator */}
          {realtimeSyncStatus === 'syncing' && (
            <div className="px-2.5 py-1.5 rounded-lg border border-amber-900/60 bg-amber-950/20 text-amber-400 text-[10px] font-bold flex items-center gap-1.5 font-mono">
              <RefreshCw size={11} className="animate-spin" />
              <span>SYNCING...</span>
            </div>
          )}

          {realtimeSyncStatus === 'synced' && (
            <div className="px-2.5 py-1.5 rounded-lg border border-emerald-950/20 border-emerald-900/50 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 font-mono">
              <Cloud size={11} />
              <span>CLOUD SYNCED</span>
            </div>
          )}

          {realtimeSyncStatus === 'error' && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-red-900/60 bg-red-950/15 text-red-400 text-[10px] font-bold flex items-center gap-1.5 font-mono hover:bg-red-950/30 transition-all cursor-pointer"
              title={`Sync Error: ${realtimeSyncError || 'Details in Settings.'}`}
            >
              <CloudOff size={11} className="animate-pulse text-red-400" />
              <span>SYNC ERROR</span>
            </button>
          )}

          {realtimeSyncStatus === 'disabled' && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-400 text-[10px] font-bold flex items-center gap-1.5 font-mono hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
              title="Cloud Synchronization is disabled or off. Click to configure."
            >
              <Database size={11} />
              <span>CLOUD: MANUAL</span>
            </button>
          )}

          {/* Settings Mark */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 bg-neutral-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-700 cursor-pointer transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Settings & System State"
            id="header-settings-trigger"
          >
            <Settings size={13} className="text-zinc-400" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* ======================= RE-LOCK SCREEN INTERACTION ======================= */}
      {!isUnlocked && (
        <EmailLogin
          onUnlocked={() => {
            setIsUnlocked(true);
            setActiveTab('dashboard');
          }}
        />
      )}

      {/* 2. DUAL LAYOUT: MAIN VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative pb-12">
        
        {/* =================== COLUMN 1: ACCESS MODULES & ACTIVE OPERATIONS =================== */}
        <section className="col-span-1 lg:col-span-3 order-3 lg:order-1 space-y-6 w-full" id="desktop-control-column">
          
          {/* Navigation Menu (Visible on Desktop / Large screens, hidden on Mobile) */}
          <div className="bg-zinc-900/50 border border-zinc-850 p-6 rounded-[24px] space-y-4 shadow-xl hidden lg:block animate-fade-in shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              Application Menu
            </h3>
            <nav className="flex flex-col gap-1.5" id="web-sidebar-navigation">
              {[
                { tab: 'dashboard', icon: <Percent size={15} />, label: 'Overview Hub' },
                { tab: 'accounts', icon: <Wallet size={15} />, label: 'Wallets Portfolio' },
                { tab: 'inflow_outflow', icon: <Plus size={15} />, label: 'Ledger Registry' },
                { tab: 'debts', icon: <CircleDot size={15} />, label: 'Track Liabilities' },
                { tab: 'reports', icon: <TrendingUp size={15} />, label: 'Reports Centre' },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as any)}
                  className={`w-full py-3 px-4 rounded-xl font-mono font-bold text-xs flex items-center gap-3 transition-all cursor-pointer border ${
                    activeTab === item.tab
                      ? 'bg-white border-white text-black shadow-md'
                      : 'text-zinc-400 bg-transparent border-transparent hover:text-white hover:border-zinc-800 hover:bg-zinc-900/40'
                  }`}
                >
                  <span className={`${activeTab === item.tab ? 'text-black' : 'text-zinc-500'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </section>

        {/* =================== COLUMN 2: FINANCIAL WEB CONTENT (WIDESCREEN EXPANSION) =================== */}
        <section className="col-span-1 lg:col-span-6 order-1 lg:order-2 space-y-6 w-full animate-fade-in" id="central-web-canvas">
          
          {/* Header block for current active tab */}
          <div className="flex justify-between items-center bg-zinc-900/50 border border-zinc-850 p-6 rounded-[28px] shadow-xl">
            <div>
              <span className="text-[10px] tracking-widest text-[#8aa8bb] font-mono font-bold uppercase block">
                {activeTab === 'dashboard' ? 'Overview Hub' :
                 activeTab === 'accounts' ? 'Wallets Core' :
                 activeTab === 'inflow_outflow' ? 'Ledger Action' :
                 activeTab === 'debts' ? 'Track Liabilities' : 'Diagnostics Reports'}
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white capitalize leading-tight">
                {activeTab.replace('_', ' ')} Overview
              </h2>
            </div>

            {/* Notifications trigger bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="p-3 bg-[#050505] border border-zinc-800 rounded-full text-zinc-300 hover:text-white hover:border-zinc-500 relative cursor-pointer shadow-md transition-all animate-fade-in"
            >
              <Bell size={14} />
              {state.notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#050505] rounded-full animate-pulse" />
              )}
            </button>
          </div>

          {/* Supabase Error Diagnostics Banner */}
          {realtimeSyncStatus === 'error' && (
            <div className="bg-red-950/20 border border-red-900/60 p-5 rounded-[24px] space-y-3 shadow-lg animate-fade-in" id="supabase-sync-error-diagnostic-panel">
              <div className="flex gap-2 items-center text-red-500 font-bold text-xs">
                <CloudOff size={15} className="shrink-0" />
                <span>REAL-TIME CLOUD SYNC ERROR DETECTED</span>
              </div>
              <p className="text-[11px] text-zinc-350 leading-relaxed">
                Your local ledger tracks couldn't synchronize instantly to Supabase. This is why some newly created Cash Wallets or cards/transactions might not appear in your database table.
              </p>
              <div className="bg-black/50 p-3 rounded-xl border border-red-950/50 space-y-1 font-mono text-[10px]">
                <span className="text-zinc-500 font-bold block uppercase">REJECTED CODE:</span>
                <span className="text-red-400 font-semibold block break-words">{realtimeSyncError || 'Supabase Connection Rejected.'}</span>
              </div>
              <div className="pt-1.5 space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">3-STEP DIAGNOSTICS & RESOLUTION GUIDE:</span>
                <ol className="list-decimal list-inside text-[10px] text-zinc-400 space-y-1 leading-normal">
                  <li>Press <strong>Settings</strong> and confirm that your saved <strong>Supabase Secret Anon Key</strong> corresponds to your project credentials securely.</li>
                  <li>Make sure the <code className="text-teal-400 font-mono">ledger_states</code> core table exists in your database table schemas.</li>
                  <li>Copy and run the 1-click database generation SQL script directly inside your <strong>Supabase SQL Editor</strong> (under Settings).</li>
                </ol>
              </div>
            </div>
          )}

          {/* Active Canvas Body */}
          <div className="space-y-6">

              {/* =================== CASE: TAB: DASHBOARD =================== */}
              {activeTab === 'dashboard' && (
                <div className="space-y-5 animation-fade-in" id="dashboard-tab">
                  
                  {/* Immersive Theme Total Balance Hero Card */}
                  <div className="relative p-7 rounded-[32px] bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-700 shadow-2xl flex flex-col justify-between min-h-[180px] overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full"></div>
                    
                    <div>
                      <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Total Net Worth</p>
                      <h2 className="text-4xl font-light tracking-tighter text-white">
                        {state.currency} {aggregateActiveWealth.toLocaleString()}
                        <span className="text-zinc-500 text-xl font-light font-sans">.00</span>
                      </h2>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 z-10">
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Physical Cash</p>
                        <p className="text-emerald-400 text-xs font-mono font-bold">+{state.currency}{totalCashAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Credit/Debit Assets</p>
                        <p className="text-zinc-300 text-xs font-mono font-bold">{state.currency}{totalCardsAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cash Flow Quick Bar overview */}
                  <div className="grid grid-cols-2 gap-3" id="cash-flow-overview">
                    <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-[20px] flex items-center justify-between shadow-sm">
                      <div className="min-w-0">
                        <span className="text-[9px] text-[#888888] font-bold uppercase block font-mono">May Received</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">+{state.currency}{currentMonthInflow.toLocaleString()}</span>
                      </div>
                      <div className="p-2 bg-emerald-950/20 text-emerald-400 rounded-lg">
                        <ArrowUpRight size={13} />
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-[20px] flex items-center justify-between shadow-sm">
                      <div className="min-w-0">
                        <span className="text-[9px] text-[#888888] font-bold uppercase block font-mono">May Paid</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">-{state.currency}{currentMonthOutflow.toLocaleString()}</span>
                      </div>
                      <div className="p-2 bg-rose-950/20 text-rose-400 rounded-lg">
                        <ArrowDownLeft size={13} />
                      </div>
                    </div>
                  </div>

                  {/* Custom quick category breakdown display */}
                  <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-[20px] flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <CircleDot size={12} className="text-amber-500 animate-pulse" />
                      <span className="text-[10px] text-zinc-400 font-semibold font-mono">Active Debts Balance</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-white">
                      {state.currency} {totalDebtsAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* Credit cards slider visual */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs px-1">
                      <span className="font-bold text-zinc-400">Electronic Cards</span>
                      <button onClick={() => setActiveTab('accounts')} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors">Add/Edit</button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }} id="cards-slider">
                      {state.cards.map((card) => (
                        <div key={card.id} className="w-[85%] bg-gradient-to-br from-zinc-850 to-zinc-950 border border-zinc-750 p-4 rounded-[20px] shrink-0 space-y-4 shadow-lg hover:border-zinc-600 transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] uppercase text-zinc-400 font-mono tracking-widest block">{card.bankName}</span>
                              <h5 className="text-xs font-bold text-white leading-tight font-sans mt-0.5">{card.cardName}</h5>
                            </div>
                            <span className="text-[9px] text-zinc-500 tracking-wider font-mono bg-black/40 px-1.5 py-0.5 rounded-md border border-zinc-800">{card.cardType}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-500 block">Balance</span>
                            <span className="text-xs font-bold font-mono text-white text-md">
                              {state.currency} {card.currentBalance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Transaction Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-404 text-zinc-400 px-1">Recent Transactions</h4>
                    <div className="space-y-2">
                      {state.transactions.slice(0, 4).map((t) => {
                        const isIncome = t.type === 'income' || t.type === 'deposit';
                        return (
                          <div key={t.id} className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-[18px] flex justify-between items-center hover:border-zinc-700 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl shrink-0 text-center ${
                                isIncome ? 'bg-emerald-990 bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'
                              }`}>
                                {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                              </div>
                              <div>
                                <h5 className="text-xs font-semibold text-white truncate max-w-[170px]">{t.title}</h5>
                                <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500">{t.category} • {t.date}</span>
                              </div>
                            </div>
                            <span className={`text-xs font-bold font-mono ${
                              isIncome ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {isIncome ? '+' : '-'}{state.currency}{t.amount.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* =================== CASE: TAB: ACCOUNTS =================== */}
              {activeTab === 'accounts' && (
                <CashCardManagement
                  cashAccounts={state.cashAccounts}
                  cards={state.cards}
                  onAddCashAccount={handleAddCashAccount}
                  onEditCashAccount={handleEditCashAccount}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteCashAccount={handleDeleteCashAccount}
                  currency={state.currency}
                />
              )}

              {/* =================== CASE: TAB: INFLOWS_OUTFLOWS =================== */}
              {activeTab === 'inflow_outflow' && (
                <InflowsOutflows
                  cashAccounts={state.cashAccounts}
                  cards={state.cards}
                  onAddIncome={handleAddIncome}
                  onAddExpense={handleAddExpense}
                  currency={state.currency}
                />
              )}

              {/* =================== CASE: TAB: DEBTS =================== */}
              {activeTab === 'debts' && (
                <DebtTracker
                  debts={state.debts}
                  cashAccounts={state.cashAccounts}
                  cards={state.cards}
                  onAddDebt={handleAddDebt}
                  onMakeDebtPayment={handleMakeDebtPayment}
                  currency={state.currency}
                />
              )}

              {/* =================== CASE: TAB: REPORTS =================== */}
              {activeTab === 'reports' && (
                <ReportsCentre
                  transactions={state.transactions}
                  incomes={state.incomes}
                  expenses={state.expenses}
                  debts={state.debts}
                  currency={state.currency}
                />
              )}

            </div>

            {/* =================== MOBILE BOTTOM BAR NAVIGATOR =================== */}
            <nav className="fixed bottom-0 inset-x-0 bg-[#050505]/95 backdrop-blur-md border-t border-zinc-850 pb-5 pt-2 flex justify-around items-center z-30 shadow-2xl lg:hidden">
              {[
                { tab: 'dashboard', icon: <Percent size={16} />, label: 'Summary' },
                { tab: 'accounts', icon: <Wallet size={16} />, label: 'Wallets' },
                { tab: 'inflow_outflow', icon: <Plus size={16} />, label: 'Register' },
                { tab: 'debts', icon: <CircleDot size={16} />, label: 'Liabilities' },
                { tab: 'reports', icon: <TrendingUp size={16} />, label: 'Reports' },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as any)}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    activeTab === item.tab ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${activeTab === item.tab ? 'bg-zinc-800 border border-zinc-700 shadow-md text-white' : 'text-zinc-400'}`}>
                    {item.icon}
                  </div>
                  <span className="text-[9px] uppercase tracking-widest font-semibold font-mono">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Notification sheet slideover drawer */}
            <NotificationDrawer
              notifications={state.notifications}
              onMarkRead={handleMarkNotificationRead}
              onClear={handleClearNotification}
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
            />

            {/* System Settings overlay modal */}
            <SettingsModal
              state={state}
              updateState={updateState}
              exportStateAsJSON={exportStateAsJSON}
              handleJSONRestore={handleJSONRestore}
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              onLogout={() => {
                localStorage.removeItem('vault_device_token');
                setIsUnlocked(false);
                setIsSettingsOpen(false);
              }}
            />

        </section>

        {/* =================== COLUMN 3: UNIFIED HISTORY SEARCH & AUDIT LOGS =================== */}
        <section className="col-span-1 lg:col-span-3 order-2 lg:order-3 bg-zinc-900/50 border border-zinc-850 p-6 rounded-[24px] space-y-5 shadow-xl w-full" id="unified-audits-column">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Searchable History</h3>
              <p className="text-sm font-extrabold text-white">Unified Ledger Journals</p>
            </div>
            <span className="text-[9px] font-mono bg-[#050505] px-2 py-0.5 border border-zinc-800 rounded text-zinc-400 font-bold">
              {filteredHistory.length} EVENTS
            </span>
          </div>

          {/* Search Inputs */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="text-zinc-600 absolute left-3.5 top-[11px]" />
              <input
                type="text"
                placeholder="Search transactions, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#050505] text-xs px-9 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Quick Filter Selectors Category Type */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#050505] border border-zinc-800 rounded-lg text-xs px-1.5 py-1.5 text-zinc-300 focus:outline-none"
              >
                <option value="all">Any Inflow/Outflow</option>
                <option value="income">Only Income</option>
                <option value="expense">Only Expense</option>
                <option value="debt_payment">Debt Repayment</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>

              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="bg-[#050505] border border-zinc-800 rounded-lg text-xs px-1.5 py-1.5 text-zinc-300 focus:outline-none"
              >
                <option value="all">Any Account Source</option>
                {state.cashAccounts.map(c => (
                  <option key={c.id} value={c.id}>Cash: {c.name}</option>
                ))}
                {state.cards.map(card => (
                  <option key={card.id} value={card.id}>Card: {card.cardName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List display */}
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }} id="filtered-list">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-xs italic border border-dashed border-zinc-800 rounded-2xl bg-[#050505]/40 animate-pulse">
                No archived journal entries matched this query.
              </div>
            ) : (
              filteredHistory.map((t) => {
                const isInc = t.type === 'income' || t.type === 'deposit';
                return (
                  <div key={t.id} id={`audit-card-${t.id}`} className="p-3.5 bg-[#050505]/60 border border-zinc-850 rounded-xl space-y-1.5 hover:border-zinc-700 transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-mono tracking-widest text-zinc-550 text-zinc-500 font-bold uppercase">
                        {t.type}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {t.date}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      <h4 className="text-xs font-semibold text-white truncate max-w-[155px] font-sans">{t.title}</h4>
                      <span className={`text-xs font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-rose-450 text-rose-450 text-rose-450 text-rose-400'}`}>
                        {isInc ? '+' : '-'}{state.currency}{t.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-800/50">
                      <span className="font-semibold">{t.category}</span>
                      <span className="font-mono text-zinc-600">
                        {t.accountId ? (
                          `Source: ${t.accountId.substring(0, 8)}...`
                        ) : 'Consolidated Inflow'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>

      {/* 3. WORKSPACE FOOTER CORE STATUS */}
      <footer className="bg-[#050505] border-t border-zinc-900 px-6 py-3.5 z-10 flex flex-col md:flex-row justify-between items-center text-[11px] text-zinc-500 font-mono gap-3">
        <div className="flex items-center gap-2">
          <CircleDot size={12} className="text-emerald-400 animate-pulse" />
          <span>Local database mirror synchronized fully.</span>
        </div>
        <div className="flex gap-4">
          <span>Client Ref: c5675a6a</span>
          <span>Google AI Studio Build</span>
        </div>
      </footer>

    </div>
  );
}
