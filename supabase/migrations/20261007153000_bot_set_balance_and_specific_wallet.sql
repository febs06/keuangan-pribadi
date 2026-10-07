-- Migration: 20261007153000_bot_set_balance_and_specific_wallet.sql
-- 1. Dukungan set_wallet_balance_from_bot (mengatur saldo dompet tertentu)
-- 2. get_bot_balance_summary mendukung filter p_wallet_name spesifik (misal: "cek dompet dong")

-- 1. FUNGSI RPC: set_wallet_balance_from_bot
CREATE OR REPLACE FUNCTION public.set_wallet_balance_from_bot(
  p_chat_id text,
  p_wallet_name text,
  p_target_balance bigint
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
  v_current_balance bigint;
  v_current_initial bigint;
  v_delta bigint;
  v_new_initial bigint;
  v_total_balance bigint := 0;
  v_formatted_target text;
  v_reply text;
  r record;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  IF p_target_balance IS NULL OR p_target_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nominal saldo tidak valid.');
  END IF;

  -- Cari dompet berdasarkan nama fleksibel
  IF p_wallet_name IS NOT NULL AND trim(p_wallet_name) <> '' THEN
    IF lower(trim(p_wallet_name)) IN ('tunai', 'cash', 'uang tunai', 'laci') THEN
      SELECT id, name, initial_balance INTO v_wallet_id, v_wallet_actual_name, v_current_initial
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
        AND lower(name) IN ('dompet', 'tunai', 'cash')
      LIMIT 1;
    END IF;

    IF v_wallet_id IS NULL THEN
      SELECT id, name, initial_balance INTO v_wallet_id, v_wallet_actual_name, v_current_initial
      FROM public.wallets
      WHERE user_id = v_user_id AND is_archived = false
        AND (
          lower(name) = lower(trim(p_wallet_name))
          OR lower(name) LIKE '%' || lower(trim(p_wallet_name)) || '%'
          OR lower(trim(p_wallet_name)) LIKE '%' || lower(name) || '%'
        )
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dompet tidak ditemukan.');
  END IF;

  -- Ambil saldo saat ini
  SELECT COALESCE(current_balance, 0) INTO v_current_balance
  FROM public.v_wallet_balances
  WHERE id = v_wallet_id;

  -- Delta transaksi yang sudah ada
  v_delta := v_current_balance - COALESCE(v_current_initial, 0);

  -- Hitung saldo awal baru agar current_balance pas dengan p_target_balance
  v_new_initial := p_target_balance - v_delta;

  UPDATE public.wallets
  SET initial_balance = v_new_initial
  WHERE id = v_wallet_id;

  -- Hitung total saldo semua dompet aktif
  FOR r IN
    SELECT current_balance FROM public.v_wallet_balances
    WHERE user_id = v_user_id AND is_archived = false
  LOOP
    v_total_balance := v_total_balance + COALESCE(r.current_balance, 0);
  END LOOP;

  v_formatted_target := to_char(p_target_balance, 'FM999,999,999,999');

  v_reply := 'Saldo ' || v_wallet_actual_name || ' Berhasil Diperbarui' || E'\n\n' ||
             '• Saldo ' || v_wallet_actual_name || ': Rp ' || v_formatted_target || E'\n' ||
             '• Total Saldo Aktif: Rp ' || to_char(v_total_balance, 'FM999,999,999,999');

  RETURN jsonb_build_object(
    'success', true,
    'wallet_name', v_wallet_actual_name,
    'new_balance', p_target_balance,
    'total_balance', v_total_balance,
    'reply_message', v_reply
  );
END;
$$;

-- Drop versi lama agar tidak bentrok dengan overload baru
DROP FUNCTION IF EXISTS public.get_bot_balance_summary(text);

-- 2. FUNGSI RPC: get_bot_balance_summary (Diperbarui dengan parameter opsional p_wallet_name)
CREATE OR REPLACE FUNCTION public.get_bot_balance_summary(
  p_chat_id text,
  p_wallet_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_total bigint := 0;
  v_wallets_text text := '';
  v_specific_found boolean := false;
  v_specific_name text;
  v_specific_balance bigint;
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

    -- Cocokkan jika mencari dompet tertentu
    IF p_wallet_name IS NOT NULL AND trim(p_wallet_name) <> '' THEN
      IF lower(r.name) = lower(trim(p_wallet_name))
         OR lower(r.name) LIKE '%' || lower(trim(p_wallet_name)) || '%'
         OR (lower(trim(p_wallet_name)) IN ('tunai', 'cash', 'uang tunai', 'laci') AND lower(r.name) = 'dompet') THEN
        v_specific_found := true;
        v_specific_name := r.name;
        v_specific_balance := COALESCE(r.current_balance, 0);
      END IF;
    END IF;
  END LOOP;

  -- Jika user spesifik bertanya dompet tertentu (misal: "cek dompet dong", "saldo bca berapa")
  IF v_specific_found THEN
    v_reply := 'Saldo ' || v_specific_name || ' Anda:' || E'\n\n' ||
               '• ' || v_specific_name || ': Rp ' || to_char(v_specific_balance, 'FM999,999,999,999') || E'\n\n' ||
               'Total Saldo Aktif: Rp ' || to_char(v_total, 'FM999,999,999,999');
  ELSE
    v_reply := 'Ringkasan Saldo Anda:' || E'\n\n' ||
               v_wallets_text || E'\n' ||
               'Total Saldo Aktif: Rp ' || to_char(v_total, 'FM999,999,999,999');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_balance', v_total,
    'reply_message', v_reply
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_wallet_balance_from_bot TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bot_balance_summary TO anon, authenticated, service_role;
