-- Migration: 20261007150000_bot_corrections.sql
-- 1. Update create_transaction_from_bot: prioritaskan 'Dompet'/'Tunai' jika dompet tidak disebutkan
-- 2. Fungsi correct_last_transaction_from_bot: koreksi dompet/nominal transaksi terakhir
-- 3. Fungsi delete_last_transaction_from_bot: batalkan/hapus transaksi terakhir

-- 1. Perbarui create_transaction_from_bot
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
      'error', 'Belum ada dompet aktif yang dapat digunakan.'
    );
  END IF;

  -- 4. Cari Kategori (Pengeluaran) atau Sumber (Pemasukan)
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

-- 2. FUNGSI RPC: correct_last_transaction_from_bot
CREATE OR REPLACE FUNCTION public.correct_last_transaction_from_bot(
  p_chat_id text,
  p_new_wallet_name text DEFAULT NULL,
  p_new_amount bigint DEFAULT NULL,
  p_new_category text DEFAULT NULL,
  p_new_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_last_tx record;
  v_old_wallet_name text;
  v_new_wallet_id uuid;
  v_new_wallet_name text;
  v_old_wallet_balance bigint;
  v_new_wallet_balance bigint;
  v_formatted_amount text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  SELECT t.*, w.name as wallet_name
  INTO v_last_tx
  FROM public.transactions t
  JOIN public.wallets w ON t.wallet_id = w.id
  WHERE t.user_id = v_user_id
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_last_tx.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Belum ada transaksi yang dapat dikoreksi.');
  END IF;

  v_old_wallet_name := v_last_tx.wallet_name;

  -- Koreksi dompet
  IF p_new_wallet_name IS NOT NULL AND trim(p_new_wallet_name) <> '' THEN
    IF lower(trim(p_new_wallet_name)) IN ('tunai', 'cash', 'uang tunai', 'laci') THEN
      SELECT id, name INTO v_new_wallet_id, v_new_wallet_name
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
        AND lower(name) IN ('dompet', 'tunai', 'cash')
      LIMIT 1;
    END IF;

    IF v_new_wallet_id IS NULL THEN
      SELECT id, name INTO v_new_wallet_id, v_new_wallet_name
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
        AND (
          lower(name) = lower(trim(p_new_wallet_name))
          OR lower(name) LIKE '%' || lower(trim(p_new_wallet_name)) || '%'
          OR lower(trim(p_new_wallet_name)) LIKE '%' || lower(name) || '%'
        )
      LIMIT 1;
    END IF;

    IF v_new_wallet_id IS NOT NULL THEN
      UPDATE public.transactions
      SET wallet_id = v_new_wallet_id
      WHERE id = v_last_tx.id;
    END IF;
  END IF;

  -- Koreksi nominal
  IF p_new_amount IS NOT NULL AND p_new_amount > 0 THEN
    UPDATE public.transactions
    SET amount = p_new_amount
    WHERE id = v_last_tx.id;
  END IF;

  -- Koreksi catatan
  IF p_new_notes IS NOT NULL AND trim(p_new_notes) <> '' THEN
    UPDATE public.transactions
    SET notes = p_new_notes
    WHERE id = v_last_tx.id;
  END IF;

  -- Ambil saldo terkini
  SELECT current_balance INTO v_old_wallet_balance
  FROM public.v_wallet_balances WHERE id = v_last_tx.wallet_id;

  IF v_new_wallet_id IS NOT NULL AND v_new_wallet_id <> v_last_tx.wallet_id THEN
    SELECT current_balance INTO v_new_wallet_balance
    FROM public.v_wallet_balances WHERE id = v_new_wallet_id;
  ELSE
    v_new_wallet_name := v_old_wallet_name;
    v_new_wallet_balance := v_old_wallet_balance;
  END IF;

  v_formatted_amount := to_char(COALESCE(p_new_amount, v_last_tx.amount), 'FM999,999,999,999');

  RETURN jsonb_build_object(
    'success', true,
    'reply_message', 'Transaksi Terakhir Berhasil Dikoreksi' || E'\n\n' ||
      '• Catatan: ' || COALESCE(v_last_tx.notes, '-') || E'\n' ||
      '• Nominal: Rp ' || v_formatted_amount || E'\n' ||
      '• Dompet: ' || v_old_wallet_name || ' ➔ ' || v_new_wallet_name || E'\n\n' ||
      'Sisa Saldo ' || v_old_wallet_name || ': Rp ' || to_char(COALESCE(v_old_wallet_balance, 0), 'FM999,999,999,999') || E'\n' ||
      'Sisa Saldo ' || v_new_wallet_name || ': Rp ' || to_char(COALESCE(v_new_wallet_balance, 0), 'FM999,999,999,999')
  );
END;
$$;

-- 3. FUNGSI RPC: delete_last_transaction_from_bot
CREATE OR REPLACE FUNCTION public.delete_last_transaction_from_bot(p_chat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_last_tx record;
  v_wallet_balance bigint;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  SELECT t.*, w.name as wallet_name
  INTO v_last_tx
  FROM public.transactions t
  JOIN public.wallets w ON t.wallet_id = w.id
  WHERE t.user_id = v_user_id
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_last_tx.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Belum ada transaksi yang dapat dibatalkan.');
  END IF;

  DELETE FROM public.transactions WHERE id = v_last_tx.id;

  SELECT current_balance INTO v_wallet_balance
  FROM public.v_wallet_balances WHERE id = v_last_tx.wallet_id;

  RETURN jsonb_build_object(
    'success', true,
    'reply_message', 'Transaksi Terakhir Dibatalkan / Dihapus' || E'\n\n' ||
      '• Catatan: ' || COALESCE(v_last_tx.notes, '-') || E'\n' ||
      '• Nominal: Rp ' || to_char(v_last_tx.amount, 'FM999,999,999,999') || E'\n' ||
      '• Dompet: ' || v_last_tx.wallet_name || E'\n\n' ||
      'Saldo ' || v_last_tx.wallet_name || ' sekarang: Rp ' || to_char(COALESCE(v_wallet_balance, 0), 'FM999,999,999,999')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transaction_from_bot TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_last_transaction_from_bot TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_last_transaction_from_bot TO anon, authenticated, service_role;
