export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  initial_balance: number;
  is_archived: boolean;
  created_at: string;
}

export interface WalletWithBalance extends Wallet {
  current_balance: number;
}

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
  is_daily_routine: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface AppSettings {
  user_id: string;
  telegram_chat_id: string | null;
  telegram_secret_token: string | null;
  email: string | null;
  reminder_time: string;
  skip_days: number[];
  last_reminder_date: string | null;
  default_wallet_id: string | null;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  wallet_id: string;
  destination_wallet_id: string | null;
  admin_fee: number;
  source_id: string | null;
  category_id: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  // Relational joins
  wallet?: { name: string };
  destination_wallet?: { name: string };
  source?: { name: string };
  category?: { name: string };
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month_year: string;
  limit_amount: number;
  created_at: string;
  category?: { name: string };
}

export interface CategoryExpenseSummary {
  category_id: string;
  category_name: string;
  month_year: string;
  total_expense: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  is_achieved: boolean;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  type: 'debt' | 'receivable';
  person_name: string;
  amount: number;
  due_date: string | null;
  is_settled: boolean;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  interval_months: number;
  due_day: number;
  next_due_date: string;
  wallet_id: string | null;
  category_id: string | null;
  is_active: boolean;
  remind_days_before: number;
  last_reminded_date: string | null;
  created_at: string;
  wallet?: { name: string };
  category?: { name: string };
}

export interface BillPayment {
  id: string;
  user_id: string;
  bill_id: string;
  due_date: string;
  transaction_id: string | null;
  paid_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  frequency: 'daily' | 'weekly' | 'monthly';
  amount: number;
  wallet_id: string;
  category_id: string | null;
  source_id: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  notes: string | null;
  last_prompt_date: string | null;
  is_active: boolean;
  created_at: string;
  wallet?: { name: string };
  category?: { name: string };
  source?: { name: string };
}

export interface MonthlySummary {
  month_year: string;
  total_income: number;
  total_expense: number;
  net_diff: number;
}

export interface IncomeSourceSummary {
  source_id: string;
  source_name: string;
  month_year: string;
  total_income: number;
}


