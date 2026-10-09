import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Salin fungsi sanitizeOcrAmount persis seperti di index.ts
function sanitizeOcrAmount(val) {
  if (typeof val === "number" && !isNaN(val)) {
    return Math.round(val);
  }
  if (typeof val === "string") {
    let clean = val.replace(/[^0-9.,]/g, "").trim();
    if (!clean) return 0;
    // Format 11,112.00 atau 11.112,00
    if (clean.includes(",") && clean.includes(".")) {
      if (clean.indexOf(".") < clean.indexOf(",")) {
        clean = clean.split(",")[0].replace(/\./g, "");
      } else {
        clean = clean.split(".")[0].replace(/,/g, "");
      }
    } else if (clean.includes(",")) {
      const parts = clean.split(",");
      if (parts.length === 2 && parts[1].length === 2) {
        clean = parts[0];
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if (clean.includes(".")) {
      const parts = clean.split(".");
      if (parts.length === 2 && parts[1].length === 2) {
        clean = parts[0];
      } else {
        clean = clean.replace(/\./g, "");
      }
    }
    return parseInt(clean, 10) || 0;
  }
  return 0;
}

// Helper normalisasi MIME type persis seperti di index.ts
function resolveMimeType(headerType, filePath) {
  let mimeType = headerType || "";
  const filePathLower = (filePath || "").toLowerCase();
  if (!mimeType || mimeType.includes("octet-stream") || !mimeType.startsWith("image/")) {
    if (filePathLower.endsWith(".png")) {
      mimeType = "image/png";
    } else if (filePathLower.endsWith(".webp")) {
      mimeType = "image/webp";
    } else {
      mimeType = "image/jpeg";
    }
  }
  return mimeType;
}

describe("Kondisi 1: Ekstraksi & Sanitasi Nominal OCR (sanitizeOcrAmount)", () => {
  test("1.1: Angka bulat positif dikembalikan apa adanya", () => {
    assert.equal(sanitizeOcrAmount(11112), 11112);
    assert.equal(sanitizeOcrAmount(42000), 42000);
  });

  test("1.2: Angka string murni diubah ke integer", () => {
    assert.equal(sanitizeOcrAmount("11112"), 11112);
  });

  test("1.3: Format BCA QRIS 'IDR 11,112.00' diekstrak menjadi 11112", () => {
    assert.equal(sanitizeOcrAmount("IDR 11,112.00"), 11112);
    assert.equal(sanitizeOcrAmount("11,112.00"), 11112);
  });

  test("1.4: Format Rupiah Indonesia 'Rp 11.112,00' diekstrak menjadi 11112", () => {
    assert.equal(sanitizeOcrAmount("Rp 11.112,00"), 11112);
    assert.equal(sanitizeOcrAmount("Rp 50.000"), 50000);
  });

  test("1.5: String acak atau kosong menghasilkan 0 tanpa melempar error", () => {
    assert.equal(sanitizeOcrAmount(""), 0);
    assert.equal(sanitizeOcrAmount("unknown"), 0);
    assert.equal(sanitizeOcrAmount(null), 0);
    assert.equal(sanitizeOcrAmount(undefined), 0);
  });
});

describe("Kondisi 2: Resolusi MIME Type Gambar Telegram", () => {
  test("2.1: Header valid image/jpeg tetap dipertahankan", () => {
    assert.equal(resolveMimeType("image/jpeg", "photos/file_1.jpg"), "image/jpeg");
  });

  test("2.2: Header application/octet-stream untuk file PNG dinormalisasi ke image/png", () => {
    assert.equal(resolveMimeType("application/octet-stream", "photos/screenshot.png"), "image/png");
  });

  test("2.3: Header application/octet-stream untuk file JPG dinormalisasi ke image/jpeg", () => {
    assert.equal(resolveMimeType("application/octet-stream", "photos/file_99.jpg"), "image/jpeg");
  });

  test("2.4: Header kosong atau tanpa ekstensi default ke image/jpeg", () => {
    assert.equal(resolveMimeType("", "photos/file_unknown"), "image/jpeg");
  });
});

describe("Kondisi 3: Validasi Source Code Edge Function telegram-bot/index.ts", () => {
  const code = fs.readFileSync("supabase/functions/telegram-bot/index.ts", "utf8");

  test("3.1: Model vision menggunakan model resmi Google (gemini-2.5-flash, gemini-2.0-flash)", () => {
    assert.ok(code.includes('"gemini-2.5-flash"'), "Wajib menggunakan gemini-2.5-flash");
    assert.ok(code.includes('"gemini-2.0-flash"'), "Wajib menggunakan gemini-2.0-flash");
    assert.ok(!code.includes('"gemini-3.8-flash"'), "Model non-resmi gemini-3.8-flash harus dihapus");
  });

  test("3.2: Dilarang memuat nilai dummy hardcoded (Fashion Boras Dago, 42000)", () => {
    assert.ok(!code.includes("Fashion Boras Dago"), "Prompt tidak boleh berisi Fashion Boras Dago");
    assert.ok(!code.includes('"amount": 42000'), "Prompt tidak boleh berisi 'amount': 42000");
  });

  test("3.3: Payload multimodal menyertakan inlineData sebelum prompt", () => {
    const inlineDataIdx = code.indexOf("inlineData:");
    const promptIdx = code.indexOf("{ text: prompt }");
    assert.ok(inlineDataIdx !== -1 && promptIdx !== -1, "inlineData dan prompt harus ada");
    assert.ok(inlineDataIdx < promptIdx, "inlineData harus berada sebelum text: prompt dalam parts");
  });

  test("3.4: Pengecekan status download gambar Telegram (imageRes.ok)", () => {
    assert.ok(code.includes("if (!imageRes.ok)"), "Wajib memvalidasi imageRes.ok saat download foto");
  });
});
