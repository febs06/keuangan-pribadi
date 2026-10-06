import type { WalletWithBalance, Transaction } from '../types';
import { formatRupiah, formatDateIndo } from '../lib/format';

interface HomeProps {
  activeWallets: WalletWithBalance[];
  totalBalance: number;
  todaySummary: { income: number; expense: number };
  recentTransactions: Transaction[];
  totalBudgetRemaining?: number;
  hasBudget?: boolean;
  nearestBill?: { name: string; amount: number; next_due_date: string } | null;
  onOpenAddModal: () => void;
  onNavigateToBills?: () => void;
  onNavigateToTransactions?: () => void;
}

export function Home({
  activeWallets,
  totalBalance,
  todaySummary,
  recentTransactions,
  totalBudgetRemaining = 0,
  hasBudget = false,
  nearestBill,
  onOpenAddModal,
  onNavigateToBills,
  onNavigateToTransactions
}: HomeProps) {
  return (
    <div className="content-area">
      {/* 1. Baris Metrik Utama (4 Kartu di PC, 2 Kolom di Mobile) */}
      <div className="desktop-stat-grid">
        <div className="card stat-card">
          <div className="stat-label">Total Saldo Aktif</div>
          <div className="stat-value">{formatRupiah(totalBalance)}</div>
          <div className="stat-sub">{activeWallets.length} dompet aktif</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Pemasukan Hari Ini</div>
          <div className="stat-value amount-income">{formatRupiah(todaySummary.income)}</div>
          <div className="stat-sub">Arus kas masuk</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Pengeluaran Hari Ini</div>
          <div className="stat-value amount-expense">{formatRupiah(todaySummary.expense)}</div>
          <div className="stat-sub">Arus kas keluar</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Sisa Anggaran Bulan Ini</div>
          <div className={`stat-value ${hasBudget && totalBudgetRemaining < 0 ? 'amount-expense' : ''}`}>
            {hasBudget ? formatRupiah(totalBudgetRemaining) : 'Belum diatur'}
          </div>
          <div className="stat-sub">{hasBudget ? 'Batas belanja bulanan' : 'Atur di menu Anggaran'}</div>
        </div>
      </div>

      {/* 2. Tata Letak Utama (Desktop: 2 Kolom Lebar) */}
      <div className="desktop-main-grid">
        {/* Kolom Kiri: Dompet & Tagihan */}
        <div className="main-grid-left">
          {/* Tagihan Terdekat */}
          {nearestBill && (
            <div
              className="card bill-alert-card"
              style={{ cursor: onNavigateToBills ? 'pointer' : 'default' }}
              onClick={onNavigateToBills}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="bill-tag">Pengingat Tagihan Terdekat</div>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                    {nearestBill.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Jatuh tempo: {formatDateIndo(nearestBill.next_due_date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="amount-text amount-expense" style={{ fontSize: '16px' }}>
                    {formatRupiah(Number(nearestBill.amount))}
                  </div>
                  {onNavigateToBills && (
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                      Lihat Tagihan →
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Kartu Dompet Saya */}
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>Dompet Saya</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{activeWallets.length} rekening</span>
            </div>

            {activeWallets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
                Belum ada dompet aktif. Tambahkan di menu Pengaturan.
              </div>
            ) : (
              <div className="wallet-list">
                {activeWallets.map(w => {
                  const bal = Number(w.current_balance || 0);
                  const ratio = totalBalance > 0 && bal > 0 ? Math.min(Math.round((bal / totalBalance) * 100), 100) : 0;
                  return (
                    <div key={w.id} className="wallet-card-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{w.name}</span>
                        <span className="amount-text" style={{ fontSize: '14px' }}>{formatRupiah(bal)}</span>
                      </div>
                      <div className="wallet-bar-track">
                        <div className="wallet-bar-fill" style={{ width: `${ratio}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span>Porsi dana</span>
                        <span>{ratio}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Transaksi Terakhir */}
        <div className="main-grid-right">
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>5 Transaksi Terakhir</span>
              {onNavigateToTransactions && (
                <button
                  type="button"
                  onClick={onNavigateToTransactions}
                  className="link-btn"
                >
                  Semua Riwayat →
                </button>
              )}
            </div>

            {recentTransactions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                Belum ada transaksi tercatat.
              </div>
            ) : (
              <div className="tx-list">
                {recentTransactions.slice(0, 5).map(tx => {
                  const isIncome = tx.type === 'income';
                  const isExpense = tx.type === 'expense';
                  const label = isIncome
                    ? tx.source?.name || 'Pemasukan'
                    : isExpense
                    ? tx.category?.name || 'Pengeluaran'
                    : `Transfer ke ${tx.destination_wallet?.name || 'Dompet'}`;

                  return (
                    <div key={tx.id} className="tx-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className={`tx-type-badge ${isIncome ? 'badge-inc' : isExpense ? 'badge-exp' : 'badge-trf'}`}>
                          {isIncome ? 'Masuk' : isExpense ? 'Keluar' : 'Pindah'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{label}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {formatDateIndo(tx.date)} • {tx.wallet?.name || 'Dompet'}
                            {tx.notes ? ` • ${tx.notes}` : ''}
                          </div>
                        </div>
                      </div>

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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button (hanya tampil di ponsel) */}
      <button
        type="button"
        className="floating-fab"
        onClick={onOpenAddModal}
        aria-label="Catat transaksi"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

