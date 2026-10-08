import type { WalletWithBalance, Transaction } from '../types';
import { formatRupiah, formatDateIndo } from '../lib/format';
import { getCategoryStyle } from '../lib/categoryIcons';
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight, ShieldCheck, ChevronRight } from 'lucide-react';

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
  // Format periode bulan saat ini
  const now = new Date();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="content-area">
      {/* 1. Baris Hero & Metrik */}
      <div className="desktop-stat-grid">
        {/* HERO CARD: Total Saldo Finansial Monolith */}
        <div
          className="card stat-card"
          style={{
            gridColumn: '1 / -1',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px 28px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-dot)', boxShadow: '0 0 0 2px rgba(197, 168, 128, 0.25)' }} />
              <span className="stat-label">Total Saldo Finansial</span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              {currentMonthName}
            </span>
          </div>

          <div className="stat-value" style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.03em', margin: '8px 0' }}>
            {formatRupiah(totalBalance)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-dim)', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
            <span>{activeWallets.length} rekening aktif terhubung</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--income)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px', fontWeight: 600 }}>
              <ShieldCheck size={13} /> Data tersinkron
            </span>
          </div>
        </div>

        {/* METRIK SEKUNDER 1: Pemasukan Hari Ini */}
        <div className="card stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Pemasukan Hari Ini</div>
            <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={13} color="var(--income)" />
            </div>
          </div>
          <div className="stat-value amount-income" style={{ fontSize: '19px', marginTop: '4px' }}>
            {formatRupiah(todaySummary.income)}
          </div>
          <div className="stat-sub">Arus kas masuk hari ini</div>
        </div>

        {/* METRIK SEKUNDER 2: Pengeluaran Hari Ini */}
        <div className="card stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Pengeluaran Hari Ini</div>
            <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={13} color="var(--expense)" />
            </div>
          </div>
          <div className="stat-value amount-expense" style={{ fontSize: '19px', marginTop: '4px' }}>
            {formatRupiah(todaySummary.expense)}
          </div>
          <div className="stat-sub">Arus kas keluar hari ini</div>
        </div>

        {/* METRIK SEKUNDER 3: Sisa Anggaran Bulan Ini */}
        <div className="card stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Sisa Anggaran</div>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
          </div>
          <div
            className={`stat-value ${hasBudget && totalBudgetRemaining < 0 ? 'amount-expense' : ''}`}
            style={{ fontSize: '19px', marginTop: '4px' }}
          >
            {hasBudget ? formatRupiah(totalBudgetRemaining) : 'Belum diatur'}
          </div>
          <div className="stat-sub">
            {hasBudget ? 'Batas belanja bulan ini' : 'Atur di menu Anggaran'}
          </div>
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
              style={{ cursor: onNavigateToBills ? 'pointer' : 'default', padding: '16px 18px' }}
              onClick={onNavigateToBills}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="bill-tag">Pengingat Tagihan Terdekat</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px' }}>
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
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      Bayar Tagihan <ChevronRight size={13} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Kartu Dompet Saya */}
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>Dompet & Rekening</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{activeWallets.length} rekening</span>
            </div>

            {activeWallets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                Belum ada dompet aktif. Tambahkan di menu Pengaturan.
              </div>
            ) : (
              <div className="wallet-list">
                {activeWallets.map(w => {
                  const bal = Number(w.current_balance || 0);
                  const hasFunds = bal > 0 && totalBalance > 0;
                  const ratio = hasFunds ? Math.min(Math.round((bal / totalBalance) * 100), 100) : 0;

                  return (
                    <div key={w.id} className="wallet-card-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasFunds ? '6px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Wallet size={16} color="var(--accent)" />
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{w.name}</span>
                        </div>
                        <span className="amount-text" style={{ fontSize: '14px' }}>{formatRupiah(bal)}</span>
                      </div>

                      {/* Tampilkan bar hanya jika ada saldo, bukan 0% yang rusak */}
                      {hasFunds ? (
                        <>
                          <div className="wallet-bar-track">
                            <div className="wallet-bar-fill" style={{ width: `${ratio}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                            <span>Porsi dana</span>
                            <span>{ratio}%</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Saldo kosong
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: 5 Transaksi Terakhir */}
        <div className="main-grid-right">
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>5 Transaksi Terakhir</span>
              {onNavigateToTransactions && (
                <button
                  type="button"
                  onClick={onNavigateToTransactions}
                  className="link-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  Semua Riwayat <ChevronRight size={14} />
                </button>
              )}
            </div>

            {recentTransactions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13.5px', padding: '24px 0', textAlign: 'center' }}>
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
                    : `Transfer: ${tx.wallet?.name || 'Rekening'} → ${tx.destination_wallet?.name || 'Rekening'}`;

                  const catStyle = getCategoryStyle(label, tx.type);
                  const Icon = catStyle.icon;

                  return (
                    <div key={tx.id} className="tx-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          className="category-avatar"
                          style={{
                            backgroundColor: catStyle.bgColor,
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px'
                          }}
                        >
                          <Icon size={18} color={catStyle.color} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>
                            {label}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            {formatDateIndo(tx.date)} • {tx.wallet?.name || 'Rekening'}
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
                          style={{ fontSize: '14.5px' }}
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
        aria-label="Catat transaksi baru"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}
