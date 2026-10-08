-- Migration: 20261009020000_bot_budget_alerts.sql
-- 1. Fungsi get_bot_budget_summary: cek sisa & persentase anggaran bulanan via Bot Telegram
-- 2. Update create_transaction_from_bot: sematkan peringatan otomatis (Budget Alert) jika pemakaian >= 80% atau overbudget

-- 1. FUNGSI RPC: get_bot_budget_summary
CREATE OR REPLACE FUNCTION public.get_bot_budget_summary(
  p_chat_id text,
  p_category_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_current_month text;
  v_month_label text;
  v_reply text := '';
  v_count integer := 0;
  v_total_budget bigint := 0;
  v_total_spent bigint := 0;
  r record;
BEGIN
  -- 1. Verifikasi Chat ID pengguna
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Chat ID Telegram tidak terdaftar atau belum dihubungkan ke akun.'
    );
  END IF;

  v_current_month := to_char((now() AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM');
  v_month_label := to_char((now() AT TIME ZONE 'Asia/Jakarta'), 'Mon YYYY');

  v_reply := '📊 Status Anggaran Bulan Ini (' || v_month_label || ')' || E'\n\n';

  -- 2. Ambil data anggaran aktif bulan ini beserta realisasi pengeluarannya
  FOR r IN
    SELECT 
      b.id,
      b.limit_amount,
      c.name AS category_name,
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
      AND (
        p_category_name IS NULL
        OR lower(c.name) LIKE '%' || lower(trim(p_category_name)) || '%'
        OR lower(trim(p_category_name)) LIKE '%' || lower(c.name) || '%'
      )
    ORDER BY c.name ASC
  LOOP
    v_count := v_count + 1;
    v_total_budget := v_total_budget + r.limit_amount;
    v_total_spent := v_total_spent + r.spent;

    DECLARE
      v_pct integer := CASE WHEN r.limit_amount > 0 THEN ROUND((r.spent::numeric / r.limit_amount::numeric) * 100) ELSE 0 END;
      v_rem bigint := r.limit_amount - r.spent;
      v_indicator text := CASE 
        WHEN v_pct >= 100 THEN '🚨' 
        WHEN v_pct >= 80 THEN '⚠️' 
        ELSE '🟢' 
      END;
    BEGIN
      v_reply := v_reply || v_indicator || ' ' || r.category_name || ': Rp ' ||
                 to_char(r.spent, 'FM999,999,999,999') || ' / Rp ' ||
                 to_char(r.limit_amount, 'FM999,999,999,999') || ' (' || v_pct || '%)' || E'\n' ||
                 '   ' || (CASE WHEN v_rem >= 0 THEN 'Sisa: Rp ' || to_char(v_rem, 'FM999,999,999,999') ELSE 'Overbudget: Rp ' || to_char(abs(v_rem), 'FM999,999,999,999') END) || E'\n\n';
    END;
  END LOOP;

  -- 3. Format respon jika tidak ada anggaran atau rangkuman total
  IF v_count = 0 THEN
    IF p_category_name IS NOT NULL THEN
      v_reply := 'Tidak ditemukan anggaran untuk kategori "' || p_category_name || '" pada bulan ' || v_month_label || '.';
    ELSE
      v_reply := 'Belum ada anggaran yang disetel untuk bulan ' || v_month_label || '.' || E'\n\n' ||
                 'Kamu dapat mengatur anggaran per kategori di menu Anggaran pada aplikasi web.';
    END IF;
  ELSE
    DECLARE
      v_overall_pct integer := CASE WHEN v_total_budget > 0 THEN ROUND((v_total_spent::numeric / v_total_budget::numeric) * 100) ELSE 0 END;
    BEGIN
      v_reply := v_reply || '• Total Terpakai: Rp ' || to_char(v_total_spent, 'FM999,999,999,999') ||
                 ' dari Rp ' || to_char(v_total_budget, 'FM999,999,999,999') || ' (' || v_overall_pct || '%)';
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'total_budget', v_total_budget,
    'total_spent', v_total_spent,
    'reply_message', trim(v_reply)
  );
END;
$$;

-- 2. PERBARUI create_transaction_from_bot AGAR MENYERTAKAN BUDGET ALERT OTOMATIS
CREATE OR REPLACE FUNCTION public.create_transaction_from_bot(
  p_chat_id text,
  p_type text,
  p_amount bigint,
  p_wallet_name text DEFAULT NULL,
  p_category_or_source text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
  v_wallet_actual_name text;
  v_category_id uuid;
  v_source_id uuid;
  v_category_actual_name text;
  v_source_actual_name text;
  v_tx_id uuid;
  v_new_balance bigint;
  v_tx_date date;
  v_reply text;
  v_formatted_amount text;
  v_formatted_balance text;
  v_month_key text;
  v_limit_amount bigint;
  v_total_spent bigint;
  v_budget_pct integer;
BEGIN
  -- 1. Verifikasi Chat ID pengguna
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Chat ID Telegram tidak terdaftar atau belum dihubungkan ke akun.'
    );
  END IF;

  -- 2. Validasi nominal dan jenis transaksi
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nominal transaksi harus lebih dari 0.'
    );
  END IF;

  IF p_type NOT IN ('expense', 'income') THEN
    p_type := 'expense';
  END IF;

  v_tx_date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_month_key := to_char(v_tx_date, 'YYYY-MM');

  -- 3. Cari Dompet (Pencocokan nama yang fleksibel / case-insensitive)
  IF p_wallet_name IS NOT NULL AND trim(p_wallet_name) <> '' THEN
    IF lower(trim(p_wallet_name)) IN ('tunai', 'cash', 'uang tunai', 'laci') THEN
      SELECT id, name INTO v_wallet_id, v_wallet_actual_name
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
        AND lower(name) IN ('dompet', 'tunai', 'cash')
      LIMIT 1;
    END IF;

    IF v_wallet_id IS NULL THEN
      SELECT id, name INTO v_wallet_id, v_wallet_actual_name
      FROM public.wallets
      WHERE user_id = v_user_id
        AND is_archived = false
        AND (
          lower(name) = lower(trim(p_wallet_name))
          OR lower(name) LIKE '%' || lower(trim(p_wallet_name)) || '%'
          OR lower(trim(p_wallet_name)) LIKE '%' || lower(name) || '%'
        )
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Jika dompet tidak ditentukan, utamakan 'Dompet' (uang tunai)
  IF v_wallet_id IS NULL THEN
    SELECT id, name INTO v_wallet_id, v_wallet_actual_name
    FROM public.wallets
    WHERE user_id = v_user_id AND is_archived = false
      AND lower(name) IN ('dompet', 'tunai', 'cash')
    LIMIT 1;

    -- Jika tidak ada, baru pilih dompet aktif pertama
    IF v_wallet_id IS NULL THEN
      SELECT id, name INTO v_wallet_id, v_wallet_actual_name
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tidak ada dompet aktif yang ditemukan.'
    );
  END IF;

  -- 4. Cari Kategori Pengeluaran atau Sumber Pemasukan
  IF p_type = 'expense' THEN
    IF p_category_or_source IS NOT NULL AND trim(p_category_or_source) <> '' THEN
      SELECT id, name INTO v_category_id, v_category_actual_name
      FROM public.expense_categories
      WHERE user_id = v_user_id
        AND is_archived = false
        AND (
          lower(name) = lower(trim(p_category_or_source))
          OR lower(name) LIKE '%' || lower(trim(p_category_or_source)) || '%'
          OR lower(trim(p_category_or_source)) LIKE '%' || lower(name) || '%'
        )
      LIMIT 1;
    END IF;

    -- Fallback kategori jika tidak cocok: cari 'Makan/jajan', 'Kebutuhan', atau pertama
    IF v_category_id IS NULL THEN
      SELECT id, name INTO v_category_id, v_category_actual_name
      FROM public.expense_categories
      WHERE user_id = v_user_id AND is_archived = false
      ORDER BY (CASE WHEN name ILIKE '%makan%' THEN 1 WHEN name ILIKE '%kebutuhan%' THEN 2 ELSE 3 END), created_at ASC
      LIMIT 1;
    END IF;
  ELSE
    -- Pemasukan
    IF p_category_or_source IS NOT NULL AND trim(p_category_or_source) <> '' THEN
      SELECT id, name INTO v_source_id, v_source_actual_name
      FROM public.income_sources
      WHERE user_id = v_user_id
        AND is_archived = false
        AND (
          lower(name) = lower(trim(p_category_or_source))
          OR lower(name) LIKE '%' || lower(trim(p_category_or_source)) || '%'
          OR lower(trim(p_category_or_source)) LIKE '%' || lower(name) || '%'
        )
      LIMIT 1;
    END IF;

    IF v_source_id IS NULL THEN
      SELECT id, name INTO v_source_id, v_source_actual_name
      FROM public.income_sources
      WHERE user_id = v_user_id AND is_archived = false
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  -- 5. Masukkan Transaksi ke Tabel
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    wallet_id,
    category_id,
    source_id,
    date,
    notes
  )
  VALUES (
    v_user_id,
    p_type,
    p_amount,
    v_wallet_id,
    v_category_id,
    v_source_id,
    v_tx_date,
    p_notes
  )
  RETURNING id INTO v_tx_id;

  -- 6. Dapatkan Saldo Terkini Dompet
  SELECT current_balance INTO v_new_balance
  FROM public.v_wallet_balances
  WHERE id = v_wallet_id;

  v_formatted_amount := to_char(p_amount, 'FM999,999,999,999');
  v_formatted_balance := to_char(COALESCE(v_new_balance, 0), 'FM999,999,999,999');

  -- 7. Susun Pesan Balasan Telegram yang Rapi
  IF p_type = 'expense' THEN
    v_reply := 'Transaksi Berhasil Dicatat' || E'\n\n' ||
               '• Jenis: Pengeluaran' || E'\n' ||
               '• Kategori: ' || COALESCE(v_category_actual_name, '-') || E'\n' ||
               '• Nominal: Rp ' || v_formatted_amount || E'\n' ||
               '• Dompet: ' || v_wallet_actual_name || E'\n' ||
               CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN '• Catatan: ' || p_notes || E'\n' ELSE '' END ||
               '• Tanggal: ' || v_tx_date::text || E'\n\n' ||
               'Sisa Saldo ' || v_wallet_actual_name || ': Rp ' || v_formatted_balance;

    -- 8. Pemeriksaan Budget Alert Otomatis jika kategori memiliki Anggaran aktif
    IF v_category_id IS NOT NULL THEN
      SELECT limit_amount INTO v_limit_amount
      FROM public.budgets
      WHERE user_id = v_user_id
        AND category_id = v_category_id
        AND month_year = v_month_key
      LIMIT 1;

      IF v_limit_amount IS NOT NULL AND v_limit_amount > 0 THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_spent
        FROM public.transactions
        WHERE user_id = v_user_id
          AND type = 'expense'
          AND category_id = v_category_id
          AND to_char(date, 'YYYY-MM') = v_month_key;

        v_budget_pct := ROUND((v_total_spent::numeric / v_limit_amount::numeric) * 100);

        IF v_total_spent > v_limit_amount THEN
          v_reply := v_reply || E'\n\n' ||
                     '🚨 Peringatan Overbudget: Anggaran ' || v_category_actual_name ||
                     ' telah melebihi batas (' || v_budget_pct || '%)!' || E'\n' ||
                     'Terpakai Rp ' || to_char(v_total_spent, 'FM999,999,999,999') ||
                     ' dari limit Rp ' || to_char(v_limit_amount, 'FM999,999,999,999') || '.';
        ELSIF v_budget_pct >= 80 THEN
          v_reply := v_reply || E'\n\n' ||
                     '⚠️ Perhatian Anggaran: ' || v_category_actual_name ||
                     ' sudah terpakai ' || v_budget_pct || '% (Rp ' || to_char(v_total_spent, 'FM999,999,999,999') ||
                     ' / Rp ' || to_char(v_limit_amount, 'FM999,999,999,999') || '). Sisa Rp ' ||
                     to_char(v_limit_amount - v_total_spent, 'FM999,999,999,999') || '.';
        END IF;
      END IF;
    END IF;
  ELSE
    v_reply := 'Pemasukan Berhasil Dicatat' || E'\n\n' ||
               '• Jenis: Pemasukan' || E'\n' ||
               '• Sumber: ' || COALESCE(v_source_actual_name, '-') || E'\n' ||
               '• Nominal: + Rp ' || v_formatted_amount || E'\n' ||
               '• Dompet: ' || v_wallet_actual_name || E'\n' ||
               CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN '• Catatan: ' || p_notes || E'\n' ELSE '' END ||
               '• Tanggal: ' || v_tx_date::text || E'\n\n' ||
               'Total Saldo ' || v_wallet_actual_name || ': Rp ' || v_formatted_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'type', p_type,
    'amount', p_amount,
    'wallet_name', v_wallet_actual_name,
    'category_or_source', COALESCE(v_category_actual_name, v_source_actual_name),
    'notes', p_notes,
    'date', v_tx_date,
    'current_balance', v_new_balance,
    'reply_message', v_reply
  );
END;
$$;
