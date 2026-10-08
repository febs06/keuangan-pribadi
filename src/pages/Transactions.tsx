import { useState, useMemo } from 'react';
import type { Transaction, WalletWithBalance } from '../types';
import { formatRupiah, formatDateIndo, getTodayDateString, addDaysToDateKey } from '../lib/format';
import { getCategoryStyle } from '../lib/categoryIcons';
import { useToast } from '../components/common/Toast';
import { Search, Trash2, Plus } from 'lucide-react';

interface TransactionsProps {
  transactions: Transaction[];
  activeWallets: WalletWithBalance[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  onRestoreTransaction?: (tx: Transaction) => Promise<void>;
}

export function Transactions({
  transactions,
  activeWallets,
  onDeleteTransaction,
  onOpenAddModal,
  onRestoreTransaction
}: TransactionsProps) {
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { showToast } = useToast();

  // Filter transaksi
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchWallet =
        selectedWalletFilter === 'all' ||
        t.wallet_id === selectedWalletFilter ||
        t.destination_wallet_id === selectedWalletFilter;

      const matchType =
        selectedTypeFilter === 'all' || t.type === selectedTypeFilter;

      let matchSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const catName = t.category?.name?.toLowerCase() || '';
        const srcName = t.source?.name?.toLowerCase() || '';
        const notes = t.notes?.toLowerCase() || '';
        const walletName = t.wallet?.name?.toLowerCase() || '';
        const amountStr = String(t.amount);

        matchSearch =
          catName.includes(q) ||
          srcName.includes(q) ||
          notes.includes(q) ||
          walletName.includes(q) ||
          amountStr.includes(q);
      }

      return matchWallet && matchType && matchSearch;
    });
  }, [transactions, selectedWalletFilter, selectedTypeFilter, searchQuery]);

  // Kelompokkan transaksi berdasarkan tanggal (WIB / tanggal lokal perangkat)
  const groupedTransactions = useMemo(() => {
    const today = getTodayDateString();
    const yesterdayStr = addDaysToDateKey(today, -1);

    const groups: { [date: string]: Transaction[] } = {};

    for (const tx of filteredTransactions) {
      const dateKey = (tx.date || '').split('T')[0].trim();
      if (!dateKey) continue;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    }

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        let label = formatDateIndo(date);
        if (date === today) {
          label = `Hari Ini • ${label}`;
        } else if (date === yesterdayStr) {
          label = `Kemarin • ${label}`;
        }

        const items = groups[date];
        const dayExpense = items
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const dayIncome = items
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          date,
          label,
          items,
          dayExpense,
          dayIncome
        };
      });
  }, [filteredTransactions]);

  const handleDelete = async (tx: Transaction) => {
    setDeletingId(tx.id);
    try {
      await onDeleteTransaction(tx.id);
      showToast({
        message: 'Transaksi berhasil dihapus',
        type: 'info',
        action: onRestoreTransaction
          ? {
              label: 'Batalkan',
              onClick: () => onRestoreTransaction(tx)
            }
          : undefined
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="content-area">
      {/* 1. Baris Pencarian & Filter */}
      <div className="card filter-bar-card" style={{ padding: '16px' }}>
        {/* Kolom Pencarian */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Cari transaksi, pos, catatan, atau nominal..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '38px', minHeight: '42px', fontSize: '13.5px' }}
          />
        </div>

        {/* Filter Dompet & Tipe */}
        <div className="filter-controls" style={{ width: '100%', justifyContent: 'space-between' }}>
          <select
            className="form-select"
            value={selectedWalletFilter}
            onChange={e => setSelectedWalletFilter(e.target.value)}
            style={{ minHeight: '38px', fontSize: '13px', width: 'auto', minWidth: '150px' }}
          >
            <option value="all">Semua Rekening</option>
            {activeWallets.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${selectedTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('all')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`filter-pill ${selectedTypeFilter === 'income' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('income')}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`filter-pill ${selectedTypeFilter === 'expense' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('expense')}
            >
              Keluar
            </button>
            <button
              type="button"
              className={`filter-pill ${selectedTypeFilter === 'transfer' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('transfer')}
            >
              Pindah
            </button>
          </div>
        </div>
      </div>

      {/* 2. Daftar Transaksi Terkelompok */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="card-header-row" style={{ marginBottom: '10px' }}>
          <span className="card-title" style={{ marginBottom: 0 }}>
            Riwayat Transaksi ({filteredTransactions.length})
          </span>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="btn btn-primary mobile-only-btn"
            style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}
          >
            + Catat
          </button>
        </div>

        {filteredTransactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13.5px', padding: '36px 0', textAlign: 'center' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Tidak ada transaksi ditemukan
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              {searchQuery ? 'Coba gunakan kata kunci pencarian lain.' : 'Belum ada transaksi di filter ini.'}
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="btn btn-secondary"
              style={{ minHeight: '36px', fontSize: '13px' }}
            >
              <Plus size={16} /> Catat Transaksi Sekarang
            </button>
          </div>
        ) : (
          <div>
            {groupedTransactions.map(group => (
              <div key={group.date} style={{ marginBottom: '18px' }}>
                {/* Header Grup Tanggal */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '4px'
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {group.label}
                  </span>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {group.dayExpense > 0 && (
                      <span className="amount-expense" style={{ fontWeight: 500 }}>
                        Keluar {formatRupiah(group.dayExpense)}
                      </span>
                    )}
                    {group.dayExpense > 0 && group.dayIncome > 0 && (
                      <span style={{ color: 'var(--text-dim)' }}>·</span>
                    )}
                    {group.dayIncome > 0 && (
                      <span className="amount-income" style={{ fontWeight: 500 }}>
                        Masuk {formatRupiah(group.dayIncome)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Daftar Baris Transaksi per Tanggal */}
                <div className="tx-list">
                  {group.items.map(tx => {
                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    const label = isIncome
                      ? tx.source?.name || 'Pemasukan'
                      : isExpense
                      ? tx.category?.name || 'Pengeluaran'
                      : `Transfer: ${tx.wallet?.name} → ${tx.destination_wallet?.name}`;

                    const catStyle = getCategoryStyle(label, tx.type);
                    const Icon = catStyle.icon;

                    return (
                      <div key={tx.id} className="tx-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingRight: '8px' }}>
                          <div
                            className="category-avatar"
                            style={{
                              backgroundColor: catStyle.bgColor,
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px'
                            }}
                          >
                            <Icon size={19} color={catStyle.color} />
                          </div>

                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              {tx.wallet?.name || 'Rekening'}
                              {tx.notes ? ` • ${tx.notes}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              className={`amount-text ${
                                isIncome
                                  ? 'amount-income'
                                  : isExpense
                                  ? 'amount-expense'
                                  : 'amount-transfer'
                              }`}
                              style={{ fontSize: '15px' }}
                            >
                              {isIncome ? '+ ' : isExpense ? '- ' : ''}
                              {formatRupiah(tx.amount)}
                            </div>
                            {tx.type === 'transfer' && Number(tx.admin_fee) > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--expense)' }}>
                                Adm: {formatRupiah(tx.admin_fee)}
                              </div>
                            )}
                          </div>

                          <div className="tx-actions">
                            <button
                              type="button"
                              disabled={deletingId === tx.id}
                              onClick={() => handleDelete(tx)}
                              className="btn btn-secondary"
                              style={{
                                minHeight: '32px',
                                width: '32px',
                                padding: 0,
                                borderRadius: '8px',
                                color: 'var(--text-muted)'
                              }}
                              title="Hapus transaksi"
                              aria-label="Hapus transaksi"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
