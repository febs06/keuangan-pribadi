import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { WalletWithBalance } from '../types';

export function useWallets() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('v_wallet_balances')
        .select('*');
      if (error) throw error;
      setWallets(data || []);
    } catch (err) {
      console.error('Gagal mengambil data dompet:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const activeWallets = wallets.filter(w => !w.is_archived);
  const archivedWallets = wallets.filter(w => w.is_archived);
  const totalBalance = activeWallets.reduce((acc, w) => acc + Number(w.current_balance || 0), 0);

  const createWallet = async (name: string, initialBalance: number = 0) => {
    const { data, error } = await supabase
      .from('wallets')
      .insert({ name, initial_balance: initialBalance })
      .select()
      .single();
    if (error) throw error;
    await fetchWallets();
    return data;
  };

  const updateInitialBalance = async (id: string, initialBalance: number) => {
    const { error } = await supabase
      .from('wallets')
      .update({ initial_balance: initialBalance })
      .eq('id', id);
    if (error) throw error;
    await fetchWallets();
  };

  const toggleArchive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('wallets')
      .update({ is_archived: !currentStatus })
      .eq('id', id);
    if (error) throw error;
    await fetchWallets();
  };

  const deleteWallet = async (id: string) => {
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchWallets();
  };

  return {
    wallets,
    activeWallets,
    archivedWallets,
    totalBalance,
    loading,
    refreshWallets: fetchWallets,
    createWallet,
    updateInitialBalance,
    toggleArchive,
    deleteWallet
  };
}
