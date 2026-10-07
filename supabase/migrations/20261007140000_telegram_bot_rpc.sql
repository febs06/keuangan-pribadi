-- Migration: 20261007140000_telegram_bot_rpc.sql
-- Integrasi Bot Telegram & n8n:
-- 1. Menghubungkan telegram_chat_id pengguna ke app_settings
-- 2. Fungsi RPC create_transaction_from_bot untuk mencatat transaksi dari hasil baca struk/teks Gemini
-- 3. Fungsi RPC get_bot_balance_summary untuk pengecekan saldo instan dari Telegram

-- Hubungkan Chat ID pengguna ke app_settings untuk akun nsiti3610@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nsiti3610@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.app_settings (user_id, telegram_chat_id, updated_at)
    VALUES (v_user_id, '2037807600', now())
    ON CONFLICT (user_id) DO UPDATE
    SET telegram_chat_id = '2037807600', updated_at = now();
  END IF;
END $$;

-- 1. FUNGSI RPC: create_transaction_from_bot
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

  -- Jika dompet tidak ditemukan atau null, pilih dompet pertama yang aktif
  IF v_wallet_id IS NULL THEN
    SELECT id, name INTO v_wallet_id, v_wallet_actual_name
    FROM public.wallets
    WHERE user_id = v_user_id AND is_archived = false
    ORDER BY created_at ASC
    LIMIT 1;
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

    -- Fallback sumber
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

-- 2. FUNGSI RPC: get_bot_balance_summary (Untuk Perintah /saldo)
CREATE OR REPLACE FUNCTION public.get_bot_balance_summary(p_chat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_total bigint := 0;
  v_wallets_text text := '';
  r record;
  v_reply text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Chat ID Telegram belum terdaftar.'
    );
  END IF;

  FOR r IN
    SELECT name, current_balance
    FROM public.v_wallet_balances
    WHERE user_id = v_user_id AND is_archived = false
    ORDER BY name ASC
  LOOP
    v_total := v_total + COALESCE(r.current_balance, 0);
    v_wallets_text := v_wallets_text || '• ' || r.name || ': Rp ' || to_char(COALESCE(r.current_balance, 0), 'FM999,999,999,999') || E'\n';
  END LOOP;

  v_reply := 'Ringkasan Saldo Anda:' || E'\n\n' ||
             v_wallets_text || E'\n' ||
             'Total Saldo Aktif: Rp ' || to_char(v_total, 'FM999,999,999,999');

  RETURN jsonb_build_object(
    'success', true,
    'total_balance', v_total,
    'reply_message', v_reply
  );
END;
$$;

-- Berikan izin akses eksekusi RPC ke anon dan authenticated
GRANT EXECUTE ON FUNCTION public.create_transaction_from_bot TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bot_balance_summary TO anon, authenticated, service_role;
