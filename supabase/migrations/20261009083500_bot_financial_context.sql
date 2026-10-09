-- Migration: 20261009083500_bot_financial_context.sql
-- Fungsi get_bot_financial_context: Menyediakan snapshot data finansial lengkap secara real-time
-- untuk digunakan oleh AI Gemini sebagai asisten keuangan cerdas & fleksibel.

CREATE OR REPLACE FUNCTION public.get_bot_financial_context(
  p_chat_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_current_month text;
  v_month_label text;
  v_wallets jsonb := '[]'::jsonb;
  v_total_balance bigint := 0;
  v_budgets jsonb := '[]'::jsonb;
  v_total_budget_limit bigint := 0;
  v_total_budget_spent bigint := 0;
  v_total_debt bigint := 0;
  v_total_receivable bigint := 0;
  v_debts_list jsonb := '[]'::jsonb;
  v_spent_today bigint := 0;
  v_income_today bigint := 0;
  r record;
BEGIN
  -- 1. Verifikasi Chat ID pengguna
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_current_month := to_char(v_today, 'YYYY-MM');
  v_month_label := to_char(v_today, 'Mon YYYY');

  -- 2. Ambil data dompet & saldo aktif
  FOR r IN
    SELECT name, COALESCE(current_balance, 0) AS balance
    FROM public.v_wallet_balances
    WHERE user_id = v_user_id AND is_archived = false
    ORDER BY created_at ASC
  LOOP
    v_total_balance := v_total_balance + r.balance;
    v_wallets := v_wallets || jsonb_build_object(
      'name', r.name,
      'balance', r.balance
    );
  END LOOP;

  -- 3. Ambil data anggaran bulan ini
  FOR r IN
    SELECT 
      c.name AS category_name,
      b.limit_amount,
      COALESCE(s.spent, 0) AS spent
    FROM public.budgets b
    JOIN public.expense_categories c ON c.id = b.category_id
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS spent
      FROM public.transactions
      WHERE user_id = v_user_id
        AND type = 'expense'
        AND to_char(date, 'YYYY-MM') = v_current_month
      GROUP BY category_id
    ) s ON s.category_id = b.category_id
    WHERE b.user_id = v_user_id
      AND b.month_year = v_current_month
    ORDER BY c.name ASC
  LOOP
    v_total_budget_limit := v_total_budget_limit + r.limit_amount;
    v_total_budget_spent := v_total_budget_spent + r.spent;
    v_budgets := v_budgets || jsonb_build_object(
      'category', r.category_name,
      'limit', r.limit_amount,
      'spent', r.spent,
      'remaining', (r.limit_amount - r.spent),
      'pct', CASE WHEN r.limit_amount > 0 THEN ROUND((r.spent::numeric / r.limit_amount::numeric) * 100) ELSE 0 END
    );
  END LOOP;

  -- 4. Ambil data utang & piutang aktif
  FOR r IN
    SELECT type, person_name, amount, due_date
    FROM public.debts
    WHERE user_id = v_user_id AND is_settled = false
    ORDER BY created_at DESC
  LOOP
    IF r.type = 'debt' THEN
      v_total_debt := v_total_debt + r.amount;
    ELSE
      v_total_receivable := v_total_receivable + r.amount;
    END IF;

    v_debts_list := v_debts_list || jsonb_build_object(
      'type', r.type,
      'person', r.person_name,
      'amount', r.amount,
      'due_date', r.due_date
    );
  END LOOP;

  -- 5. Pengeluaran & pemasukan hari ini
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
  INTO v_spent_today, v_income_today
  FROM public.transactions
  WHERE user_id = v_user_id AND date = v_today;

  RETURN jsonb_build_object(
    'success', true,
    'today', v_today::text,
    'month_label', v_month_label,
    'total_balance', v_total_balance,
    'wallets', v_wallets,
    'total_budget_limit', v_total_budget_limit,
    'total_budget_spent', v_total_budget_spent,
    'total_budget_remaining', (v_total_budget_limit - v_total_budget_spent),
    'budgets', v_budgets,
    'total_debt', v_total_debt,
    'total_receivable', v_total_receivable,
    'debts', v_debts_list,
    'spent_today', v_spent_today,
    'income_today', v_income_today
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bot_financial_context TO anon, authenticated, service_role;
