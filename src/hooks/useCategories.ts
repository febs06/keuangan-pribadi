import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { IncomeSource, ExpenseCategory } from '../types';

export function useCategories() {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const [srcRes, catRes] = await Promise.all([
        supabase.from('income_sources').select('*').order('created_at', { ascending: true }),
        supabase.from('expense_categories').select('*').order('created_at', { ascending: true })
      ]);

      if (srcRes.error) throw srcRes.error;
      if (catRes.error) throw catRes.error;

      setSources(srcRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Gagal mengambil kategori/sumber:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeSources = sources.filter(s => !s.is_archived);
  const activeCategories = categories.filter(c => !c.is_archived);

  const createSource = async (name: string, isDailyRoutine: boolean = false) => {
    const { error } = await supabase
      .from('income_sources')
      .insert({ name, is_daily_routine: isDailyRoutine });
    if (error) throw error;
    await fetchData();
  };

  const createCategory = async (name: string) => {
    const { error } = await supabase
      .from('expense_categories')
      .insert({ name });
    if (error) throw error;
    await fetchData();
  };

  const toggleSourceArchive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('income_sources')
      .update({ is_archived: !currentStatus })
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const toggleCategoryArchive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('expense_categories')
      .update({ is_archived: !currentStatus })
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const toggleDailyRoutine = async (id: string, currentRoutine: boolean) => {
    const { error } = await supabase
      .from('income_sources')
      .update({ is_daily_routine: !currentRoutine })
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  return {
    sources,
    categories,
    activeSources,
    activeCategories,
    loading,
    refreshCategories: fetchData,
    createSource,
    createCategory,
    toggleSourceArchive,
    toggleCategoryArchive,
    toggleDailyRoutine
  };
}
