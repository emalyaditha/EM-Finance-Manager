import { AppState, CashAccount, BankCard, Income, Expense, Debt, Transaction, AppNotification } from './types';

export const INITIAL_CASH_ACCOUNTS: CashAccount[] = [];
export const INITIAL_CARDS: BankCard[] = [];
export const INITIAL_INCOMES: Income[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_DEBTS: Debt[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const DEFAULT_APP_STATE: AppState = {
  cashAccounts: INITIAL_CASH_ACCOUNTS,
  cards: INITIAL_CARDS,
  incomes: INITIAL_INCOMES,
  expenses: INITIAL_EXPENSES,
  debts: INITIAL_DEBTS,
  transactions: INITIAL_TRANSACTIONS,
  notifications: INITIAL_NOTIFICATIONS,
  pinCode: '',
  pinEnabled: false,
  currency: 'Rs.',
};
