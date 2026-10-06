import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RecurringRule } from '../types';

export function useRecurring() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select('*, wallet:wallet_id(name), category:category_id(name), source:source_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRules(data || []);
    } catch (err) {
      console.error('Gagal mengambil data transaksi rutin:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const addRule = async (params: {
    type: 'income' | 'expense';
    frequency: 'daily' | 'weekly' | 'monthly';
    amount: number;
    wallet_id: string;
    category_id?: string;
    source_id?: string;
    day_of_week?: number;
    day_of_month?: number;
    notes?: string;
  }) => {
    const { error } = await supabase.from('recurring_rules').insert({
      type: params.type,
      frequency: params.frequency,
      amount: params.amount,
      wallet_id: params.wallet_id,
      category_id: params.category_id || null,
      source_id: params.source_id || null,
      day_of_week: params.day_of_week ?? null,
      day_of_month: params.day_of_month ?? null,
      notes: params.notes || null
    });
    if (error) throw error;
    await fetchRules();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
    if (error) throw error;
    await fetchRules();
  };

  const toggleRuleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('recurring_rules').update({ is_active: !currentStatus }).eq('id', id);
    if (error) throw error;
    await fetchRules();
  };

  return {
    rules,
    loading,
    refreshRules: fetchRules,
    addRule,
    deleteRule,
    toggleRuleActive
  };
}
