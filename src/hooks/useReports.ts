import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { MonthlySummary, CategoryExpenseSummary, IncomeSourceSummary, Transaction } from '../types';
import { getTodayDateString } from '../lib/format';

export function useReports() {
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthExpenses, setMonthExpenses] = useState<CategoryExpenseSummary[]>([]);
  const [monthIncome, setMonthIncome] = useState<IncomeSourceSummary[]>([]);
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [loading, setLoading] = useState(true);

  // Ambil ringkasan bulanan dari view
  const fetchSummaries = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('v_monthly_summary')
        .select('*')
        .order('month_year', { ascending: false })
        .limit(monthRange);

      if (error) throw error;
      const reversed = (data || []).reverse(); // Urutkan dari bulan terlama ke terbaru untuk grafik
      setMonthlySummaries(reversed);

      // Default pilih bulan terakhir jika belum dipilih
      if (reversed.length > 0 && !selectedMonth) {
        setSelectedMonth(reversed[reversed.length - 1].month_year);
      }
    } catch (err) {
      console.error('Gagal mengambil ringkasan bulanan:', err);
    } finally {
      setLoading(false);
    }
  }, [monthRange, selectedMonth]);

  // Ambil rincian kategori dan sumber untuk bulan yang dipilih
  const fetchMonthDetails = useCallback(async (mYear: string) => {
    if (!isSupabaseConfigured || !mYear) return;
    try {
      const [expRes, incRes] = await Promise.all([
        supabase
          .from('v_monthly_expenses_by_category')
          .select('*')
          .eq('month_year', mYear)
          .order('total_expense', { ascending: false }),
        supabase
          .from('v_monthly_income_by_source')
          .select('*')
          .eq('month_year', mYear)
          .order('total_income', { ascending: false })
      ]);

      if (expRes.error) throw expRes.error;
      if (incRes.error) throw incRes.error;

      setMonthExpenses(expRes.data || []);
      setMonthIncome(incRes.data || []);
    } catch (err) {
      console.error('Gagal mengambil rincian bulan:', err);
    }
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  useEffect(() => {
    if (selectedMonth) {
      fetchMonthDetails(selectedMonth);
    }
  }, [selectedMonth, fetchMonthDetails]);

  // Ekspor CSV
  const exportTransactionsToCSV = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        date,
        type,
        amount,
        admin_fee,
        notes,
        wallet:wallet_id(name),
        destination_wallet:destination_wallet_id(name),
        category:category_id(name),
        source:source_id(name)
      `)
      .order('date', { ascending: false });

    if (error) throw error;
    const txs = data as unknown as Transaction[];

    const headers = ['Tanggal', 'Tipe', 'Nominal', 'Dompet', 'Tujuan Transfer', 'Biaya Admin', 'Kategori/Sumber', 'Catatan'];
    const rows = txs.map(t => {
      const label = t.type === 'income'
        ? t.source?.name || 'Pemasukan'
        : t.type === 'expense'
        ? t.category?.name || 'Pengeluaran'
        : 'Transfer';

      return [
        t.date,
        t.type,
        t.amount,
        t.wallet?.name || '',
        t.destination_wallet?.name || '',
        t.admin_fee || 0,
        label,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transaksi_keuangan_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    monthlySummaries,
    selectedMonth,
    setSelectedMonth,
    monthExpenses,
    monthIncome,
    monthRange,
    setMonthRange,
    loading,
    refreshReports: fetchSummaries,
    exportTransactionsToCSV
  };
}
