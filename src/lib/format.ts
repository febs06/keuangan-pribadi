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

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
