// Supabase Edge Function: telegram-bot
// Menerima Webhook Telegram, mengekstrak struk/nota/bukti transfer via Gemini Vision,
// mengenali pertanyaan bahasa sehari-hari (cek saldo, greeting, dll),
// mendukung atur saldo (misal: "di dana ada 600 perak"),
// mendukung pencatatan & cek utang/piutang (misal: "masukkan ke piutang dua carita 26364", "cek utang"),
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

// Urutan model Vision OCR (Gunakan Gemini 3.8 Flash untuk akurasi tinggi pada struk)
const CANDIDATE_VISION_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];

// Urutan model Text NLP Cepat
const CANDIDATE_TEXT_MODELS = [
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

// Ekstrak angka nominal bahasa Indonesia (mendukung "perak", "ribu", "rb", "k", "jt", dll)
function extractIndonesianNominal(text: string): number {
  const lower = text.toLowerCase();

  // 1. Cek format "perak" (misal: 600 perak, 500 perak)
  const perakMatch = lower.match(/(\d+)\s*perak/i);
  if (perakMatch) {
    return parseInt(perakMatch[1], 10);
  }

  // 2. Cek format standar nominal
  const match = lower.match(/(?:rp\.?\s*)?(\d+(?:[\.,]\d+)?)\s*(ribu|rb|k|jt|juta|ribuen)?/i);
  if (match) {
    let num = parseFloat(match[1].replace(",", "."));
    const unit = match[2];
    if (unit === "ribu" || unit === "rb" || unit === "k" || unit === "ribuen") num *= 1000;
    else if (unit === "jt" || unit === "juta") num *= 1000000;
    else if (!unit && num < 1000 && match[1].includes(".")) {
      num = parseInt(match[1].replace(/\./g, ""), 10);
    }
    return Math.round(num);
  }

  return 0;
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

  // 3. Deteksi cek sisa anggaran / budget / jatah belanja
  if (
    /(cek|lihat|sisa|info|berapa).*(anggaran|budget|limit)/i.test(lower) ||
    /(anggaran|budget|limit).*(apa aja|berapa|sisa|daftar|habis)/i.test(lower) ||
    /(sisa\s+uang|jatah|dana).*(belanja|jajan|dibelanjakan)/i.test(lower) ||
    /^(\/budget|\/anggaran|budget|anggaran|cek budget|cek anggaran|sisa budget|sisa anggaran)$/i.test(lower)
  ) {
    let category: string | null = null;
    if (/makan|jajan/i.test(lower)) category = "Makan/jajan";
    else if (/transport/i.test(lower)) category = "Transport";
    else if (/kebutuhan|belanja/i.test(lower)) category = "Kebutuhan";
    else if (/tagihan/i.test(lower)) category = "Tagihan";

    return { intent: "check_budget", category_or_source: category };
  }

  // 4. Deteksi cek daftar utang / piutang
  if (
    /(cek|lihat|daftar|info|ada)\s*(utang|piutang|kasbon)/i.test(lower) ||
    /(utang|piutang|kasbon)\s*(apa aja|berapa|daftar)/i.test(lower) ||
    /^(\/utang|\/piutang|cek utang|cek piutang)$/i.test(lower)
  ) {
    return { intent: "check_debt" };
  }

  // 4. Deteksi pelunasan utang / piutang
  if (
    /(lunas|lunasi|sudah bayar|sdh bayar|bayar utang)/i.test(lower) &&
    /(utang|piutang|ke|dari)/i.test(lower)
  ) {
    let person = "";
    const m = lower.match(/(?:ke|dari|nama|pihak)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:sebesar|lunas|rp|\d+)|$)/i);
    if (m) {
      person = m[1].replace(/dulu|aja|deh|dong/g, "").trim();
    }
    return { intent: "settle_debt", person_name: person };
  }

  // 5. Deteksi pencatatan utang / piutang
  if (/(piutang|ngutang|utang|pinjam|minjam|minjem|minjemin|talangin|kasbon)/i.test(lower)) {
    let debt_type = "debt";
    if (/(piutang|minjemin|talangin|ngutang ke aku|pinjam ke aku)/i.test(lower)) {
      debt_type = "receivable";
    }

    let person_name = "";
    const nameMatch = lower.match(/(?:ke|dari|untuk|piutang|utang)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:sebesar|rp|\d+)|$)/i);
    if (nameMatch) {
      person_name = nameMatch[1]
        .replace(/^(ke|dari|untuk|piutang|utang)\s+/i, "")
        .replace(/dulu|aja|deh|dong/g, "")
        .trim();
    }

    const amount = extractIndonesianNominal(text);
    return {
      intent: "record_debt",
      debt_type,
      person_name: person_name || "Lainnya",
      amount,
      notes: text,
    };
  }

  // 6. Deteksi atur saldo / update saldo dompet (misal: "di dana ada 600 perak")
  if (
    /(di\s+(dana|bca|jago|dompet|tunai)\s+ada\s+\d+)|(saldo\s+(dana|bca|jago|dompet|tunai)\s+(ada|jadi)\s+\d+)|(atur\s+saldo\s+(dana|bca|jago|dompet|tunai))/i.test(lower)
  ) {
    let wallet_name = "Dompet";
    if (/\bbca\b/i.test(lower)) wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) wallet_name = "Jago";
    else if (/\bdompet\b|\btunai\b|\bcash\b/i.test(lower)) wallet_name = "Dompet";

    const amount = extractIndonesianNominal(text);
    return { intent: "set_balance", wallet_name, amount };
  }

  // 7. Deteksi pertanyaan saldo / cek saldo bahasa santai
  if (
    /(berapa|cek|sisa|total|ada berapa|info|ringkasan).*(saldo|uang|duit|rekening|dompet|bca|dana|jago)/i.test(lower) ||
    /(saldo|uang|duit|rekening|dompet|bca|dana|jago).*(berapa|cek|sisa|total)/i.test(lower) ||
    /^(\/saldo|saldo|cek saldo|cek dompet|cek bca|cek dana)$/i.test(lower)
  ) {
    let wallet_name: string | null = null;
    if (/\bbca\b/i.test(lower)) wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) wallet_name = "Jago";
    else if (/\bdompet\b|\btunai\b|\bcash\b/i.test(lower)) wallet_name = "Dompet";

    return { intent: "check_balance", wallet_name };
  }

  // 8. Deteksi sapaan
  if (/^(halo|hai|hi|hey|p|tes|test|pagi|siang|sore|malam|assalamualaikum)/i.test(lower)) {
    return { intent: "greeting" };
  }

  // 9. Deteksi pencatatan transaksi
  let type: "expense" | "income" = "expense";
  if (/nemu|dapat|dapet|gaji|terima|bonus|kembalian|cair|dikasih|masuk/i.test(lower)) {
    type = "income";
  }

  const amount = extractIndonesianNominal(text);

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
    if (/makan|jajan|kopi|bakso|mie|nasi|es|ayam|snack|geprek|gacoan/i.test(lower)) category_or_source = "Makan/jajan";
    else if (/bensin|parkir|gojek|grab|ojol|tol/i.test(lower)) category_or_source = "Transport";
    else if (/beli|belanja|baju|sepatu/i.test(lower)) category_or_source = "Kebutuhan";
    else if (/wifi|listrik|air|pulsa|kuota|kos/i.test(lower)) category_or_source = "Tagihan";
  }

  return { intent: "record_transaction", type, amount, wallet_name, category_or_source, notes: text, date: null };
}

// Analisis Foto Struk / Nota dengan Gemini Vision (Model 3.8 Flash Prioritas)
async function analyzeReceiptWithGemini(base64Image: string, mimeType: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const prompt = `Kamu adalah sistem OCR dan analisis struk belanja kasir / nota / bukti transfer yang SANGAT TELITI dan AKURAT.
Analisis gambar struk belanja kasir atau bukti pembayaran ini.

ATURAN EKSTRAKSI NOMINAL (amount):
1. "amount": Cari dan ambil angka TOTAL AKHIR belanja yang harus dibayar konsumen (biasanya berlabel "Total Payable", "Total", "Grand Total", "Total Belanja", "Subtotal").
   - SANGAT PENTING: JANGAN mengambil nominal pembayaran kasir sebelum kembalian (contoh: jika tertulis "Subtotal 42.000", "Total Payable 42.000", "Cash 50.000", "Change 8.000", maka "amount" adalah 42000, BUKAN 50000 dan BUKAN 100000).
   - "amount" harus berupa angka bulat integer murni tanpa koma/titik/Rp.

ATURAN DOMPET (wallet_name):
2. "wallet_name":
   - Jika di struk tertera metode bayar "Cash", "Tunai", atau ada "Change" (kembalian uang tunai), gunakan "Dompet".
   - Jika tertera "Debit BCA", "BCA", "QRIS BCA", gunakan "BCA".
   - Jika tertera "Dana" atau "QRIS Dana", gunakan "Dana".
   - Jika tertera "Jago", gunakan "Jago".
   - Jika tidak yakin / tidak tertulis, default ke "Dompet".

ATURAN KATEGORI (category_or_source):
3. "category_or_source":
   - "Kebutuhan": untuk pakaian, fashion, toserba, minimarket, sabun, sampo, deodoran, kosmetik, perlengkapan mandi/rumah.
   - "Makan/jajan": untuk restoran, cafe, kedai, warung makan, gacoan, geprek, kfc, bakery, snack.
   - "Transport": untuk SPBU, bensin, parkir, tol, gojek, grab.
   - "Tagihan": untuk listrik, air, wifi, pulsa, kos.

ATURAN TANGGAL & CATATAN:
4. "date": Ambil tanggal transaksi yang tertera di struk format YYYY-MM-DD. Perhatikan tahun pada struk (tahun sekarang 2026). Jika tanggal/tahun buram atau tidak terbaca jelas, gunakan tanggal hari ini (${todayStr}). JANGAN mengarang tahun lama!
5. "notes": Tulis nama toko dan 1-2 ringkasan barang utama (contoh: "Fashion Boras Dago (Gatsby Deo, MZ HK)").

Kembalikan HANYA JSON MURNI tanpa markdown:
{
  "type": "expense" atau "income",
  "amount": 42000,
  "wallet_name": "Dompet",
  "category_or_source": "Kebutuhan",
  "notes": "Fashion Boras Dago",
  "date": "YYYY-MM-DD"
}`;

  for (const model of CANDIDATE_VISION_MODELS) {
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
      const parts = result.candidates?.[0]?.content?.parts || [];
      const rawText = parts.map((p: any) => p.text || "").join("") || "{}";
      const cleanJson = rawText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.amount && parsed.amount > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Percobaan model ${model} gagal:`, err);
    }
  }

  throw new Error("Semua model Gemini Vision gagal memproses gambar.");
}

// Analisis Pesan Teks Bahasa Sehari-hari dengan Gemini NLP
async function analyzeTextWithGemini(text: string) {
  const prompt = `Kamu adalah asisten keuangan pribadi cerdas. Analisis pesan pengguna bahasa Indonesia berikut: "${text}"
Identifikasi maksud pengguna secara cerdas:
1. "record_debt": jika pengguna mencatat UTANG atau PIUTANG (contoh: "masukkan ke piutang dua carita 26364", "ngutang dulu ke dua carita 26364", "utang ke budi 50rb", "andi pinjam uang 100rb").
   - Jika pengguna yang berutang ke orang lain ("ngutang ke X", "pinjam ke X", "utang ke X") -> debt_type: "debt"
   - Jika orang lain yang berutang ke pengguna ("piutang X", "masukkan ke piutang X", "X ngutang ke aku", "talangin X") -> debt_type: "receivable"
2. "check_debt": jika menanyakan daftar utang atau piutang (contoh: "cek utang", "ada utang apa aja", "cek piutang")
3. "settle_debt": jika melunasi utang atau piutang (contoh: "lunasi utang ke dua carita", "budi sudah bayar utang", "utang ke budi lunas")
4. "check_budget": jika menanyakan sisa atau status anggaran / budget / sisa uang yang boleh dibelanjakan (contoh: "cek budget", "budget", "sisa anggaran makan berapa", "sisa uang yang boleh dibelanjakan berapa lagi?", "budget bulan ini", "cek limit", "anggaran apa aja", "sisa anggaran"). Jika spesifik ke kategori tertentu, sebutkan di category_or_source.
5. "set_balance": jika pengguna menginformasikan atau mengatur saldo dompet (contoh: "di dana ada 600 perak", "saldo bca ada 50rb"). Catatan: "perak" berarti rupiah (contoh: 600 perak = 600).
6. "correct_transaction": jika pengguna ingin meralat/mengoreksi transaksi terakhir (contoh: "bukan pake bca, tapi pake uang tunai", "bukan bca tapi dana", "ralat tadi 20rb")
7. "delete_transaction": jika membatalkan/menghapus transaksi terakhir (contoh: "batalkan transaksi tadi", "hapus transaksi barusan", "ga jadi catat")
8. "check_balance": jika menanyakan saldo/uang (contoh: "berapa saldo sekarang?", "cek dompet dong", "saldo bca berapa")
9. "record_transaction": jika mencatat pengeluaran/pemasukan baru (contoh: "jajan bakso 20rb", "nemu duit 2ribu")
10. "greeting": jika menyapa (contoh: "halo", "hai")
11. "other": lainnya

Kembalikan format JSON murni:
{
  "intent": string,
  "debt_type": "debt" | "receivable" | null,
  "person_name": string | null,
  "new_wallet_name": "BCA" | "Dana" | "Jago" | "Dompet" | null,
  "new_amount": number | null,
  "type": "expense" | "income" | null,
  "amount": number | null,
  "wallet_name": "BCA" | "Dana" | "Jago" | "Dompet" | null,
  "category_or_source": string | null,
  "notes": string | null,
  "date": null
}`;

  for (const model of CANDIDATE_TEXT_MODELS) {
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
      const parts = result.candidates?.[0]?.content?.parts || [];
      const rawText = parts.map((p: any) => p.text || "").join("") || "{}";
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
      const welcome = `Halo Febri! Asisten Keuangan aktif 24 jam.\n\nKamu bisa bicara dengan bahasa santai:\n• Foto Struk: Kirim foto struk belanja / nota / transferan kasir langsung.\n• Utang / Piutang: "ngutang dulu ke dua carita 26364", "masukkan ke piutang budi 50rb", "cek utang"\n• Pelunasan Utang: "lunasi utang ke dua carita"\n• Cek Anggaran: "cek budget", "sisa anggaran makan berapa?"\n• Catat Pengeluaran: "tadi sore jajan geprek 18rb", "bayar gacoan 26364 pake bca"\n• Catat Pemasukan: "nemu duit 2ribu di laci", "gaji 5jt bca"\n• Tanya Saldo: "berapa saldo sekarang?", "cek dompet dong", "saldo bca berapa?"\n• Atur Saldo: "di dana ada 600 perak"\n• Ralat / Koreksi: "bukan pake bca, tapi pake uang tunai"\n• Batalkan: "batalkan transaksi tadi"`;
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
        await sendTelegramMessage(chatId, "Nominal tidak terbaca jelas pada struk. Silakan kirim foto yang lebih terang atau ketik manual.");
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

      // Jalur Cepat (Fast-path): Hapus / Batalkan transaksi terakhir
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

      // A. Maksud: Pencatatan Utang atau Piutang
      if (parsedData.intent === "record_debt") {
        const debtType = parsedData.debt_type || (lowerText.includes("piutang") ? "receivable" : "debt");
        const person = parsedData.person_name || "Lainnya";
        const amt = parsedData.amount !== null && parsedData.amount !== undefined && parsedData.amount > 0
          ? Math.round(Number(parsedData.amount))
          : extractIndonesianNominal(text);

        if (!amt || amt <= 0) {
          await sendTelegramMessage(chatId, "Nominal utang/piutang tidak terbaca. Contoh: 'ngutang ke dua carita 26364' atau 'masukkan ke piutang budi 50rb'");
          return new Response("OK", { status: 200 });
        }

        const { data: debtResult, error: debtError } = await supabase.rpc("create_debt_from_bot", {
          p_chat_id: chatId,
          p_type: debtType,
          p_person_name: person,
          p_amount: amt,
          p_due_date: parsedData.date || null,
          p_notes: parsedData.notes || text,
        });

        if (debtError || !debtResult?.success) {
          await sendTelegramMessage(chatId, "Gagal mencatat utang/piutang: " + (debtError?.message || debtResult?.error));
        } else {
          await sendTelegramMessage(chatId, debtResult.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // B. Maksud: Cek Daftar Utang & Piutang
      if (parsedData.intent === "check_debt") {
        const { data: debtData, error: debtError } = await supabase.rpc("get_bot_debt_summary", {
          p_chat_id: chatId,
        });

        if (debtError || !debtData?.success) {
          await sendTelegramMessage(chatId, "Gagal mengambil data utang: " + (debtError?.message || debtData?.error));
        } else {
          await sendTelegramMessage(chatId, debtData.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // B2. Maksud: Cek Anggaran / Sisa Budget Bulanan
      if (parsedData.intent === "check_budget") {
        const { data: budgetData, error: budgetError } = await supabase.rpc("get_bot_budget_summary", {
          p_chat_id: chatId,
          p_category_name: parsedData.category_or_source || null,
        });

        if (budgetError || !budgetData?.success) {
          await sendTelegramMessage(chatId, "Gagal mengambil data anggaran: " + (budgetError?.message || budgetData?.error));
        } else {
          await sendTelegramMessage(chatId, budgetData.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // C. Maksud: Lunasi Utang / Piutang
      if (parsedData.intent === "settle_debt") {
        const person = parsedData.person_name || "";
        if (!person) {
          await sendTelegramMessage(chatId, "Sebutkan nama pihak yang ingin dilunasi. Contoh: 'lunasi utang ke dua carita'");
          return new Response("OK", { status: 200 });
        }

        const { data: settleResult, error: settleError } = await supabase.rpc("settle_debt_from_bot", {
          p_chat_id: chatId,
          p_person_name: person,
        });

        if (settleError || !settleResult?.success) {
          await sendTelegramMessage(chatId, "Gagal melunasi: " + (settleError?.message || settleResult?.error));
        } else {
          await sendTelegramMessage(chatId, settleResult.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // D. Maksud: Mengatur / Memperbarui Saldo Dompet (misal: "di dana ada 600 perak")
      if (parsedData.intent === "set_balance") {
        let walletName = parsedData.wallet_name || null;
        if (!walletName) {
          if (/\bbca\b/i.test(lowerText)) walletName = "BCA";
          else if (/\bdana\b/i.test(lowerText)) walletName = "Dana";
          else if (/\bjago\b/i.test(lowerText)) walletName = "Jago";
          else if (/dompet|tunai|cash|uang tunai/i.test(lowerText)) walletName = "Dompet";
        }

        const targetBalance = parsedData.amount !== null && parsedData.amount !== undefined
          ? Math.round(Number(parsedData.amount))
          : extractIndonesianNominal(text);

        const { data, error } = await supabase.rpc("set_wallet_balance_from_bot", {
          p_chat_id: chatId,
          p_wallet_name: walletName,
          p_target_balance: targetBalance,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal memperbarui saldo: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // E. Maksud: Koreksi Transaksi Terakhir (misal: "bukan pake bca, tapi pake uang tunai")
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

      // F. Maksud: Batalkan Transaksi Terakhir
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

      // G. Maksud: Menanyakan Saldo (Bisa spesifik 1 dompet atau seluruhnya)
      if (parsedData.intent === "check_balance") {
        let targetWallet = parsedData.wallet_name || null;
        if (!targetWallet) {
          if (/\bbca\b/i.test(lowerText)) targetWallet = "BCA";
          else if (/\bdana\b/i.test(lowerText)) targetWallet = "Dana";
          else if (/\bjago\b/i.test(lowerText)) targetWallet = "Jago";
          else if (/\bdompet\b|\btunai\b|\bcash\b/i.test(lowerText)) targetWallet = "Dompet";
        }

        const { data, error } = await supabase.rpc("get_bot_balance_summary", {
          p_chat_id: chatId,
          p_wallet_name: targetWallet,
        });

        if (error || !data?.success) {
          await sendTelegramMessage(chatId, "Gagal mengambil data saldo: " + (error?.message || data?.error));
        } else {
          await sendTelegramMessage(chatId, data.reply_message);
        }
        return new Response("OK", { status: 200 });
      }

      // H. Maksud: Sapaan (Greeting)
      if (parsedData.intent === "greeting") {
        const replyGreeting = `Halo Febri! Ada yang bisa dibantu?\n\nKamu bisa langsung ketik:\n• Foto Struk: Kirim foto struk kasir / bukti transfer\n• Utang / Piutang: "ngutang dulu ke dua carita 26364", "masukkan ke piutang budi 50rb", "cek utang"\n• Pelunasan Utang: "lunasi utang ke dua carita"\n• Catat Transaksi: "tadi sore jajan geprek 18rb", "bayar gacoan 26364 pake bca"\n• Cek Saldo: "berapa saldo sekarang?" atau "cek dompet dong"\n• Atur Saldo: "di dana ada 600 perak"`;
        await sendTelegramMessage(chatId, replyGreeting);
        return new Response("OK", { status: 200 });
      }

      // I. Maksud: Pencatatan Transaksi Biasa
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

      // J. Maksud Lain / Tidak Dikenali
      const helpMsg = `Saya belum memahami pesan tersebut.\n\nContoh yang bisa kamu ketik:\n• "cek budget" atau "sisa anggaran makan berapa"\n• "ngutang dulu ke dua carita 26364" (catat utang)\n• "masukkan ke piutang budi 50rb" (catat piutang)\n• "cek utang" (daftar utang & piutang)\n• "tadi sore jajan geprek 18rb" (catat pengeluaran)\n• "cek dompet dong" (tanya saldo dompet)\natau kirim foto struk kasir / bukti pembayaran.`;
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
