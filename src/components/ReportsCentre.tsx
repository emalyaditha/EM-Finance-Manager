import React, { useState } from 'react';
import { Transaction, Income, Expense, Debt } from '../types';
import { exportTransactionsToCSV, EXPENSE_COLORS, INCOME_COLORS } from '../utils';
import { FileDown, Printer, BarChart3, TrendingUp, Award, Calendar, DollarSign, PieChart, Landmark } from 'lucide-react';
import { IncomeVsExpenseBar, SpendingByCategoryPie, TrendAnalysisChart } from './Charts';

interface ReportsCentreProps {
  transactions: Transaction[];
  incomes: Income[];
  expenses: Expense[];
  debts: Debt[];
  currency: string;
}

export default function ReportsCentre({
  transactions,
  incomes,
  expenses,
  debts,
  currency,
}: ReportsCentreProps) {
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'category' | 'debt'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('05'); // May by default
  const [selectedYear, setSelectedYear] = useState('2026');

  // Filter systems
  const filteredTransactions = transactions.filter(t => {
    const [year, month] = t.date.split('-');
    if (reportType === 'monthly') {
      return month === selectedMonth && year === selectedYear;
    }
    if (reportType === 'yearly') {
      return year === selectedYear;
    }
    return true; // Category and Debt are lifetime/aggregate by default
  });

  // Calculate Aggregations
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebtPaid = filteredTransactions
    .filter(t => t.type === 'debt_payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense - totalDebtPaid;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Calculate Category Breakdowns
  const expensesByCategory: Record<string, number> = {};
  filteredTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });

  const totalExpenseCategorySum = Object.values(expensesByCategory).reduce((s, v) => s + v, 0) || 1;
  const categoryChartList = Object.entries(expensesByCategory).map(([name, val]) => {
    const percentage = Math.round((val / totalExpenseCategorySum) * 100);
    return {
      name,
      value: val,
      percentage,
      color: EXPENSE_COLORS[name] || '#6B7280',
    };
  }).sort((a, b) => b.value - a.value);

  // Sparkline vector data from filtered list
  const sparklineData = filteredTransactions.length > 0 
    ? filteredTransactions.slice(-6).map(t => t.amount)
    : [10000, 15000, 12000, 19000, 25000, 22000]; // fallback

  const handleExcelExport = () => {
    exportTransactionsToCSV(transactions, currency);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div id="reports-centre-view" className="space-y-6">
      
      {/* 1. Category Switch Header */}
      <div className="grid grid-cols-4 p-1.5 bg-[#050505] border border-zinc-850 rounded-2xl text-center" id="reports-type-selectors">
        {[
          { key: 'monthly', label: 'Monthly' },
          { key: 'yearly', label: 'Annual' },
          { key: 'category', label: 'Split' },
          { key: 'debt', label: 'Credits' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setReportType(item.key as any)}
            className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              reportType === item.key
                ? 'bg-zinc-800 border border-zinc-700 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Period Dropdowns */}
      {(reportType === 'monthly' || reportType === 'yearly') && (
        <div className="flex gap-2 p-1.5 bg-[#050505] border border-zinc-850 rounded-2xl" id="period-dropdowns">
          {reportType === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 bg-[#050505] border border-zinc-800 text-zinc-300 rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-semibold"
            >
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          )}

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="flex-1 bg-[#050505] border border-zinc-800 text-zinc-300 rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-zinc-500 font-semibold"
          >
            <option value="2025">Year 2025</option>
            <option value="2026">Year 2026</option>
            <option value="2027">Year 2027</option>
            <option value="2028">Year 2028</option>
          </select>
        </div>
      )}

      {/* 2. Primary Metrics Block */}
      <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 text-zinc-900/40 pointer-events-none">
          <Award size={64} className="opacity-15" />
        </div>

        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">Total Net savings</span>
        <h2 className="text-xl font-extrabold text-white mt-1">
          {currency} {netSavings.toLocaleString()}
        </h2>
        <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
          Aggregated calculation of total inflows deducting outstanding invoices paid out as passive charges.
        </p>

        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-zinc-800/80 text-center">
          <div className="bg-[#050505]/60 border border-zinc-800 p-2.5 rounded-xl">
            <span className="text-[9px] text-zinc-500 block uppercase font-mono font-bold">Collected</span>
            <span className="text-xs font-mono font-extrabold text-emerald-400">+{currency} {totalIncome.toLocaleString()}</span>
          </div>

          <div className="bg-[#050505]/60 border border-zinc-800 p-2.5 rounded-xl">
            <span className="text-[9px] text-zinc-500 block uppercase font-mono font-bold">Settled</span>
            <span className="text-xs font-mono font-extrabold text-rose-400">-{currency} {totalExpense.toLocaleString()}</span>
          </div>

          <div className="bg-[#050505]/60 border border-zinc-800 p-2.5 rounded-xl">
            <span className="text-[9px] text-zinc-500 block uppercase font-mono font-bold">Savings %</span>
            <span className="text-xs font-mono font-extrabold text-white">
              {savingsRate > 0 ? `+${savingsRate}%` : `${savingsRate}%`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. CHARTS INTERFACES */}
      {reportType !== 'debt' ? (
        <div className="space-y-5">
          <IncomeVsExpenseBar income={totalIncome} expense={totalExpense} currency={currency} />
          <SpendingByCategoryPie categories={categoryChartList} />
          <TrendAnalysisChart data={sparklineData} currency={currency} />
        </div>
      ) : (
        /* Debt / Credit outstanding track list */
        <div className="bg-zinc-900/50 border border-zinc-850 rounded-[28px] p-6 space-y-4 shadow-xl">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-white font-sans">Passive Liabilities Breakdown</h4>
            <span className="text-[9px] text-zinc-550 text-zinc-400 font-mono uppercase tracking-wider">By principal</span>
          </div>

          <div className="space-y-2">
            {debts.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-6">No credit debt on record.</p>
            ) : (
              debts.map(d => {
                const paid = d.totalAmount - d.remainingAmount;
                const ratio = Math.round((paid / d.totalAmount) * 100);

                return (
                  <div key={d.id} className="bg-[#050505]/60 border border-zinc-800 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex justify-between text-xs font-semibold text-white">
                      <span>{d.debtSource}</span>
                      <span className="font-mono font-bold text-amber-400">{currency} {d.remainingAmount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. EXPORT UTILITIES TRIPLE BUTTON */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={handleExcelExport}
          className="py-3.5 bg-[#050505] border border-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-900 hover:border-zinc-500 transition-all cursor-pointer shadow-sm"
        >
          <FileDown size={14} className="text-zinc-400" />
          Export Ledger (CSV)
        </button>

        <button
          onClick={handlePrintPDF}
          className="py-3.5 bg-white text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
        >
          <Printer size={14} className="text-black" />
          Print PDF Report
        </button>
      </div>

    </div>
  );
}
