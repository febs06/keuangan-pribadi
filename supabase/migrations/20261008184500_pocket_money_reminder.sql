-- Migration: 20261008184500_pocket_money_reminder.sql
-- Fungsi pengingat otomatis jika uang jajan belum dimasukkan hari ini

CREATE OR REPLACE FUNCTION public.check_and_send_pocket_money_reminder()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_chat_id text;
  v_today date;
  v_has_income boolean;
  v_msg text;
BEGIN
  -- Tanggal hari ini zona WIB (UTC+7)
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT user_id, telegram_chat_id INTO v_user_id, v_chat_id
  FROM public.app_settings
  WHERE telegram_chat_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NULL OR v_chat_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Chat ID belum terdaftar');
  END IF;

  -- Periksa apakah hari ini sudah ada catatan pemasukan (uang jajan / pemasukan kas)
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_user_id
      AND type = 'income'
      AND date = v_today
  ) INTO v_has_income;

  -- Jika belum ada pemasukan hari ini, kirim pengingat ke Telegram
  IF NOT v_has_income THEN
    v_msg := '🔔 Pengingat Harian Keuangan' || E'\n\n' ||
             'Halo Febri! Kamu belum mencatat pemasukan Uang Jajan untuk hari ini (' || to_char(v_today, 'DD Mon YYYY') || ').' || E'\n\n' ||
             'Sudah dapat uang jajan hari ini? Ketik langsung di sini, contoh:' || E'\n' ||
             '• "uang jajan 50000 dompet"' || E'\n' ||
             '• "nemu duit 20rb"';

    PERFORM net.http_post(
      url := 'https://api.telegram.org/bot8811525485:AAFCAdkMGVMo42vVXgpMc9ylZo0e4htbvpE/sendMessage',
      body := jsonb_build_object(
        'chat_id', v_chat_id,
        'text', v_msg
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

    UPDATE public.app_settings
    SET last_reminder_date = v_today
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'sent', true, 'date', v_today);
  END IF;

  RETURN jsonb_build_object('success', true, 'sent', false, 'reason', 'Uang jajan hari ini sudah tercatat');
END;
$$;

-- Jadwalkan pengingat otomatis setiap hari jam 20:00 WIB (13:00 UTC)
-- Hapus job lama jika ada
SELECT cron.unschedule('daily-pocket-money-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-pocket-money-reminder');

SELECT cron.schedule(
  'daily-pocket-money-reminder',
  '0 13 * * *', -- Jam 13:00 UTC = 20:00 WIB
  'SELECT public.check_and_send_pocket_money_reminder();'
);
