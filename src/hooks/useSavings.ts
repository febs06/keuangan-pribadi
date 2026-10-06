import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { SavingsGoal } from '../types';

export function useSavings() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error('Gagal mengambil target tabungan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = async (params: { name: string; target_amount: number; target_date?: string }) => {
    const { error } = await supabase.from('savings_goals').insert({
      name: params.name,
      target_amount: params.target_amount,
      target_date: params.target_date || null
    });
    if (error) throw error;
    await fetchGoals();
  };

  const addDeposit = async (id: string, currentAmount: number, depositAmount: number) => {
    const newAmount = currentAmount + depositAmount;
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', id);
    if (error) throw error;
    await fetchGoals();
  };

  const toggleAchieved = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('savings_goals')
      .update({ is_achieved: !currentStatus })
      .eq('id', id);
    if (error) throw error;
    await fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) throw error;
    await fetchGoals();
  };

  return {
    goals,
    loading,
    refreshGoals: fetchGoals,
    addGoal,
    addDeposit,
    toggleAchieved,
    deleteGoal
  };
}
