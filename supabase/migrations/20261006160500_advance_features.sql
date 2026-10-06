-- Migration: 20261006160500_advance_features.sql
-- Fitur Tahap 2: Anggaran, Tabungan, Utang & Piutang, Tagihan Wajib, Transaksi Rutin, RPC pay_bill, dan View Bulanan

-- 1. TABEL: budgets (Anggaran Bulanan per Kategori)
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format YYYY-MM
  limit_amount bigint NOT NULL CHECK (limit_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_category_month UNIQUE (user_id, category_id, month_year)
);

-- 2. TABEL: savings_goals (Target Tabungan)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount bigint NOT NULL CHECK (target_amount > 0),
  current_amount bigint NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date date,
  is_achieved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TABEL: debts (Utang & Piutang)
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('debt', 'receivable')),
  person_name text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  due_date date,
  is_settled boolean NOT NULL DEFAULT false,
  settled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. TABEL: bills (Tagihan Wajib)
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  interval_months integer NOT NULL DEFAULT 1 CHECK (interval_months >= 1),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  next_due_date date NOT NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  remind_days_before integer NOT NULL DEFAULT 3 CHECK (remind_days_before >= 0),
  last_reminded_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TABEL: bill_payments (Riwayat Pembayaran Tagihan)
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_bill_due_date UNIQUE (bill_id, due_date)
);

-- 6. TABEL: recurring_rules (Transaksi Rutin / Langganan)
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  amount bigint NOT NULL CHECK (amount > 0),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.income_sources(id) ON DELETE SET NULL,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),
  notes text,
  last_prompt_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES
-- budgets
CREATE POLICY "budgets_all" ON public.budgets FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- savings_goals
CREATE POLICY "savings_all" ON public.savings_goals FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- debts
CREATE POLICY "debts_all" ON public.debts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- bills
CREATE POLICY "bills_all" ON public.bills FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- bill_payments
CREATE POLICY "bill_payments_all" ON public.bill_payments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- recurring_rules
CREATE POLICY "recurring_rules_all" ON public.recurring_rules FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 9. FUNGSI DATABASE ATOMIK: pay_bill
CREATE OR REPLACE FUNCTION public.pay_bill(
  p_bill_id uuid,
  p_amount bigint,
  p_wallet_id uuid,
  p_category_id uuid,
  p_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_tx_id uuid;
  v_target_month date;
  v_next_date date;
  v_max_day integer;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tagihan tidak ditemukan';
  END IF;

  -- 1. Buat transaksi pengeluaran
  INSERT INTO public.transactions (user_id, type, amount, wallet_id, category_id, date, notes)
  VALUES (auth.uid(), 'expense', p_amount, p_wallet_id, p_category_id, p_date, p_notes)
  RETURNING id INTO v_tx_id;

  -- 2. Catat bukti pembayaran tagihan
  INSERT INTO public.bill_payments (user_id, bill_id, due_date, transaction_id, paid_at)
  VALUES (auth.uid(), p_bill_id, v_bill.next_due_date, v_tx_id, now());

  -- 3. Geser next_due_date ke bulan berikutnya dengan batas akhir hari bulan tujuan
  v_target_month := (date_trunc('month', v_bill.next_due_date) + (v_bill.interval_months || ' month')::interval)::date;
  v_max_day := EXTRACT(DAY FROM (date_trunc('month', v_target_month) + interval '1 month - 1 day'))::integer;
  v_next_date := v_target_month + (LEAST(v_bill.due_day, v_max_day) - 1) * interval '1 day';

  UPDATE public.bills 
  SET next_due_date = v_next_date
  WHERE id = p_bill_id;

  RETURN v_tx_id;
END;
$$;

-- 10. VIEW: v_monthly_expenses_by_category (SECURITY_INVOKER = TRUE)
-- Menggabungkan pengeluaran langsung dan biaya admin transfer yang dialokasikan ke kategori 'Biaya admin'
CREATE OR REPLACE VIEW public.v_monthly_expenses_by_category
WITH (security_invoker = true) AS
SELECT 
  t.user_id,
  to_char(t.date, 'YYYY-MM') AS month_year,
  COALESCE(t.category_id, admin_cat.id) AS category_id,
  COALESCE(cat.name, 'Biaya admin') AS category_name,
  SUM(
    CASE 
      WHEN t.type = 'expense' THEN t.amount 
      WHEN t.type = 'transfer' THEN t.admin_fee 
      ELSE 0 
    END
  ) AS total_expense
FROM public.transactions t
LEFT JOIN public.expense_categories cat ON cat.id = t.category_id
LEFT JOIN LATERAL (
  SELECT id FROM public.expense_categories 
  WHERE user_id = t.user_id AND name = 'Biaya admin' 
  LIMIT 1
) admin_cat ON true
WHERE 
  (t.type = 'expense') 
  OR (t.type = 'transfer' AND t.admin_fee > 0)
GROUP BY 
  t.user_id,
  to_char(t.date, 'YYYY-MM'),
  COALESCE(t.category_id, admin_cat.id),
  COALESCE(cat.name, 'Biaya admin');

-- 11. VIEW: v_monthly_income_by_source (SECURITY_INVOKER = TRUE)
CREATE OR REPLACE VIEW public.v_monthly_income_by_source
WITH (security_invoker = true) AS
SELECT 
  t.user_id,
  to_char(t.date, 'YYYY-MM') AS month_year,
  t.source_id,
  src.name AS source_name,
  SUM(t.amount) AS total_income
FROM public.transactions t
LEFT JOIN public.income_sources src ON src.id = t.source_id
WHERE t.type = 'income'
GROUP BY 
  t.user_id,
  to_char(t.date, 'YYYY-MM'),
  t.source_id,
  src.name;
