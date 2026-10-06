import { useState } from 'react';
import type { Transaction, WalletWithBalance } from '../types';
import { formatRupiah, formatDateIndo } from '../lib/format';

interface TransactionsProps {
  transactions: Transaction[];
  activeWallets: WalletWithBalance[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
}

export function Transactions({
  transactions,
  activeWallets,
  onDeleteTransaction,
  onOpenAddModal
}: TransactionsProps) {
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredTransactions = transactions.filter(t => {
    const matchWallet =
      selectedWalletFilter === 'all' ||
      t.wallet_id === selectedWalletFilter ||
      t.destination_wallet_id === selectedWalletFilter;

    const matchType =
      selectedTypeFilter === 'all' || t.type === selectedTypeFilter;

    return matchWallet && matchType;
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    setDeletingId(id);
    try {
      await onDeleteTransaction(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="content-area">
      {/* Baris Filter & Ringkasan */}
      <div className="filter-bar-card">
        <div className="filter-controls">
          <select
            className="form-select"
            value={selectedWalletFilter}
            onChange={e => setSelectedWalletFilter(e.target.value)}
            style={{ minHeight: '38px', fontSize: '13px', width: 'auto', minWidth: '160px' }}
          >
            <option value="all">Semua Dompet</option>
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
              Transfer
            </button>
          </div>
        </div>

        {/* Ringkasan Filter Transaksi & Tombol Catat Mobile */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Total: <strong>{filteredTransactions.length} transaksi</strong>
          </span>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="btn btn-primary mobile-only-btn"
            style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
          >
            + Catat
          </button>
        </div>
      </div>

      {/* Kartu Daftar Transaksi */}
      <div className="card">
        <div className="card-header-row">
          <span className="card-title" style={{ marginBottom: 0 }}>
            Riwayat Transaksi ({filteredTransactions.length})
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Urut dari yang terbaru
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
            Tidak ada transaksi yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div className="tx-list">
            {filteredTransactions.map(tx => {
              const isIncome = tx.type === 'income';
              const isExpense = tx.type === 'expense';
              const label = isIncome
                ? tx.source?.name || 'Pemasukan'
                : isExpense
                ? tx.category?.name || 'Pengeluaran'
                : `Transfer: ${tx.wallet?.name} → ${tx.destination_wallet?.name}`;

              return (
                <div key={tx.id} className="tx-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, paddingRight: '12px' }}>
                    <span className={`tx-type-badge ${isIncome ? 'badge-inc' : isExpense ? 'badge-exp' : 'badge-trf'}`}>
                      {isIncome ? 'Masuk' : isExpense ? 'Keluar' : 'Transfer'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {formatDateIndo(tx.date)} • {tx.wallet?.name}
                        {tx.notes ? ` • ${tx.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

                    <button
                      type="button"
                      disabled={deletingId === tx.id}
                      onClick={() => handleDelete(tx.id)}
                      className="btn btn-danger"
                      style={{ minHeight: '30px', padding: '2px 8px', fontSize: '12px' }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

