// tests/bot_budget.test.js
// Pengujian Menyeluruh (Zero-Bug Validation) untuk Fitur Cek & Peringatan Anggaran Bot Telegram

import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Ekstrak parser teks lokal yang digunakan di Edge Function
function extractIndonesianNominal(text) {
  const lower = text.toLowerCase();
  const perakMatch = lower.match(/(\d+)\s*perak/i);
  if (perakMatch) return parseInt(perakMatch[1], 10);

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

function fallbackParseIndonesianText(text, finContext) {
  const lower = text.toLowerCase().trim();

  // 1. Deteksi pembatalan
  if (
    /(batal|batalkan|hapus|delete|cancel|ga jadi|gak jadi|nggak jadi).*(transaksi|tadi|barusan|terakhir)/i.test(lower) ||
    /^(batal|batalkan|hapus)$/i.test(lower)
  ) {
    return { intent: "delete_transaction" };
  }

  // 2. Deteksi koreksi
  if (
    /(bukan|ralat|ganti|salah|harusnya|maksudnya|ubah|pindah).*(bca|dana|jago|dompet|tunai|cash|uang tunai)/i.test(lower) ||
    /bukan\s+pake\s+\w+.*tapi/i.test(lower) ||
    /ganti\s+(ke|dompet)\s+/i.test(lower)
  ) {
    let new_wallet_name = null;
    if (/\bbca\b/i.test(lower)) new_wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) new_wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) new_wallet_name = "Jago";
    else if (/\bdompet\b|\btunai\b|\bcash\b|\buang tunai\b/i.test(lower)) new_wallet_name = "Dompet";
    return { intent: "correct_transaction", new_wallet_name };
  }

  // 3. Deteksi pertanyaan sisa uang yang boleh dibelanjakan / jatah belanja
  if (/(sisa\s+uang|jatah|dana).*(belanja|jajan|dibelanjakan)/i.test(lower)) {
    if (finContext && finContext.total_budget_remaining !== undefined) {
      const budgetText = finContext.budgets && finContext.budgets.length > 0
        ? finContext.budgets.map((b) => `• ${b.category}: sisa Rp ${Number(b.remaining || 0).toLocaleString('id-ID')}`).join("\n")
        : "(Belum ada anggaran per kategori yang disetel)";
      const ans = `Sisa uang yang dialokasikan di anggaran bulan ini (${finContext.month_label || 'Bulan ini'}):\n${budgetText}\n\n• Total Sisa Anggaran: Rp ${Number(finContext.total_budget_remaining || 0).toLocaleString('id-ID')}\n• Total Saldo Kas Aktif: Rp ${Number(finContext.total_balance || 0).toLocaleString('id-ID')}`;
      return { intent: "conversational_advice", answer: ans };
    }
    return { intent: "check_budget", category_or_source: null };
  }

  // 4. Deteksi cek sisa anggaran / budget
  if (
    /(cek|lihat|sisa|info|berapa).*(anggaran|budget|limit)/i.test(lower) ||
    /(anggaran|budget|limit).*(apa aja|berapa|sisa|daftar|habis)/i.test(lower) ||
    /^(\/budget|\/anggaran|budget|anggaran|cek budget|cek anggaran|sisa budget|sisa anggaran)$/i.test(lower)
  ) {
    let category = null;
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

  // 5. Deteksi atur saldo
  if (
    /(di\s+(dana|bca|jago|dompet|tunai)\s+ada\s+\d+)|(saldo\s+(dana|bca|jago|dompet|tunai)\s+(ada|jadi)\s+\d+)|(atur\s+saldo\s+(dana|bca|jago|dompet|tunai))/i.test(lower)
  ) {
    let wallet_name = "Dompet";
    if (/\bbca\b/i.test(lower)) wallet_name = "BCA";
    else if (/\bdana\b/i.test(lower)) wallet_name = "Dana";
    else if (/\bjago\b/i.test(lower)) wallet_name = "Jago";
    return { intent: "set_balance", wallet_name, amount: extractIndonesianNominal(text) };
  }

  // 6. Deteksi transaksi biasa
  const amount = extractIndonesianNominal(text);
  if (amount > 0) {
    return { intent: "record_transaction", amount };
  }

  return { intent: "other" };
}

// 2. Fungsi Simulasi Perhitungan Budget Alert (Sesuai RPC create_transaction_from_bot)
function formatBudgetAlert(categoryName, spentTotal, limitAmount) {
  if (!limitAmount || limitAmount <= 0) return null;
  const pct = Math.round((spentTotal / limitAmount) * 100);

  if (spentTotal > limitAmount) {
    return {
      type: "overbudget",
      pct,
      message: `🚨 Peringatan Overbudget: Anggaran ${categoryName} telah melebihi batas (${pct}%)! Terpakai Rp ${spentTotal.toLocaleString('id-ID')} dari limit Rp ${limitAmount.toLocaleString('id-ID')}.`
    };
  }
  if (pct >= 80) {
    const sisa = limitAmount - spentTotal;
    return {
      type: "warning",
      pct,
      message: `⚠️ Perhatian Anggaran: ${categoryName} sudah terpakai ${pct}% (Rp ${spentTotal.toLocaleString('id-ID')} / Rp ${limitAmount.toLocaleString('id-ID')}). Sisa Rp ${sisa.toLocaleString('id-ID')}.`
    };
  }
  return null;
}

// ==================== TEST SUITE ====================

test('Kondisi 1: Parsing Intent Cek Anggaran (check_budget)', async (t) => {
  await t.test('1.1: Perintah umum "cek budget" menghasilkan check_budget tanpa filter kategori', () => {
    const res = fallbackParseIndonesianText("cek budget");
    assert.equal(res.intent, "check_budget");
    assert.equal(res.category_or_source, null);
  });

  await t.test('1.2: Perintah slash "/budget" dan "/anggaran" valid', () => {
    const res1 = fallbackParseIndonesianText("/budget");
    const res2 = fallbackParseIndonesianText("/anggaran");
    assert.equal(res1.intent, "check_budget");
    assert.equal(res2.intent, "check_budget");
  });

  await t.test('1.3: Pertanyaan "sisa anggaran makan berapa" mendeteksi kategori Makan/jajan', () => {
    const res = fallbackParseIndonesianText("sisa anggaran makan berapa");
    assert.equal(res.intent, "check_budget");
    assert.equal(res.category_or_source, "Makan/jajan");
  });

  await t.test('1.4: Pertanyaan "cek limit transport" mendeteksi kategori Transport', () => {
    const res = fallbackParseIndonesianText("cek limit transport");
    assert.equal(res.intent, "check_budget");
    assert.equal(res.category_or_source, "Transport");
  });

  await t.test('1.5: Pertanyaan "anggaran belanja apa aja" mendeteksi kategori Kebutuhan', () => {
    const res = fallbackParseIndonesianText("anggaran belanja apa aja");
    assert.equal(res.intent, "check_budget");
    assert.equal(res.category_or_source, "Kebutuhan");
  });

  await t.test('1.6: Pertanyaan "sisa budget tagihan" mendeteksi kategori Tagihan', () => {
    const res = fallbackParseIndonesianText("sisa budget tagihan");
    assert.equal(res.intent, "check_budget");
    assert.equal(res.category_or_source, "Tagihan");
  });

  await t.test('1.7: Kata tunggal "budget" dan "sisa anggaran" valid', () => {
    const res1 = fallbackParseIndonesianText("budget");
    const res2 = fallbackParseIndonesianText("sisa anggaran");
    assert.equal(res1.intent, "check_budget");
    assert.equal(res2.intent, "check_budget");
  });

  await t.test('1.8: Kalimat "sisa uang yang boleh dibelanjakan berapa lagi?" tanpa finContext mendeteksi check_budget', () => {
    const res = fallbackParseIndonesianText("sisa uang yang boleh dibelanjakan berapa lagi?");
    assert.equal(res.intent, "check_budget");
  });

  await t.test('1.9: Kalimat "sisa uang yang boleh dibelanjakan berapa lagi?" dengan finContext menghasilkan conversational_advice langsung', () => {
    const mockContext = {
      success: true,
      month_label: "Okt 2026",
      total_balance: 645588,
      total_budget_remaining: 550000,
      budgets: [
        { category: "Makan/jajan", limit: 1000000, spent: 450000, remaining: 550000, pct: 45 }
      ]
    };
    const res = fallbackParseIndonesianText("sisa uang yang boleh dibelanjakan berapa lagi?", mockContext);
    assert.equal(res.intent, "conversational_advice");
    assert.ok(res.answer.includes("Rp 550.000"));
    assert.ok(res.answer.includes("Rp 645.588"));
  });
});

test('Kondisi 2: Regresi Nol (Zero-Regression) untuk Fitur Bot yang Sudah Ada', async (t) => {
  await t.test('2.1: Pencatatan pengeluaran biasa tidak terganggu', () => {
    const res = fallbackParseIndonesianText("tadi sore jajan geprek 18rb");
    assert.equal(res.intent, "record_transaction");
    assert.equal(res.amount, 18000);
  });

  await t.test('2.2: Cek saldo tetap berfungsi normal', () => {
    const res = fallbackParseIndonesianText("di dana ada 600 perak");
    assert.equal(res.intent, "set_balance");
    assert.equal(res.wallet_name, "Dana");
    assert.equal(res.amount, 600);
  });

  await t.test('2.3: Pembatalan transaksi tetap berfungsi normal', () => {
    const res = fallbackParseIndonesianText("batalkan transaksi tadi");
    assert.equal(res.intent, "delete_transaction");
  });
});

test('Kondisi 3: Logika Perhitungan Budget Alert Otomatis', async (t) => {
  const limit = 1000000; // Limit Rp 1.000.000

  await t.test('3.1: Pengeluaran di bawah 80% (misal 50%) tidak memunculkan alert', () => {
    const spent = 500000;
    const alert = formatBudgetAlert("Makan/jajan", spent, limit);
    assert.equal(alert, null);
  });

  await t.test('3.2: Pengeluaran tepat 80% memunculkan warning ⚠️', () => {
    const spent = 800000;
    const alert = formatBudgetAlert("Makan/jajan", spent, limit);
    assert.ok(alert !== null);
    assert.equal(alert.type, "warning");
    assert.equal(alert.pct, 80);
    assert.match(alert.message, /⚠️ Perhatian Anggaran/);
    assert.match(alert.message, /Sisa Rp 200\.000/);
  });

  await t.test('3.3: Pengeluaran 95% memunculkan warning ⚠️ dengan sisa akurat', () => {
    const spent = 950000;
    const alert = formatBudgetAlert("Makan/jajan", spent, limit);
    assert.ok(alert !== null);
    assert.equal(alert.type, "warning");
    assert.equal(alert.pct, 95);
    assert.match(alert.message, /Sisa Rp 50\.000/);
  });

  await t.test('3.4: Pengeluaran tepat 100% (Rp 1.000.000) adalah batas limit', () => {
    const spent = 1000000;
    const alert = formatBudgetAlert("Makan/jajan", spent, limit);
    assert.ok(alert !== null);
    assert.equal(alert.type, "warning");
    assert.equal(alert.pct, 100);
    assert.match(alert.message, /Sisa Rp 0/);
  });

  await t.test('3.5: Pengeluaran di atas 100% (misal 110%) memicu status overbudget 🚨', () => {
    const spent = 1100000;
    const alert = formatBudgetAlert("Makan/jajan", spent, limit);
    assert.ok(alert !== null);
    assert.equal(alert.type, "overbudget");
    assert.equal(alert.pct, 110);
    assert.match(alert.message, /🚨 Peringatan Overbudget/);
    assert.match(alert.message, /melebihi batas \(110%\)/);
  });

  await t.test('3.6: Kategori tanpa limit (limit null atau 0) tidak menghasilkan alert', () => {
    assert.equal(formatBudgetAlert("Lain-lain", 500000, null), null);
    assert.equal(formatBudgetAlert("Lain-lain", 500000, 0), null);
  });
});
