-- Migration: 20261006160000_init_schema.sql
-- Inisialisasi skema dasar: dompet, sumber pemasukan, kategori pengeluaran, pengaturan, transaksi, view saldo, dan seed akun baru.

-- 1. TABEL: wallets (Dompet)
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  initial_balance bigint NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABEL: income_sources (Sumber Pemasukan)
CREATE TABLE IF NOT EXISTS public.income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_daily_routine boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TABEL: expense_categories (Kategori Pengeluaran)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. TABEL: app_settings (Pengaturan Pengguna & Notifikasi)
CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id text,
  telegram_secret_token text,
  email text,
  reminder_time time NOT NULL DEFAULT '20:00:00',
  skip_days integer[] NOT NULL DEFAULT '{}'::integer[],
  last_reminder_date date,
  default_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TABEL: transactions (Transaksi & Transfer)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount bigint NOT NULL CHECK (amount > 0),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  destination_wallet_id uuid REFERENCES public.wallets(id) ON DELETE RESTRICT,
  admin_fee bigint NOT NULL DEFAULT 0 CHECK (admin_fee >= 0),
  source_id uuid REFERENCES public.income_sources(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_transaction_consistency CHECK (
    (type = 'income' AND source_id IS NOT NULL AND category_id IS NULL AND destination_wallet_id IS NULL AND admin_fee = 0)
    OR
    (type = 'expense' AND category_id IS NOT NULL AND source_id IS NULL AND destination_wallet_id IS NULL AND admin_fee = 0)
    OR
    (type = 'transfer' AND destination_wallet_id IS NOT NULL AND destination_wallet_id <> wallet_id AND source_id IS NULL AND category_id IS NULL)
  )
);

-- 6. INDEX UNTUK PERFORMA
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_user ON public.income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON public.expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dest_wallet ON public.transactions(destination_wallet_id);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES
-- wallets
CREATE POLICY "wallets_select" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallets_insert" ON public.wallets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wallets_update" ON public.wallets FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "wallets_delete" ON public.wallets FOR DELETE USING (user_id = auth.uid());

-- income_sources
CREATE POLICY "income_sources_select" ON public.income_sources FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "income_sources_insert" ON public.income_sources FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "income_sources_update" ON public.income_sources FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "income_sources_delete" ON public.income_sources FOR DELETE USING (user_id = auth.uid());

-- expense_categories
CREATE POLICY "expense_categories_select" ON public.expense_categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "expense_categories_insert" ON public.expense_categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "expense_categories_update" ON public.expense_categories FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "expense_categories_delete" ON public.expense_categories FOR DELETE USING (user_id = auth.uid());

-- app_settings
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "app_settings_insert" ON public.app_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- transactions
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE USING (user_id = auth.uid());

-- 9. VIEW: v_wallet_balances (SECURITY_INVOKER = TRUE)
CREATE OR REPLACE VIEW public.v_wallet_balances 
WITH (security_invoker = true) AS
SELECT 
  w.id,
  w.user_id,
  w.name,
  w.is_archived,
  w.initial_balance,
  w.created_at,
  (
    w.initial_balance 
    + COALESCE(inc.total_income, 0) 
    - COALESCE(exp.total_expense, 0) 
    + COALESCE(tr_in.total_transfer_in, 0) 
    - COALESCE(tr_out.total_transfer_out, 0)
  ) AS current_balance
FROM public.wallets w
LEFT JOIN (
  SELECT wallet_id, SUM(amount) AS total_income 
  FROM public.transactions 
  WHERE type = 'income' 
  GROUP BY wallet_id
) inc ON inc.wallet_id = w.id
LEFT JOIN (
  SELECT wallet_id, SUM(amount) AS total_expense 
  FROM public.transactions 
  WHERE type = 'expense' 
  GROUP BY wallet_id
) exp ON exp.wallet_id = w.id
LEFT JOIN (
  SELECT destination_wallet_id AS wallet_id, SUM(amount) AS total_transfer_in 
  FROM public.transactions 
  WHERE type = 'transfer' 
  GROUP BY destination_wallet_id
) tr_in ON tr_in.wallet_id = w.id
LEFT JOIN (
  SELECT wallet_id, SUM(amount + admin_fee) AS total_transfer_out 
  FROM public.transactions 
  WHERE type = 'transfer' 
  GROUP BY wallet_id
) tr_out ON tr_out.wallet_id = w.id;

-- 10. TRIGGER FUNCTION: Seed default untuk user baru
CREATE OR REPLACE FUNCTION public.handle_new_user_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cash_wallet_id uuid;
BEGIN
  -- Dompet bawaan
  INSERT INTO public.wallets (user_id, name, initial_balance, is_archived)
  VALUES (NEW.id, 'Dompet', 0, false)
  RETURNING id INTO v_cash_wallet_id;

  INSERT INTO public.wallets (user_id, name, initial_balance, is_archived) VALUES
    (NEW.id, 'BCA', 0, false),
    (NEW.id, 'Jago', 0, false),
    (NEW.id, 'Dana', 0, false),
    (NEW.id, 'GoPay', 0, true);

  -- Sumber pemasukan bawaan
  INSERT INTO public.income_sources (user_id, name, is_daily_routine, is_archived) VALUES
    (NEW.id, 'Uang jajan', true, false),
    (NEW.id, 'Gaji/honor', false, false),
    (NEW.id, 'Usaha/freelance', false, false),
    (NEW.id, 'Hadiah', false, false),
    (NEW.id, 'Lainnya', false, false);

  -- Kategori pengeluaran bawaan
  INSERT INTO public.expense_categories (user_id, name, is_system, is_archived) VALUES
    (NEW.id, 'Makan/jajan', false, false),
    (NEW.id, 'Transport', false, false),
    (NEW.id, 'Kebutuhan', false, false),
    (NEW.id, 'Tagihan', false, false),
    (NEW.id, 'Hiburan', false, false),
    (NEW.id, 'Biaya admin', true, false),
    (NEW.id, 'Lainnya', false, false);

  -- Inisialisasi baris app_settings
  INSERT INTO public.app_settings (user_id, default_wallet_id)
  VALUES (NEW.id, v_cash_wallet_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger pada auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_seed();
