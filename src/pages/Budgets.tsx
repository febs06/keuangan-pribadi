import React, { useState } from 'react';
import type { ExpenseCategory } from '../types';
import { useBudgets } from '../hooks/useBudgets';
import { formatRupiah, formatNumberInput } from '../lib/format';
import { useToast } from '../components/common/Toast';
import { getCategoryStyle } from '../lib/categoryIcons';

interface BudgetsProps {
  categories: ExpenseCategory[];
}

export function Budgets({ categories }: BudgetsProps) {
  const {
    budgets,
    expenses,
    currentMonthYear,
    totalLimit,
    totalSpent,
    totalRemaining,
    loading,
    setCategoryBudget,
    deleteBudget
  } = useBudgets();

  const { showToast } = useToast();

  const [selectedCatId, setSelectedCatId] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Kategori aktif yang belum punya anggaran
  const activeCategories = categories.filter(c => !c.is_archived);

  // Sisa hari di bulan ini untuk kalkulasi belanja aman harian
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = Math.max(daysInMonth - currentDay + 1, 1);
  const dailySafeSpend = totalRemaining > 0 ? Math.floor(totalRemaining / daysLeft) : 0;

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;
    const limit = parseInt(limitStr.replace(/\D/g, ''), 10);
    if (!limit || limit <= 0) return;

    setSubmitting(true);
    try {
      await setCategoryBudget(selectedCatId, limit);
      showToast({ message: 'Batas anggaran berhasil disimpan!', type: 'success' });
      setSelectedCatId('');
      setLimitStr('');
    } catch {
      showToast({ message: 'Gagal menyimpan batas anggaran', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: string, catId: string, limit: number, name: string) => {
    await deleteBudget(id);
    showToast({
      message: `Batas anggaran "${name}" dihapus`,
      type: 'info',
      action: {
        label: 'Batalkan',
        onClick: async () => {
          await setCategoryBudget(catId, limit);
          showToast({ message: 'Batas anggaran dipulihkan', type: 'success' });
        }
      }
    });
  };

  const totalPercent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const clampedTotalPercent = Math.min(totalPercent, 100);

  // Deteksi kategori pengeluaran yang belum memiliki batas anggaran
  const budgetedCatIds = new Set(budgets.map(b => b.category_id));
  const unbudgetedExpenses = expenses.filter(e => !budgetedCatIds.has(e.category_id) && Number(e.total_expense) > 0);

  // Helper warna progress & status
  const getBudgetStatus = (percent: number) => {
    if (percent > 100) {
      return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', label: 'Over Budget' };
    }
    if (percent >= 90) {
      return { color: 'var(--expense)', bg: 'rgba(239, 68, 68, 0.12)', label: 'Hampir Habis' };
    }
    if (percent >= 70) {
      return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'Waspada' };
    }
    return { color: 'var(--income)', bg: 'rgba(16, 185, 129, 0.12)', label: 'Aman' };
  };

  const totalStatus = getBudgetStatus(totalPercent);

  return (
    <div className="content-area">
      <div className="grid-responsive">
        {/* Kolom Kiri: Ringkasan & Form Input */}
        <div className="grid-col">
          {/* Ringkasan Anggaran Bulan Ini */}
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>Ringkasan Anggaran</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentMonthYear}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Batas Anggaran</div>
                <div className="amount-text" style={{ textAlign: 'left', fontSize: '20px' }}>
                  {formatRupiah(totalLimit)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Terpakai</div>
                <div className="amount-text amount-expense" style={{ textAlign: 'left', fontSize: '20px' }}>
                  {formatRupiah(totalSpent)}
                </div>
              </div>
            </div>

            {/* Total progress bar */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Realisasi Pengeluaran</span>
                <span style={{ fontWeight: 600, color: totalStatus.color }}>
                  {totalPercent}% ({totalStatus.label})
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-muted)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${clampedTotalPercent}%`,
                    height: '100%',
                    backgroundColor: totalStatus.color,
                    borderRadius: '999px',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Sisa Anggaran:</span>
              <span className={`amount-text ${totalRemaining < 0 ? 'amount-expense' : ''}`} style={{ fontSize: '18px' }}>
                {formatRupiah(totalRemaining)}
              </span>
            </div>

            {/* Info Belanja Aman Harian */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12.5px'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Aman dibelanjakan:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {formatRupiah(dailySafeSpend)} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '11px' }}>/ hari (sisa {daysLeft} hr)</span>
              </span>
            </div>
          </div>

          {/* Form Tambah/Ubah Anggaran */}
          <div className="card">
            <div className="card-title">Atur Batas Anggaran Kategori</div>
            <form onSubmit={handleSaveBudget}>
              <div className="form-group">
                <label className="form-label">Pilih Kategori Pengeluaran</label>
                <div className="category-chips" style={{ marginBottom: '10px' }}>
                  {activeCategories.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`chip-btn ${selectedCatId === c.id ? 'selected' : ''}`}
                      onClick={() => setSelectedCatId(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {activeCategories.length > 6 && (
                  <select
                    className="form-select"
                    value={selectedCatId}
                    onChange={e => setSelectedCatId(e.target.value)}
                  >
                    <option value="">Atau pilih kategori lainnya...</option>
                    {activeCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Batas Maksimal Bulanan (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 500.000"
                  className="form-input"
                  value={limitStr}
                  onChange={e => setLimitStr(formatNumberInput(e.target.value))}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedCatId}
                className="btn btn-primary btn-full"
                style={{ minHeight: '42px', fontSize: '13.5px' }}
              >
                {submitting ? 'Menyimpan...' : 'Simpan Batas Anggaran'}
              </button>
            </form>
          </div>
        </div>

        {/* Kolom Kanan: Daftar Anggaran per Kategori */}
        <div className="grid-col">
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>
                Daftar Anggaran Kategori ({budgets.length})
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Bulan berjalan
              </span>
            </div>

            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>Memuat data anggaran...</div>
            ) : budgets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
                <p style={{ marginBottom: '8px' }}>Belum ada anggaran yang diatur untuk bulan ini.</p>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Pilih kategori di formulir sebelah kiri untuk menentukan batas belanja.
                </p>
              </div>
            ) : (
              <div>
                {budgets.map(b => {
                  const spent = expenses.find(e => e.category_id === b.category_id)?.total_expense || 0;
                  const limit = Number(b.limit_amount);
                  const remaining = limit - spent;
                  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const clampedPercent = Math.min(percent, 100);
                  const status = getBudgetStatus(percent);
                  const catStyle = getCategoryStyle(b.category?.name || '', 'expense');
                  const Icon = catStyle.icon;

                  return (
                    <div key={b.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="category-avatar"
                            style={{
                              backgroundColor: catStyle.bgColor,
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px'
                            }}
                          >
                            <Icon size={18} color={catStyle.color} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{b.category?.name || 'Kategori'}</div>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: status.bg,
                                color: status.color,
                                fontSize: '10.5px',
                                padding: '2px 6px'
                              }}
                            >
                              {status.label}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b.id, b.category_id, limit, b.category?.name || '')}
                            className="btn btn-danger"
                            style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                            aria-label={`Hapus batas anggaran ${b.category?.name}`}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        <span>Terpakai: <strong>{formatRupiah(spent)}</strong> ({percent}%)</span>
                        <span style={{ fontWeight: 500, color: remaining < 0 ? 'var(--expense)' : 'var(--text-main)' }}>
                          Sisa: {formatRupiah(remaining)}
                        </span>
                      </div>

                      {/* Progress bar visual proporsional */}
                      <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-muted)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${clampedPercent}%`,
                            height: '100%',
                            backgroundColor: status.color,
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Menjawab Temuan Konsistensi #1: Kategori yang Dibelanjakan Tanpa Batas Anggaran */}
          {unbudgetedExpenses.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="card-header-row" style={{ marginBottom: '8px' }}>
                <span className="card-title" style={{ color: '#d97706', marginBottom: 0 }}>
                  Pengeluaran di Luar Anggaran ({unbudgetedExpenses.length})
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Belum dibatasi</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Kategori berikut memiliki transaksi tercatat bulan ini namun belum diatur batas maksimalnya:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unbudgetedExpenses.map(u => (
                  <div
                    key={u.category_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '8px'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.category_name}</span>
                      <span className="amount-text amount-expense" style={{ marginLeft: '8px', fontSize: '13px' }}>
                        {formatRupiah(Number(u.total_expense))}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ fontSize: '12px' }}
                      onClick={() => {
                        setSelectedCatId(u.category_id);
                        setLimitStr(formatNumberInput(String(Math.ceil(Number(u.total_expense) * 1.2))));
                      }}
                    >
                      + Pasang Batas
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
