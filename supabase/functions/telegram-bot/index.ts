// Supabase Edge Function: telegram-bot
// Menerima Webhook Telegram, mengekstrak struk/nota/bukti transfer via Gemini Vision,
// mengenali pertanyaan bahasa sehari-hari (cek saldo, greeting, dll),
// mendukung koreksi/ralat/pembatalan transaksi terakhir,
// mencatat transaksi ke database Supabase, dan membalas ke pengguna di Telegram.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const ALLOWED_CHAT_ID = "2037807600";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://vhhvubrmmybuwpqcdikv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_uT6gq95Eq23QhdZJd3ufyw_3SFbyDk6";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Urutan model Gemini yang aktif & stabil
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

// Fungsi kirim pesan balasan ke Telegram
async function sendTelegramMessage(chatId: string | number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
    if (!res.ok) {
      console.error("Gagal kirim telegram, status:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Gagal mengirim balasan Telegram:", err);
  }
}

// Fallback Parser Cepat untuk Bahasa Indonesia jika Gemini offline / timeout
function fallbackParseIndonesianText(text: string) {
  const lower = text.toLowerCase().trim();

  // 1. Deteksi pembatalan / hapus transaksi terakhir
  if (
    /(batal|batalkan|hapus|delete|cancel|ga jadi|gak jadi|nggak jadi).*(transaksi|tadi|barusan|terakhir)/i.test(lower) ||
    /^(batal|batalkan|hapus)$/i.test(lower)
  ) {
    return { intent: "delete_transaction" };
  }

  // 2. Deteksi koreksi / ralat transaksi terakhir
  if (
    /(bukan|ralat|ganti|salah|harusnya|maksudnya|ubah|pindah).*(bca|dana|jago|dompet|tunai|cash|uang tunai)/i.test(lower) ||
    /bukan\s+pake\s+\w+.*tapi/i.test(lower) ||
    /ganti\s+(ke|dompet)\s+/i.test(lower)
  ) {
    let new_wallet_name: string | null = null;
    if (/\bbca\b/i.test(lower)) new_wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) new_wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) new_wallet_name = "Jago";
    else if (/\bdompet\b|\btunai\b|\bcash\b|\buang tunai\b/i.test(lower)) new_wallet_name = "Dompet";

    return { intent: "correct_transaction", new_wallet_name };
  }

  // 3. Deteksi pertanyaan saldo / cek saldo bahasa santai
  if (
    /(berapa|cek|sisa|total|ada berapa|info|ringkasan).*(saldo|uang|duit|rekening)/i.test(lower) ||
    /(saldo|uang|duit|rekening).*(berapa|cek|sisa|total)/i.test(lower) ||
    /^(\/saldo|saldo|cek saldo)$/i.test(lower)
  ) {
    let wallet_name: string | null = null;
    if (/\bbca\b/i.test(lower)) wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) wallet_name = "Jago";
    else if (/\bdompet\b|\btunai\b|\bcash\b/i.test(lower)) wallet_name = "Dompet";

    return { intent: "check_balance", wallet_name };
  }

  // 4. Deteksi sapaan
  if (/^(halo|hai|hi|hey|p|tes|test|pagi|siang|sore|malam|assalamualaikum)/i.test(lower)) {
    return { intent: "greeting" };
  }

  // 5. Deteksi pencatatan transaksi
  let type: "expense" | "income" = "expense";
  if (/nemu|dapat|dapet|gaji|terima|bonus|kembalian|cair|dikasih|masuk/i.test(lower)) {
    type = "income";
  }

  let amount = 0;
  const match = lower.match(/(?:rp\.?\s*)?(\d+(?:[\.,]\d+)?)\s*(ribu|rb|k|jt|juta|ribuen)?/i);
  if (match) {
    let num = parseFloat(match[1].replace(",", "."));
    const unit = match[2];
    if (unit === "ribu" || unit === "rb" || unit === "k" || unit === "ribuen") num *= 1000;
    else if (unit === "jt" || unit === "juta") num *= 1000000;
    else if (!unit && num < 1000 && match[1].includes(".")) {
      num = parseInt(match[1].replace(/\./g, ""), 10);
    }
    amount = Math.round(num);
  }

  let wallet_name: string | null = null;
  if (/\bbca\b/i.test(lower)) wallet_name = "BCA";
  else if (/\bdana\b/i.test(lower)) wallet_name = "Dana";
  else if (/\bjago\b/i.test(lower)) wallet_name = "Jago";
  else if (/\bdompet\b|\btunai\b|\bcash\b|\blaci\b|\buang tunai\b/i.test(lower)) wallet_name = "Dompet";

  let category_or_source = "Lain-lain";
  if (type === "income") {
    if (/gaji/i.test(lower)) category_or_source = "Gaji";
    else if (/bonus/i.test(lower)) category_or_source = "Bonus";
    else category_or_source = "Pemasukan Lain";
  } else {
    if (/makan|jajan|kopi|bakso|mie|nasi|es|ayam|snack|geprek/i.test(lower)) category_or_source = "Makan/jajan";
    else if (/bensin|parkir|gojek|grab|ojol|tol/i.test(lower)) category_or_source = "Transport";
    else if (/beli|belanja|baju|sepatu/i.test(lower)) category_or_source = "Belanja";
    else if (/wifi|listrik|air|pulsa|kuota|kos/i.test(lower)) category_or_source = "Tagihan";
  }

  return { intent: "record_transaction", type, amount, wallet_name, category_or_source, notes: text, date: null };
}

// Analisis Foto Struk / Nota dengan Gemini Vision
async function analyzeReceiptWithGemini(base64Image: string, mimeType: string) {
  const prompt = `Kamu adalah asisten keuangan pribadi. Analisis gambar struk belanja, nota, atau tangkapan layar bukti transfer uang berikut.
Kembalikan HANYA JSON MURNI tanpa markdown atau formatting apapun:
{
  "type": "expense" atau "income",
  "amount": 50000,
  "wallet_name": "BCA" atau "Dana" atau "Jago" atau "Dompet",
  "category_or_source": "Makan/jajan" atau "Belanja" atau "Transport" atau "Kebutuhan",
  "notes": "Nama toko / keterangan ringkas",
  "date": "YYYY-MM-DD"
}
Aturan:
1. "amount" harus angka bulat positif tanpa tanda titik, koma, atau simbol Rp.
2. Jika terdeteksi transfer keluar atau struk belanja, type "expense". Jika transfer masuk, type "income".
3. "wallet_name": "BCA", "Dana", "Jago", atau "Dompet". Jika tidak yakin, gunakan "Dompet".`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        console.warn(`Model ${model} Vision error ${response.status}:`, await response.text());
        continue;
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanJson = rawText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn(`Percobaan model ${model} gagal:`, err);
    }
  }

  throw new Error("Semua model Gemini Vision gagal memproses gambar.");
}

// Analisis Pesan Teks Bahasa Sehari-hari dengan Gemini
async function analyzeTextWithGemini(text: string) {
  const prompt = `Kamu adalah asisten keuangan pribadi cerdas. Analisis pesan pengguna bahasa Indonesia berikut: "${text}"
Identifikasi maksud pengguna secara cerdas:
1. "correct_transaction": jika pengguna ingin meralat/mengoreksi transaksi terakhir (contoh: "bukan pake bca, tapi pake uang tunai", "bukan bca tapi dana", "ganti dompet ke dompet", "salah dompet", "ralat tadi 20rb")
2. "delete_transaction": jika membatalkan/menghapus transaksi terakhir (contoh: "batalkan transaksi tadi", "hapus transaksi barusan", "ga jadi catat")
3. "check_balance": jika menanyakan saldo/uang
4. "record_transaction": jika mencatat transaksi baru
5. "greeting": jika menyapa
6. "other": lainnya

Kembalikan format JSON murni:
{
  "intent": "correct_transaction" | "delete_transaction" | "check_balance" | "record_transaction" | "greeting" | "other",
  "new_wallet_name": "BCA" | "Dana" | "Jago" | "Dompet" | null,
  "new_amount": angka bulat positif atau null,
  "type": "expense" atau "income" atau null,
  "amount": angka bulat nominal atau null,
  "wallet_name": "BCA" | "Dana" | "Jago" | "Dompet" | null,
  "category_or_source": kategori atau sumber ringkas atau null,
  "notes": keterangan ringkas atau null,
  "date": null
}`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (!response.ok) {
        console.warn(`Model ${model} Text error ${response.status}:`, await response.text());
        continue;
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanJson = rawText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.intent) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Percobaan teks model ${model} gagal:`, err);
    }
  }

  // Jika semua endpoint AI sibuk / error, gunakan fallback parser cerdas lokal
  console.log("Menggunakan fallback parser lokal untuk teks:", text);
  return fallbackParseIndonesianText(text);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let currentChatId: string | number = ALLOWED_CHAT_ID;

  try {
    const update = await req.json();
    const message = update.message;

    if (!message) {
      return new Response("No message", { status: 200 });
    }

    const chatId = String(message.chat.id);
    currentChatId = chatId;

    // Keamanan: Hanya proses pesan dari Chat ID pemilik
    if (chatId !== ALLOWED_CHAT_ID) {
      await sendTelegramMessage(chatId, "Akses ditolak. Bot ini hanya dikonfigurasi untuk pemilik akun.");
      return new Response("Unauthorized", { status: 200 });
    }

    const text = (message.text || "").trim();

    // 1. Perintah Bantuan / Mulai
    if (text === "/start" || text === "/help") {
      const welcome = `Halo Febri! Asisten Keuangan aktif 24 jam.\n\nKamu bisa bicara dengan bahasa santai:\n• Tanya saldo: "berapa saldo sekarang?", "saldo bca berapa?"\n• Catat pengeluaran: "tadi sore jajan geprek 18rb", "jajan kopi 25rb bca"\n• Ralat / Koreksi: "bukan pake bca, tapi pake uang tunai", "ralat tadi 20rb"\n• Batalkan: "batalkan transaksi tadi"\n• Kirim foto struk belanja / bukti transfer langsung ke chat ini.`;
      await sendTelegramMessage(chatId, welcome);
      return new Response("OK", { status: 200 });
    }

    // 2. Jika Pengguna Mengirim Gambar (Foto Struk / Bukti Transfer)
    if (message.photo && message.photo.length > 0) {
      await sendTelegramMessage(chatId, "Sedang membaca struk/gambar via Gemini AI...");

      const bestPhoto = message.photo[message.photo.length - 1];
      const fileId = bestPhoto.file_id;

      const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        await sendTelegramMessage(chatId, "Gagal mengunduh gambar dari Telegram.");
        return new Response("OK", { status: 200 });
      }

      const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
      const imageRes = await fetch(fileDownloadUrl);
      const imageBuffer = await imageRes.arrayBuffer();
      
      const uint8 = new Uint8Array(imageBuffer);
      let binaryStr = "";
      for (let i = 0; i < uint8.length; i++) {
        binaryStr += String.fromCharCode(uint8[i]);
      }
      const base64Image = btoa(binaryStr);
      const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

      let parsedData;
      try {
        parsedData = await analyzeReceiptWithGemini(base64Image, mimeType);
      } catch (geminiErr: any) {
        await sendTelegramMessage(chatId, "Gagal membaca struk: " + geminiErr.message + ". Silakan coba kirim foto lebih jelas atau ketik manual.");
        return new Response("OK", { status: 200 });
      }

      if (!parsedData.amount || parsedData.amount <= 0) {
        await sendTelegramMessage(chatId, "Nominal tidak terbaca jelas pada gambar. Silakan kirim foto yang lebih terang atau ketik manual.");
        return new Response("OK", { status: 200 });
      }

      const { data: txResult, error: txError } = await supabase.rpc("create_transaction_from_bot", {
        p_chat_id: chatId,
        p_type: parsedData.type || "expense",
        p_amount: Math.round(Number(parsedData.amount)),
        p_wallet_name: parsedData.wallet_name || null,
        p_category_or_source: parsedData.category_or_source || null,
        p_notes: parsedData.notes || "Foto Struk / Nota",
        p_date: parsedData.date || null,
      });

      if (txError || !txResult?.success) {
        await sendTelegramMessage(chatId, "Gagal mencatat transaksi: " + (txError?.message || txResult?.error));
      } else {
        await sendTelegramMessage(chatId, txResult.reply_message);
      }

      return new Response("OK", { status: 200 });
    }

    // 3. Jika Pengguna Mengirim Teks Bahasa Sehari-hari
    if (text) {
      const lowerText = text.toLowerCase();

      // Jalur Cepat (Fast-path): Cek saldo
      const isQuickBalanceCheck =
        lowerText === "/saldo" ||
        /(berapa|cek|sisa|total|ada berapa|info|ringkasan).*(saldo|uang|duit|rekening)/i.test(lowerText) ||
        /(saldo|uang|duit|rekening).*(berapa|cek|sisa|total)|^saldo$/i.test(lowerText);

      if (isQuickBalanceCheck) {
        const { data, error } = await supabase.rpc("get_bot_balance_summary", {
          p_chat_id: chatId,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal mengambil data saldo: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // Jalur Cepat: Hapus / Batalkan transaksi terakhir
      const isQuickDelete =
        /(batal|batalkan|hapus|delete|cancel|ga jadi|gak jadi|nggak jadi).*(transaksi|tadi|barusan|terakhir)/i.test(lowerText) ||
        /^(batal|batalkan|hapus)$/i.test(lowerText);

      if (isQuickDelete) {
        const { data, error } = await supabase.rpc("delete_last_transaction_from_bot", {
          p_chat_id: chatId,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal membatalkan transaksi: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // Analisis Pesan dengan Gemini AI (Intent Detection)
      const parsedData = await analyzeTextWithGemini(text);

      // A. Maksud: Koreksi Transaksi Terakhir (misal: "bukan pake bca, tapi pake uang tunai")
      if (parsedData.intent === "correct_transaction") {
        let newWallet = parsedData.new_wallet_name || null;
        if (!newWallet) {
          if (/\bbca\b/i.test(lowerText)) newWallet = "BCA";
          else if (/\bdana\b/i.test(lowerText)) newWallet = "Dana";
          else if (/\bjago\b/i.test(lowerText)) newWallet = "Jago";
          else if (/dompet|tunai|cash|uang tunai/i.test(lowerText)) newWallet = "Dompet";
        }

        const { data, error } = await supabase.rpc("correct_last_transaction_from_bot", {
          p_chat_id: chatId,
          p_new_wallet_name: newWallet,
          p_new_amount: parsedData.new_amount ? Math.round(Number(parsedData.new_amount)) : null,
          p_new_category: null,
          p_new_notes: null,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal mengoreksi transaksi: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // B. Maksud: Batalkan Transaksi Terakhir
      if (parsedData.intent === "delete_transaction") {
        const { data, error } = await supabase.rpc("delete_last_transaction_from_bot", {
          p_chat_id: chatId,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal membatalkan transaksi: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // C. Maksud: Menanyakan Saldo
      if (parsedData.intent === "check_balance") {
        const { data, error } = await supabase.rpc("get_bot_balance_summary", {
          p_chat_id: chatId,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal mengambil data saldo: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // D. Maksud: Sapaan (Greeting)
      if (parsedData.intent === "greeting") {
        const replyGreeting = `Halo Febri! Ada yang bisa dibantu?\n\nKamu bisa langsung ketik:\n• "berapa saldo sekarang?"\n• "jajan kopi 25rb bca"\n• "nemu duit 2ribu di laci"\n• Ralat: "bukan pake bca, tapi pake uang tunai"\natau kirim foto struk belanja.`;
        await sendTelegramMessage(chatId, replyGreeting);
        return new Response("OK", { status: 200 });
      }

      // E. Maksud: Pencatatan Transaksi
      if (parsedData.amount && parsedData.amount > 0) {
        const { data: txResult, error: txError } = await supabase.rpc("create_transaction_from_bot", {
          p_chat_id: chatId,
          p_type: parsedData.type || "expense",
          p_amount: Math.round(Number(parsedData.amount)),
          p_wallet_name: parsedData.wallet_name || null,
          p_category_or_source: parsedData.category_or_source || null,
          p_notes: parsedData.notes || text,
          p_date: parsedData.date || null,
        });

        if (txError || !txResult?.success) {
          await sendTelegramMessage(chatId, "Gagal mencatat transaksi: " + (txError?.message || txResult?.error));
        } else {
          await sendTelegramMessage(chatId, txResult.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // F. Maksud Lain / Tidak Dikenali
      const helpMsg = `Saya belum memahami pesan tersebut.\n\nContoh yang bisa kamu ketik:\n• "berapa saldo sekarang?" (cek saldo)\n• "tadi sore jajan geprek 18rb" (catat pengeluaran)\n• "bukan bca, tapi tunai" (ralat transaksi terakhir)\n• "batalkan transaksi tadi" (hapus transaksi terakhir)\natau kirim foto struk kasir / bukti transfer.`;
      await sendTelegramMessage(chatId, helpMsg);
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Error handler webhook:", err);
    try {
      await sendTelegramMessage(currentChatId, "Terjadi kesalahan internal bot: " + err.message);
    } catch (_) {}
    return new Response("OK", { status: 200 });
  }
});
