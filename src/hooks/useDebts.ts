import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Debt } from '../types';

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDebts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('is_settled', { ascending: true })
        .order('due_date', { ascending: true });
      if (error) throw error;
      setDebts(data || []);
    } catch (err) {
      console.error('Gagal mengambil data utang-piutang:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const addDebt = async (params: {
    type: 'debt' | 'receivable';
    person_name: string;
    amount: number;
    due_date?: string;
    notes?: string;
  }) => {
    const { error } = await supabase.from('debts').insert({
      type: params.type,
      person_name: params.person_name,
      amount: params.amount,
      due_date: params.due_date || null,
      notes: params.notes || null
    });
    if (error) throw error;
    await fetchDebts();
  };

  const settleDebt = async (id: string) => {
    const { error } = await supabase
      .from('debts')
      .update({
        is_settled: true,
        settled_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) throw error;
    await fetchDebts();
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw error;
    await fetchDebts();
  };

  return {
    debts,
    loading,
    refreshDebts: fetchDebts,
    addDebt,
    settleDebt,
    deleteDebt
  };
}
