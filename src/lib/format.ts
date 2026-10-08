export function formatRupiah(amount: number): string {
  const formatted = Math.round(amount).toLocaleString('id-ID');
  return `Rp ${formatted}`;
}

export function formatShortRupiah(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    const val = (amount / 1_000_000_000).toFixed(1).replace('.', ',');
    return `${val.replace(',0', '')} M`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(1).replace('.', ',');
    return `${val.replace(',0', '')} jt`;
  }
  if (Math.abs(amount) >= 1_000) {
    const val = (amount / 1_000).toFixed(0);
    return `${val} rb`;
  }
  return amount.toString();
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

/**
 * Mengembalikan string YYYY-MM-DD berdasarkan waktu lokal perangkat (WIB / zona lokal).
 * Menghindari bug pergeseran tanggal akibat UTC di toISOString().
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Menambah atau mengurangi hari dari string YYYY-MM-DD dengan kalkulasi tanggal lokal murni.
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  if (!dateKey) return '';
  const clean = dateKey.split('T')[0].trim();
  const [year, month, day] = clean.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

export function getTodayDateString(): string {
  return getLocalDateKey(new Date());
}

export function formatNumberInput(rawStr: string): string {
  const clean = rawStr.replace(/\D/g, '');
  if (!clean) return '';
  return Number(clean).toLocaleString('id-ID');
}

