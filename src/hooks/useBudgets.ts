import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Budget, CategoryExpenseSummary } from '../types';

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<CategoryExpenseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const getCurrentMonthYear = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const currentMonthYear = getCurrentMonthYear();

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const [budgetRes, expenseRes] = await Promise.all([
        supabase
          .from('budgets')
          .select('*, category:category_id(name)')
          .eq('month_year', currentMonthYear),
        supabase
          .from('v_monthly_expenses_by_category')
          .select('*')
          .eq('month_year', currentMonthYear)
      ]);

      if (budgetRes.error) throw budgetRes.error;
      if (expenseRes.error) throw expenseRes.error;

      setBudgets(budgetRes.data || []);
      setExpenses(expenseRes.data || []);
    } catch (err) {
      console.error('Gagal mengambil data anggaran:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonthYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setCategoryBudget = async (categoryId: string, limitAmount: number) => {
    const { error } = await supabase.from('budgets').upsert(
      {
        category_id: categoryId,
        month_year: currentMonthYear,
        limit_amount: limitAmount
      },
      { onConflict: 'user_id,category_id,month_year' }
    );
    if (error) throw error;
    await fetchData();
  };

  const deleteBudget = async (budgetId: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
    if (error) throw error;
    await fetchData();
  };

  // Kalkulasi total
  const totalLimit = budgets.reduce((acc, b) => acc + Number(b.limit_amount || 0), 0);
  const totalSpent = expenses.reduce((acc, e) => acc + Number(e.total_expense || 0), 0);
  const totalRemaining = totalLimit > 0 ? totalLimit - totalSpent : 0;

  return {
    budgets,
    expenses,
    currentMonthYear,
    totalLimit,
    totalSpent,
    totalRemaining,
    loading,
    refreshBudgets: fetchData,
    setCategoryBudget,
    deleteBudget
  };
}
