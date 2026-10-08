# Laporan Perbaikan Lanjutan Aplikasi Keuangan Pribadi
**Stack**: React 19 + TypeScript + Vite + Vanilla CSS + Supabase  
**Commit**: `9a21d26` (*fix: tanggal lokal WIB, teks RLS, polesan UI*)  
**Status Build**: ✅ Lolos (`npm run build` exit code 0)  
**Integritas Database & Bot**: ✅ 100% Utuh (Tanpa modifikasi schema, RPC `fn_bot_*`, bot Telegram, maupun alur n8n)

---

## Ringkasan Eksekutif Hasil Pekerjaan

| # | Poin Perbaikan | Status | File yang Disentuh | Dampak Utama |
|---|---|:---:|---|---|
| **1** | **[BUG] Label Tanggal "Hari Ini" / "Kemarin"** | ✅ Tuntas | `src/lib/format.ts`<br>`src/pages/Transactions.tsx`<br>`src/hooks/useBills.ts`<br>`src/hooks/useReports.ts`<br>`src/hooks/useTransactions.ts` | Mengeliminasi pergeseran tanggal akibat UTC `toISOString()`. Label "Hari Ini" dan "Kemarin" akurat 24 jam, termasuk rentang dini hari 00:00 - 07:00 WIB. |
| **2** | **Koreksi Teks RLS** | ✅ Tuntas | `src/pages/Home.tsx`<br>`src/pages/More.tsx` | Mengganti rujukan "Terenkripsi RLS" menjadi "Data tersinkron" dan klarifikasi status sesi akun pengguna pribadi. |
| **3** | **Grid Kartu Statistik Beranda** | ✅ Tuntas | `src/index.css` | 3 kartu metrik sekunder diatur menjadi 3 kolom sama lebar di desktop (tanpa sel kosong di kanan) dan 1 kolom di ponsel. |
| **4** | **Tombol Hapus Anggaran + Undo** | ✅ Tuntas | `src/pages/Budgets.tsx` | Mengganti tombol teks merah ramai menjadi ikon tempat sampah minimalis (`Trash2`) dengan jeda hapus database 4.5 detik dan aksi "Batalkan" via Toast. |
| **5** | **Subtotal Berlabel di Header Transaksi** | ✅ Tuntas | `src/pages/Transactions.tsx` | Format subtotal ambigu diubah menjadi `"Keluar Rp X · Masuk Rp Y"` dan menyembunyikan nominal yang bernilai 0. |
| **6** | **Legenda Donut Chart Laporan** | ✅ Tuntas | `src/components/charts/CategoryDonutChart.tsx` | Legenda disusun vertikal di bawah donut: 1 baris per kategori (titik warna, nama, nominal, dan persen rata kanan `tabular-nums`). |
| **7** | **Pembersihan Ring Fokus (:focus-visible)** | ✅ Tuntas | `src/index.css` | Outline ring fokus hanya muncul saat navigasi keyboard (`:focus-visible`), tidak lagi tertinggal saat klik mouse atau touch. |
| **8** | **Grid Menu Pengaturan Desktop** | ✅ Tuntas | `src/index.css` | Mengubah grid menu pengaturan PC menjadi 2 kolom simetris (2x2) sehingga tidak ada sel ganjil kosong di kanan. |

---

## Rincian Perbaikan per Nomor

### 1. [BUG, Prioritas Tertinggi] Label Tanggal "Kemarin" & "Hari Ini" Salah
- **Gejala & Penyebab**:
  - Pada implementasi sebelumnya di `Transactions.tsx`, tanggal kemarin dihitung dengan:
    ```typescript
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    ```
  - Pada pukul 00:00 – 06:59 WIB (UTC+7), jam lokal berada di hari H (misalnya 9 Okt 00:20 WIB). Pengurangan 1 hari mengubahnya ke 8 Okt 00:20 WIB. Namun pemanggilan `.toISOString()` mengonversi jam tersebut ke UTC (-7 jam), menjadi 7 Okt 17:20 UTC. Akibatnya, `yesterdayStr` menjadi `"2026-10-07"` (mundur 2 hari).
  - Transaksi hari ini juga tidak mendapatkan label karena `tx.date` dari database berisi offset/timestamp yang tidak dinormalisasi sebelum dibandingkan dengan `today`.
- **Solusi yang Diterapkan**:
  1. Dibuat helper tanggal kalender lokal murni di `src/lib/format.ts`:
     - `getLocalDateKey(date = new Date()): string`: Mengembalikan `YYYY-MM-DD` murni dari `getFullYear()`, `getMonth() + 1`, dan `getDate()`.
     - `addDaysToDateKey(dateKey: string, days: number): string`: Menambah/mengurangi hari dengan kalender lokal tanpa melewati konversi zona waktu UTC.
     - `getTodayDateString(): string`: Menggunakan `getLocalDateKey(new Date())`.
  2. Di `src/pages/Transactions.tsx`:
     - Normalisasi kunci tanggal transaksi: `const dateKey = (tx.date || '').split('T')[0].trim()`.
     - Pencocokan label: `date === today ? "Hari Ini • " + label : date === yesterdayStr ? "Kemarin • " + label : label`.
  3. Pembersihan pemanggilan `toISOString()` lainnya di `src/hooks/useBills.ts` (`next7DaysStr = addDaysToDateKey(todayStr, 7)`) dan `src/hooks/useReports.ts` (nama file ekspor CSV).
- **Hasil Pengujian**:
  - Dini hari 00:30 WIB: Hari ini = `2026-10-09`, Kemarin = `2026-10-08` (Tepat).
  - Malam hari 23:30 WIB: Hari ini = `2026-10-09`, Kemarin = `2026-10-08` (Tepat).
  - Pergantian bulan (1 Nov 00:15 WIB): Hari ini = `2026-11-01`, Kemarin = `2026-10-31` (Tepat).

---

### 2. Teks "RLS" yang Menyesatkan
- **Latar Belakang**: RLS (*Row Level Security*) adalah mekanisme kontrol otorisasi tingkat baris pada PostgreSQL/Supabase, bukan teknologi enkripsi data.
- **Perubahan UI**:
  - `src/pages/Home.tsx`: Badge Hero Card diubah dari `<ShieldCheck /> Terenkripsi RLS` menjadi `<ShieldCheck /> Data tersinkron`.
  - `src/pages/More.tsx`: Keterangan sesi diubah dari `"Terkoneksi aman dengan enkripsi RLS database Supabase."` menjadi `"Masuk sebagai pengguna pribadi. Data tersimpan aman di database."`

---

### 3. Beranda: Grid Kartu Statistik
- **Masalah**: Sebelumnya di desktop, kelas `.desktop-stat-grid` disetel `grid-template-columns: repeat(4, 1fr)`. Karena hanya ada Hero Card (merentang penuh 1 / -1) dan 3 kartu metrik sekunder (Pemasukan, Pengeluaran, Sisa Anggaran), kolom ke-4 di sebelah kanan kosong.
- **Perubahan di `src/index.css`**:
  - **Mobile (<768px)**: `grid-template-columns: 1fr;` (1 kolom tersusun vertikal).
  - **Desktop (≥768px)**: `grid-template-columns: repeat(3, 1fr) !important;`. Hero Card di atas merentang penuh, dan 3 kartu metrik di bawahnya membagi lebar layar secara seimbang 3 kolom sama rata (1fr 1fr 1fr).

---

### 4. Anggaran: Tombol Hapus dengan Ikon Minimalis & Undo
- **Masalah**: Tombol "Hapus" merah berteks di tiap baris anggaran visualnya terlalu mencolok dan tidak memiliki mekanisme pemulihan jika salah klik.
- **Solusi di `src/pages/Budgets.tsx`**:
  1. Diganti dengan tombol ikon minimalis `<Trash2 size={15} />` (`btn-secondary`, warna abu-abu muted).
  2. Mekanisme **Delayed Execution + Optimistic UI**:
     - Saat diklik, ID anggaran dimasukkan ke `pendingDeleteIds` sehingga langsung hilang dari tampilan seketika.
     - Toast interaktif dimunculkan: `"Batas anggaran '[Kategori]' dihapus"` dengan tombol `"Batalkan"`.
     - Request penghapusan riil ke Supabase `deleteBudget(id)` ditunda menggunakan `setTimeout` selama **4,5 detik**.
     - Jika pengguna mengklik `"Batalkan"`, timer dibatalkan (`clearTimeout`), anggaran dipulihkan ke tampilan, dan tidak ada query hapus yang dikirim ke database.

---

### 5. Transaksi: Subtotal per Tanggal Berlabel
- **Masalah**: Header tanggal sebelumnya menampilkan subtotal ambigu: `"- Rp 42.000  + Rp 50.000"`.
- **Solusi di `src/pages/Transactions.tsx`**:
  - Header tanggal sekarang menampilkan format berlabel semantik:
    - Jika ada keluar dan masuk: `"Keluar Rp 42.000 · Masuk Rp 50.000"`
    - Jika hanya keluar: `"Keluar Rp 42.000"`
    - Jika hanya masuk: `"Masuk Rp 50.000"`
  - Nilai 0 otomatis disembunyikan agar header tetap ringkas.

---

### 6. Laporan: Legenda Donut Chart Rapi
- **Masalah**: Legenda donut chart sebelumnya menggunakan grid 2 kolom melayang di mana nama kategori dan persentase terpisah jauh.
- **Solusi di `src/components/charts/CategoryDonutChart.tsx`**:
  - Legenda ditata ulang menjadi daftar vertikal rapi di bawah donut chart.
  - Setiap baris memiliki tata letak fleksibel:
    - Kiri: Titik warna kategori (`10px` bulat) + nama kategori (terpotong elipsis jika panjang).
    - Kanan: Nominal belanja lengkap (`formatRupiah()`) dan persentase (`X%`) rata kanan dengan `tabular-nums`.
  - Warna kategori konsisten dengan ikon transaksi via `getCategoryStyle()`.
  - Efek hover pada baris legenda tersinkronisasi dua arah dengan slice lingkaran SVG.

---

### 7. Pembersihan Ring Fokus (:focus-visible)
- **Masalah**: Pada beberapa browser, tab navigasi atau tombol mempertahankan ring fokus bawaan setelah diklik dengan mouse.
- **Solusi di `src/index.css`**:
  - Menerapkan aturan selektor:
    ```css
    button:focus:not(:focus-visible),
    a:focus:not(:focus-visible),
    .nav-item:focus:not(:focus-visible),
    .desktop-nav-link:focus:not(:focus-visible),
    .btn:focus:not(:focus-visible),
    .chip-btn:focus:not(:focus-visible),
    .filter-pill:focus:not(:focus-visible),
    .menu-card:focus:not(:focus-visible),
    :focus:not(:focus-visible) {
      outline: none !important;
      box-shadow: none !important;
    }

    :focus-visible {
      outline: 2px solid var(--accent) !important;
      outline-offset: 2px !important;
    }
    ```
  - Klik mouse / touch tidak lagi memicu outline ring, namun aksesibilitas navigasi keyboard (tombol Tab) tetap terjaga dengan outline aksen biru.

---

### 8. Pengaturan: Grid Menu Desktop Simetris
- **Perubahan di `src/index.css`**:
  - Mengubah `.more-menu-grid` pada breakpoint desktop (`min-width: 768px`) dari `repeat(3, 1fr)` menjadi `repeat(2, 1fr) !important`.
  - Grup menu utama yang berisi 4 item (Dompet, Kategori & Pos, Utang & Piutang, Target Tabungan) tersusun rapi dalam matriks 2 baris x 2 kolom (penuh dan simetris, tanpa sel kosong ganjil di kanan).

---

## Verifikasi & Validasi Kualitas

1. **Uji Kompilasi & Build**:
   ```bash
   npm run build
   # vite v6.4.4 building for production...
   # ✓ 1982 modules transformed.
   # dist/assets/index-iyDuJkn4.css   16.70 kB │ gzip:   3.98 kB
   # dist/assets/index-CXaKmV61.js   577.84 kB │ gzip: 156.69 kB
   # ✓ built in 3.28s (Exit code: 0)
   ```
2. **Uji Logika Tanggal**: Menggunakan simulasi mock `Date` pada jam dini hari 00:30 WIB, jam malam 23:30 WIB, serta pergantian bulan 1 November. Seluruh hasil `todayKey` dan `yesterdayKey` terbukti konsisten dan akurat.
3. **Uji Mekanisme Undo**: Batas anggaran yang dihapus dapat dipulihkan secara instan saat tombol "Batalkan" diklik dalam rentang 4.5 detik.
4. **Kebersihan Perubahan Git**:
   - `git status` bersih (`working tree clean`).
   - Tidak ada file database, trigger, schema, RPC `fn_bot_*`, webhook n8n, maupun file bot Telegram yang termodifikasi.
