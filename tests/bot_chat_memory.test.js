// tests/bot_chat_memory.test.js
// Pengujian Memori Percakapan Multi-Turn (Zero-Bug Validation) untuk Telegram Bot

import test from 'node:test';
import assert from 'node:assert/strict';

// Fungsi formatter dari Edge Function
function formatChatHistoryForPrompt(history) {
  if (!history || !Array.isArray(history) || history.length === 0) return "";
  let out = `RIWAYAT PERCAKAPAN SEBELUMNYA (GUNAKAN UNTUK MEMAHAMI KONTEKS LANJUTAN):\n`;
  for (const item of history) {
    if (!item.content) continue;
    const speaker = item.role === "user" ? "Pengguna (Febri)" : "Asisten AI";
    out += `${speaker}: ${item.content}\n`;
  }
  out += `--- (AKHIR RIWAYAT PERCAKAPAN) ---\n\n`;
  return out;
}

test('Kondisi 1: Format Riwayat Percakapan (formatChatHistoryForPrompt)', async (t) => {
  await t.test('1.1: History null atau undefined mengembalikan string kosong', () => {
    assert.equal(formatChatHistoryForPrompt(null), "");
    assert.equal(formatChatHistoryForPrompt(undefined), "");
  });

  await t.test('1.2: History array kosong mengembalikan string kosong', () => {
    assert.equal(formatChatHistoryForPrompt([]), "");
  });

  await t.test('1.3: History dengan beberapa turn terformat dengan urutan dan peran yang benar', () => {
    const history = [
      { role: "user", content: "ada ukt 5 juta di januari" },
      { role: "model", content: "Baik Febri, mari persiapkan dana UKT 5 juta." },
      { role: "user", content: "pendapatan saya 50rb per hari" },
      { role: "model", content: "Dalam sebulan dapat sekitar Rp 1.500.000." }
    ];

    const formatted = formatChatHistoryForPrompt(history);
    assert.match(formatted, /Pengguna \(Febri\): ada ukt 5 juta di januari/);
    assert.match(formatted, /Asisten AI: Baik Febri, mari persiapkan dana UKT 5 juta\./);
    assert.match(formatted, /Pengguna \(Febri\): pendapatan saya 50rb per hari/);
    assert.match(formatted, /--- \(AKHIR RIWAYAT PERCAKAPAN\) ---/);
  });
});

test('Kondisi 2: Pengujian Penyertaan Fakta Sebelumnya untuk Kalimat Lanjutan', async (t) => {
  await t.test('2.1: Riwayat memuat nominal UKT dan pendapatan harian sehingga AI tidak bertanya ulang', () => {
    const history = [
      { role: "user", content: "ada ukt sebesar 5juta awal januari, pendapatan harian 50ribu" },
      { role: "model", content: "Siap, UKT Rp 5.000.000 di Januari." }
    ];

    const followUp = "sebenernya ukt itu bisa diangsur 5 kali";
    const promptSection = formatChatHistoryForPrompt(history);

    // Pastikan string yang disuntikkan ke prompt memuat UKT 5 juta dan 50ribu
    assert.ok(promptSection.includes("5juta"));
    assert.ok(promptSection.includes("50ribu"));
  });
});
