-- Migration: 20261009153500_bot_chat_history.sql
-- Tabel dan fungsi untuk Memori Percakapan (Multi-Turn Chat History) Bot Telegram

-- 1. TABEL: bot_chat_history
CREATE TABLE IF NOT EXISTS public.bot_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index untuk query cepat berdasarkan chat_id dan urutan waktu terbaru
CREATE INDEX IF NOT EXISTS idx_bot_chat_history_chat ON public.bot_chat_history(chat_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.bot_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_chat_history_service_role" ON public.bot_chat_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bot_chat_history_anon_all" ON public.bot_chat_history
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "bot_chat_history_auth_all" ON public.bot_chat_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. FUNGSI: get_bot_chat_history
-- Mengambil percakapan terakhir terurut kronologis (dari pesan lama ke terbaru)
CREATE OR REPLACE FUNCTION public.get_bot_chat_history(
  p_chat_id text,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_history jsonb := '[]'::jsonb;
  r record;
BEGIN
  FOR r IN (
    SELECT role, content
    FROM public.bot_chat_history
    WHERE chat_id = p_chat_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) LOOP
    -- Prepend ke array agar terurut dari yang paling lama ke yang paling baru
    v_history := jsonb_build_array(jsonb_build_object('role', r.role, 'content', r.content)) || v_history;
  END LOOP;

  RETURN v_history;
END;
$$;

-- 3. FUNGSI: save_bot_chat_message
-- Menyimpan pesan ke riwayat dan otomatis membatasi maksimal 20 pesan per chat_id agar database tetap ringan
CREATE OR REPLACE FUNCTION public.save_bot_chat_message(
  p_chat_id text,
  p_role text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_content IS NULL OR trim(p_content) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.bot_chat_history (chat_id, role, content)
  VALUES (p_chat_id, p_role, trim(p_content));

  -- Hapus pesan yang lebih lama dari 20 pesan terakhir per chat_id
  DELETE FROM public.bot_chat_history
  WHERE chat_id = p_chat_id
    AND id NOT IN (
      SELECT id FROM public.bot_chat_history
      WHERE chat_id = p_chat_id
      ORDER BY created_at DESC
      LIMIT 20
    );
END;
$$;

GRANT ALL ON public.bot_chat_history TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bot_chat_history TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_bot_chat_message TO anon, authenticated, service_role;
