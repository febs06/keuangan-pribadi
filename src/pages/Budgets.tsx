import React, { useState } from 'react';
import type { ExpenseCategory } from '../types';
import { useBudgets } from '../hooks/useBudgets';
import { formatRupiah } from '../lib/format';

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

  const [selectedCatId, setSelectedCatId] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Kategori aktif yang belum punya anggaran
  const activeCategories = categories.filter(c => !c.is_archived);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;
    const limit = parseInt(limitStr.replace(/\D/g, ''), 10);
    if (!limit || limit <= 0) return;

    setSubmitting(true);
    try {
      await setCategoryBudget(selectedCatId, limit);
      setSelectedCatId('');
      setLimitStr('');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPercent = totalLimit > 0 ? Math.min(Math.round((totalSpent / totalLimit) * 100), 100) : 0;

  return (
    <div className="content-area">
      <div className="grid-responsive">
        {/* Kolom Kiri: Ringkasan & Form Input */}
        <div className="grid-col">
          {/* Ringkasan Anggaran Bulan Ini */}
          <div className="card">
            <div className="card-header-row">
              <span className="card-title" style={{ marginBottom: 0 }}>Ringkasan Bulan Ini</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentMonthYear}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Batas Anggaran</div>
                <div className="amount-text" style={{ textAlign: 'left', fontSize: '20px' }}>
                  {formatRupiah(totalLimit)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Terpakai</div>
                <div className="amount-text amount-expense" style={{ textAlign: 'left', fontSize: '20px' }}>
                  {formatRupiah(totalSpent)}
                </div>
              </div>
            </div>

            {/* Total progress bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Realisasi pengeluaran</span>
                <span>{totalPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${totalPercent}%`,
                    height: '100%',
                    backgroundColor: totalPercent >= 90 ? 'var(--expense)' : 'var(--accent)',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Sisa Anggaran:</span>
              <span className={`amount-text ${totalRemaining < 0 ? 'amount-expense' : ''}`} style={{ fontSize: '18px' }}>
                {formatRupiah(totalRemaining)}
              </span>
            </div>
          </div>

          {/* Form Tambah/Ubah Anggaran */}
          <div className="card">
            <div className="card-title">Atur Batas Anggaran Kategori</div>
            <form onSubmit={handleSaveBudget}>
              <div className="form-group">
                <label className="form-label">Kategori Pengeluaran</label>
                <select
                  className="form-select"
                  value={selectedCatId}
                  onChange={e => setSelectedCatId(e.target.value)}
                  required
                >
                  <option value="">Pilih kategori...</option>
                  {activeCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Batas Maksimal Bulanan (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 500000"
                  className="form-input"
                  value={limitStr}
                  onChange={e => setLimitStr(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-full"
                style={{ minHeight: '40px', fontSize: '13px' }}
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
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>Memuat...</div>
            ) : budgets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
                Belum ada anggaran yang diatur untuk bulan ini.
              </div>
            ) : (
              <div>
                {budgets.map(b => {
                  const spent = expenses.find(e => e.category_id === b.category_id)?.total_expense || 0;
                  const limit = Number(b.limit_amount);
                  const remaining = limit - spent;
                  const percent = Math.min(Math.round((spent / limit) * 100), 100);
                  const isWarning = percent >= 85;

                  return (
                    <div key={b.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>{b.category?.name || 'Kategori'}</span>
                          {isWarning && (
                            <span className="badge" style={{ backgroundColor: 'var(--expense)', color: '#ffffff' }}>
                              Hampir habis
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteBudget(b.id)}
                          className="btn btn-danger"
                          style={{ minHeight: '26px', padding: '2px 8px', fontSize: '11px' }}
                        >
                          Hapus
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        <span>Terpakai: {formatRupiah(spent)} ({percent}%)</span>
                        <span style={{ fontWeight: 500 }}>Sisa: {formatRupiah(remaining)}</span>
                      </div>

                      {/* Progress bar visual proporsional */}
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: isWarning ? 'var(--expense)' : 'var(--accent)',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
