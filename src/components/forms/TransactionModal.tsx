import React, { useState, useEffect } from 'react';
import type { WalletWithBalance, IncomeSource, ExpenseCategory, TransactionType } from '../../types';
import { getTodayDateString, formatNumberInput } from '../../lib/format';
import { getCategoryStyle } from '../../lib/categoryIcons';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWallets: WalletWithBalance[];
  activeSources: IncomeSource[];
  activeCategories: ExpenseCategory[];
  onAddIncome: (data: { amount: number; wallet_id: string; source_id: string; date: string; notes?: string }) => Promise<void>;
  onAddExpense: (data: { amount: number; wallet_id: string; category_id: string; date: string; notes?: string }) => Promise<void>;
  onAddTransfer: (data: { amount: number; wallet_id: string; destination_wallet_id: string; admin_fee: number; date: string; notes?: string }) => Promise<void>;
}

export function TransactionModal({
  isOpen,
  onClose,
  activeWallets,
  activeSources,
  activeCategories,
  onAddIncome,
  onAddExpense,
  onAddTransfer
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [walletId, setWalletId] = useState('');
  const [destWalletId, setDestWalletId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [adminFeeStr, setAdminFeeStr] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Inisialisasi default dompet & pilihan
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setAmountStr('');
    setAdminFeeStr('');
    setNotes('');
    setDate(getTodayDateString());

    // Ambil dompet terakhir atau dompet pertama yang aktif
    const lastWalletId = localStorage.getItem('last_wallet_id');
    const validLast = activeWallets.find(w => w.id === lastWalletId);
    const initialWalletId = validLast ? validLast.id : (activeWallets[0]?.id || '');
    setWalletId(initialWalletId);

    // Dompet tujuan default
    const destCandidate = activeWallets.find(w => w.id !== initialWalletId);
    setDestWalletId(destCandidate?.id || '');

    // Kategori default
    if (activeCategories.length > 0) {
      setCategoryId(activeCategories[0].id);
    }
    // Sumber default
    if (activeSources.length > 0) {
      setSourceId(activeSources[0].id);
    }
  }, [isOpen, activeWallets, activeCategories, activeSources]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseInt(amountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) {
      setError('Nominal belum diisi');
      return;
    }

    if (!walletId) {
      setError('Dompet belum dipilih');
      return;
    }

    setLoading(true);
    try {
      if (type === 'expense') {
        if (!categoryId) {
          setError('Kategori belum dipilih');
          setLoading(false);
          return;
        }
        await onAddExpense({ amount, wallet_id: walletId, category_id: categoryId, date, notes });
      } else if (type === 'income') {
        if (!sourceId) {
          setError('Sumber belum dipilih');
          setLoading(false);
          return;
        }
        await onAddIncome({ amount, wallet_id: walletId, source_id: sourceId, date, notes });
      } else if (type === 'transfer') {
        if (!destWalletId) {
          setError('Dompet tujuan belum dipilih');
          setLoading(false);
          return;
        }
        if (destWalletId === walletId) {
          setError('Dompet tujuan harus berbeda');
          setLoading(false);
          return;
        }
        const adminFee = adminFeeStr ? parseInt(adminFeeStr.replace(/\D/g, ''), 10) : 0;
        await onAddTransfer({
          amount,
          wallet_id: walletId,
          destination_wallet_id: destWalletId,
          admin_fee: adminFee || 0,
          date,
          notes
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan, coba lagi';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Catat Transaksi</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              minHeight: '34px',
              width: '34px',
              padding: 0,
              borderRadius: '50%',
              fontSize: '15px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--expense)', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* Pemilih tipe: Pengeluaran / Pemasukan / Transfer */}
        <div className="segment-control">
          <button
            type="button"
            className={`segment-btn ${type === 'expense' ? 'active' : ''}`}
            onClick={() => setType('expense')}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            className={`segment-btn ${type === 'income' ? 'active' : ''}`}
            onClick={() => setType('income')}
          >
            Pemasukan
          </button>
          <button
            type="button"
            className={`segment-btn ${type === 'transfer' ? 'active' : ''}`}
            onClick={() => setType('transfer')}
          >
            Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Nominal (Ketukan 1) */}
          <div className="form-group">
            <label className="form-label">Nominal (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              className="form-input form-input-amount"
              placeholder="0"
              value={amountStr}
              onChange={e => setAmountStr(formatNumberInput(e.target.value))}
              required
            />
            {/* Quick Chips Nominal Cepat */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '+10rb', val: 10000 },
                { label: '+20rb', val: 20000 },
                { label: '+50rb', val: 50000 },
                { label: '+100rb', val: 100000 }
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    const current = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
                    setAmountStr(formatNumberInput(String(current + chip.val)));
                  }}
                  className="filter-pill"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  {chip.label}
                </button>
              ))}
              {amountStr && (
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Dompet Sumber */}
          <div className="form-group">
            <label className="form-label">
              {type === 'transfer' ? 'Dari dompet' : 'Dompet'}
            </label>
            <select
              className="form-select"
              value={walletId}
              onChange={e => setWalletId(e.target.value)}
            >
              {activeWallets.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pilihan Khusus: Pengeluaran (Kategori Chips - Ketukan 2) */}
          {type === 'expense' && (
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <div className="category-chips">
                {activeCategories.map(c => {
                  const style = getCategoryStyle(c.name, 'expense');
                  const Icon = style.icon;
                  const isSelected = categoryId === c.id;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`chip-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setCategoryId(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon size={16} color={isSelected ? 'var(--accent)' : style.color} />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pilihan Khusus: Pemasukan (Sumber Chips - Ketukan 2) */}
          {type === 'income' && (
            <div className="form-group">
              <label className="form-label">Sumber</label>
              <div className="category-chips">
                {activeSources.map(s => {
                  const style = getCategoryStyle(s.name, 'income');
                  const Icon = style.icon;
                  const isSelected = sourceId === s.id;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`chip-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSourceId(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon size={16} color={isSelected ? 'var(--accent)' : style.color} />
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pilihan Khusus: Transfer */}
          {type === 'transfer' && (
            <>
              <div className="form-group">
                <label className="form-label">Ke dompet</label>
                <select
                  className="form-select"
                  value={destWalletId}
                  onChange={e => setDestWalletId(e.target.value)}
                >
                  {activeWallets
                    .filter(w => w.id !== walletId)
                    .map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Biaya admin opsional (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="0"
                  value={adminFeeStr}
                  onChange={e => setAdminFeeStr(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Tanggal & Catatan opsional */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Catatan (opsional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="mis. makan siang"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Tombol Simpan (Ketukan 3) */}
          <div style={{ marginTop: '16px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-full"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
