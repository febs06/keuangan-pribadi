import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Bill, BillPayment } from '../types';
import { getTodayDateString, addDaysToDateKey } from '../lib/format';

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const [billRes, payRes] = await Promise.all([
        supabase
          .from('bills')
          .select('*, wallet:wallet_id(name), category:category_id(name)')
          .order('next_due_date', { ascending: true }),
        supabase
          .from('bill_payments')
          .select('*')
      ]);

      if (billRes.error) throw billRes.error;
      if (payRes.error) throw payRes.error;

      setBills(billRes.data || []);
      setPayments(payRes.data || []);
    } catch (err) {
      console.error('Gagal mengambil data tagihan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Tagihan yang terdekat (jatuh tempo dalam 7 hari) untuk Beranda
  const todayStr = getTodayDateString();
  const next7DaysStr = addDaysToDateKey(todayStr, 7);

  const nearestBill = bills.find(b => {
    if (!b.is_active) return false;
    return b.next_due_date >= todayStr && b.next_due_date <= next7DaysStr;
  });

  // Ringkasan: Total jatuh tempo bulan ini & Sisihkan per bulan
  const currentMonth = todayStr.substring(0, 7); // "YYYY-MM"
  let totalDueThisMonth = 0;
  let totalReservePerMonth = 0;

  for (const b of bills) {
    if (b.is_active) {
      // Sisihkan per bulan dibulatkan ke atas
      totalReservePerMonth += Math.ceil(Number(b.amount) / Number(b.interval_months || 1));

      if (b.next_due_date.startsWith(currentMonth)) {
        totalDueThisMonth += Number(b.amount);
      }
    }
  }

  const addBill = async (params: {
    name: string;
    amount: number;
    interval_months: number;
    due_day: number;
    next_due_date: string;
    wallet_id?: string;
    category_id?: string;
    remind_days_before?: number;
  }) => {
    const { error } = await supabase.from('bills').insert({
      name: params.name,
      amount: params.amount,
      interval_months: params.interval_months || 1,
      due_day: params.due_day,
      next_due_date: params.next_due_date,
      wallet_id: params.wallet_id || null,
      category_id: params.category_id || null,
      remind_days_before: params.remind_days_before ?? 3
    });
    if (error) throw error;
    await fetchBills();
  };

  const payBill = async (params: {
    bill_id: string;
    amount: number;
    wallet_id: string;
    category_id: string;
    date: string;
    notes?: string;
  }) => {
    const { data, error } = await supabase.rpc('pay_bill', {
      p_bill_id: params.bill_id,
      p_amount: params.amount,
      p_wallet_id: params.wallet_id,
      p_category_id: params.category_id,
      p_date: params.date,
      p_notes: params.notes || null
    });
    if (error) throw error;
    await fetchBills();
    return data;
  };

  const deleteBill = async (id: string) => {
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) throw error;
    await fetchBills();
  };

  const toggleBillActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('bills').update({ is_active: !currentStatus }).eq('id', id);
    if (error) throw error;
    await fetchBills();
  };

  return {
    bills,
    payments,
    nearestBill,
    totalDueThisMonth,
    totalReservePerMonth,
    loading,
    refreshBills: fetchBills,
    addBill,
    payBill,
    deleteBill,
    toggleBillActive
  };
}
