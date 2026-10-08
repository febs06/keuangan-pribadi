-- Migration: 20261008180000_bot_debts_feature.sql
-- Integrasi Pencatatan Utang & Piutang via Bot Telegram

-- 1. FUNGSI: create_debt_from_bot
CREATE OR REPLACE FUNCTION public.create_debt_from_bot(
  p_chat_id text,
  p_type text, -- 'debt' (utang) atau 'receivable' (piutang)
  p_person_name text,
  p_amount bigint,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_debt_id uuid;
  v_type_normalized text;
  v_formatted_amount text;
  v_reply text;
  v_label text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nominal harus lebih dari 0.');
  END IF;

  IF p_person_name IS NULL OR trim(p_person_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama orang/pihak harus diisi.');
  END IF;

  -- Normalisasi tipe
  IF lower(trim(p_type)) IN ('piutang', 'receivable', 'tagihan', 'meminjamkan') THEN
    v_type_normalized := 'receivable';
    v_label := 'Piutang (Hak Tagih Anda)';
  ELSE
    v_type_normalized := 'debt';
    v_label := 'Utang (Kewajiban Anda)';
  END IF;

  INSERT INTO public.debts (
    user_id,
    type,
    person_name,
    amount,
    due_date,
    notes,
    is_settled
  )
  VALUES (
    v_user_id,
    v_type_normalized,
    trim(p_person_name),
    p_amount,
    p_due_date,
    p_notes,
    false
  )
  RETURNING id INTO v_debt_id;

  v_formatted_amount := to_char(p_amount, 'FM999,999,999,999');

  v_reply := 'Catatan ' || (CASE WHEN v_type_normalized = 'receivable' THEN 'Piutang' ELSE 'Utang' END) || ' Berhasil Disimpan' || E'\n\n' ||
             '• Jenis: ' || v_label || E'\n' ||
             '• Pihak/Nama: ' || trim(p_person_name) || E'\n' ||
             '• Nominal: Rp ' || v_formatted_amount || E'\n' ||
             CASE WHEN p_due_date IS NOT NULL THEN '• Jatuh Tempo: ' || p_due_date::text || E'\n' ELSE '' END ||
             CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN '• Catatan: ' || trim(p_notes) || E'\n' ELSE '' END;

  RETURN jsonb_build_object(
    'success', true,
    'debt_id', v_debt_id,
    'type', v_type_normalized,
    'person_name', trim(p_person_name),
    'amount', p_amount,
    'reply_message', v_reply
  );
END;
$$;

-- 2. FUNGSI: get_bot_debt_summary (Cek daftar utang & piutang)
CREATE OR REPLACE FUNCTION public.get_bot_debt_summary(
  p_chat_id text,
  p_filter_type text DEFAULT NULL -- NULL, 'debt', atau 'receivable'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_debts_text text := '';
  v_receivables_text text := '';
  v_total_debt bigint := 0;
  v_total_receivable bigint := 0;
  r record;
  v_reply text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  FOR r IN
    SELECT type, person_name, amount, due_date, notes
    FROM public.debts
    WHERE user_id = v_user_id AND is_settled = false
    ORDER BY created_at DESC
  LOOP
    IF r.type = 'debt' THEN
      v_total_debt := v_total_debt + r.amount;
      v_debts_text := v_debts_text || '• ' || r.person_name || ': Rp ' || to_char(r.amount, 'FM999,999,999,999') ||
                      CASE WHEN r.due_date IS NOT NULL THEN ' (Jatuh tempo: ' || r.due_date::text || ')' ELSE '' END || E'\n';
    ELSE
      v_total_receivable := v_total_receivable + r.amount;
      v_receivables_text := v_receivables_text || '• ' || r.person_name || ': Rp ' || to_char(r.amount, 'FM999,999,999,999') ||
                            CASE WHEN r.due_date IS NOT NULL THEN ' (Jatuh tempo: ' || r.due_date::text || ')' ELSE '' END || E'\n';
    END IF;
  END LOOP;

  IF v_debts_text = '' AND v_receivables_text = '' THEN
    v_reply := 'Tidak ada utang atau piutang aktif yang belum lunas. Semua sudah beres!';
  ELSE
    v_reply := 'Daftar Utang & Piutang Aktif:' || E'\n\n';

    IF v_debts_text <> '' THEN
      v_reply := v_reply || 'Utang Anda (Kewajiban):' || E'\n' || v_debts_text ||
                 'Total Utang: Rp ' || to_char(v_total_debt, 'FM999,999,999,999') || E'\n\n';
    END IF;

    IF v_receivables_text <> '' THEN
      v_reply := v_reply || 'Piutang Anda (Tagihan):' || E'\n' || v_receivables_text ||
                 'Total Piutang: Rp ' || to_char(v_total_receivable, 'FM999,999,999,999') || E'\n\n';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_debt', v_total_debt,
    'total_receivable', v_total_receivable,
    'reply_message', trim(v_reply)
  );
END;
$$;

-- 3. FUNGSI: settle_debt_from_bot (Lunasi utang/piutang)
CREATE OR REPLACE FUNCTION public.settle_debt_from_bot(
  p_chat_id text,
  p_person_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_debt record;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE telegram_chat_id = p_chat_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat ID Telegram tidak terdaftar.');
  END IF;

  SELECT * INTO v_debt
  FROM public.debts
  WHERE user_id = v_user_id
    AND is_settled = false
    AND (
      lower(person_name) = lower(trim(p_person_name))
      OR lower(person_name) LIKE '%' || lower(trim(p_person_name)) || '%'
      OR lower(trim(p_person_name)) LIKE '%' || lower(person_name) || '%'
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_debt.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catatan utang/piutang atas nama ' || p_person_name || ' tidak ditemukan.');
  END IF;

  UPDATE public.debts
  SET is_settled = true,
      settled_at = now()
  WHERE id = v_debt.id;

  RETURN jsonb_build_object(
    'success', true,
    'reply_message', 'Catatan ' || (CASE WHEN v_debt.type = 'receivable' THEN 'Piutang' ELSE 'Utang' END) ||
      ' atas nama ' || v_debt.person_name || ' sebesar Rp ' || to_char(v_debt.amount, 'FM999,999,999,999') || ' telah ditandai LUNAS.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_debt_from_bot TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bot_debt_summary TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_debt_from_bot TO anon, authenticated, service_role;
