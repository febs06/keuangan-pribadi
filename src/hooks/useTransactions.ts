import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Transaction } from '../types';
import { getTodayDateString } from '../lib/format';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [todaySummary, setTodaySummary] = useState({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          wallet:wallet_id(name),
          destination_wallet:destination_wallet_id(name),
          source:source_id(name),
          category:category_id(name)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      const txs: Transaction[] = data || [];
      setTransactions(txs);

      // Hitung ringkasan hari ini
      const today = getTodayDateString();
      let inc = 0;
      let exp = 0;

      for (const t of txs) {
        const tDate = (t.date || '').split('T')[0].trim();
        if (tDate === today) {
          if (t.type === 'income') {
            inc += Number(t.amount);
          } else if (t.type === 'expense') {
            exp += Number(t.amount);
          } else if (t.type === 'transfer' && Number(t.admin_fee) > 0) {
            exp += Number(t.admin_fee);
          }
        }
      }
      setTodaySummary({ income: inc, expense: exp });
    } catch (err) {
      console.error('Gagal mengambil transaksi:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addIncome = async (params: {
    amount: number;
    wallet_id: string;
    source_id: string;
    date: string;
    notes?: string;
  }) => {
    const { error } = await supabase.from('transactions').insert({
      type: 'income',
      amount: params.amount,
      wallet_id: params.wallet_id,
      source_id: params.source_id,
      date: params.date,
      notes: params.notes || null,
      admin_fee: 0
    });
    if (error) throw error;
    localStorage.setItem('last_wallet_id', params.wallet_id);
    await fetchTransactions();
  };

  const addExpense = async (params: {
    amount: number;
    wallet_id: string;
    category_id: string;
    date: string;
    notes?: string;
  }) => {
    const { error } = await supabase.from('transactions').insert({
      type: 'expense',
      amount: params.amount,
      wallet_id: params.wallet_id,
      category_id: params.category_id,
      date: params.date,
      notes: params.notes || null,
      admin_fee: 0
    });
    if (error) throw error;
    localStorage.setItem('last_wallet_id', params.wallet_id);
    await fetchTransactions();
  };

  const addTransfer = async (params: {
    amount: number;
    wallet_id: string;
    destination_wallet_id: string;
    admin_fee: number;
    date: string;
    notes?: string;
  }) => {
    const { error } = await supabase.from('transactions').insert({
      type: 'transfer',
      amount: params.amount,
      wallet_id: params.wallet_id,
      destination_wallet_id: params.destination_wallet_id,
      admin_fee: params.admin_fee || 0,
      date: params.date,
      notes: params.notes || null
    });
    if (error) throw error;
    localStorage.setItem('last_wallet_id', params.wallet_id);
    await fetchTransactions();
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    await fetchTransactions();
  };

  return {
    transactions,
    todaySummary,
    loading,
    refreshTransactions: fetchTransactions,
    addIncome,
    addExpense,
    addTransfer,
    deleteTransaction
  };
}
