import React, { useState } from 'react';
import type { WalletWithBalance, ExpenseCategory, Bill } from '../types';
import { useBills } from '../hooks/useBills';
import { formatRupiah, formatDateIndo, getTodayDateString } from '../lib/format';

interface BillsProps {
  activeWallets: WalletWithBalance[];
  activeCategories: ExpenseCategory[];
  onBillPaid?: () => void;
  onBack?: () => void;
}

export function Bills({ activeWallets, activeCategories, onBillPaid, onBack }: BillsProps) {
  const {
    bills,
    totalDueThisMonth,
    totalReservePerMonth,
    loading,
    addBill,
    payBill,
    deleteBill
  } = useBills();

  // State tambah tagihan
  const calculateNextDueDate = (day: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let targetYear = currentYear;
    let targetMonth = currentMonth;
    if (day < currentDay) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    const validDay = Math.min(Math.max(day, 1), maxDays);

    const mStr = String(targetMonth + 1).padStart(2, '0');
    const dStr = String(validDay).padStart(2, '0');
    return `${targetYear}-${mStr}-${dStr}`;
  };

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [dueDay, setDueDay] = useState(1);
  const [nextDueDate, setNextDueDate] = useState(() => calculateNextDueDate(1));
  const [walletId, setWalletId] = useState(activeWallets[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');

  const handleDueDayChange = (val: number) => {
    setDueDay(val);
    if (val >= 1 && val <= 31) {
      setNextDueDate(calculateNextDueDate(val));
    }
  };

  const handleDateChange = (dateVal: string) => {
    setNextDueDate(dateVal);
    if (dateVal) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        if (!isNaN(d)) setDueDay(d);
      }
    }
  };

  // State modal bayar tagihan
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const [payCategoryId, setPayCategoryId] = useState('');
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payNotes, setPayNotes] = useState('');
  const [payingLoading, setPayingLoading] = useState(false);

  const todayStr = getTodayDateString();

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const amount = parseInt(amountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) return;

    await addBill({
      name: name.trim(),
      amount,
      interval_months: Number(intervalMonths) || 1,
      due_day: Number(dueDay) || 1,
      next_due_date: nextDueDate,
      wallet_id: walletId || undefined,
      category_id: categoryId || undefined
    });

    setName('');
    setAmountStr('');
  };

  const openPayModal = (bill: Bill) => {
    setPayingBill(bill);
    setPayAmountStr(String(bill.amount));
    setPayWalletId(bill.wallet_id || (activeWallets[0]?.id || ''));
    setPayCategoryId(bill.category_id || (activeCategories.find(c => c.name === 'Tagihan')?.id || activeCategories[0]?.id || ''));
    setPayDate(getTodayDateString());
    setPayNotes(`Bayar ${bill.name}`);
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    const amount = parseInt(payAmountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) return;

    setPayingLoading(true);
    try {
      await payBill({
        bill_id: payingBill.id,
        amount,
        wallet_id: payWalletId,
        category_id: payCategoryId,
        date: payDate,
        notes: payNotes
      });
      setPayingBill(null);
      if (onBillPaid) onBillPaid();
    } finally {
      setPayingLoading(false);
    }
  };

  return (
    <div className="content-area">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
          style={{ minHeight: '34px', padding: '4px 10px', fontSize: '13px', alignSelf: 'flex-start' }}
        >
          ← Kembali
        </button>
      )}

      {/* Ringkasan Tagihan */}
      <div className="card">
        <div className="card-title">Ringkasan Tagihan</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Jatuh Tempo Bulan Ini</div>
            <div className="amount-text" style={{ textAlign: 'left', fontSize: '17px' }}>
              {formatRupiah(totalDueThisMonth)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sisihkan per Bulan</div>
            <div className="amount-text" style={{ textAlign: 'left', fontSize: '17px' }}>
              {formatRupiah(totalReservePerMonth)}
            </div>
          </div>
        </div>
      </div>

      {/* Form Tambah Tagihan Baru */}
      <div className="card">
        <div className="card-title">Tambah Tagihan Wajib</div>
        <form onSubmit={handleAddBill}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Nama tagihan (mis. YT Music, UKT, Listrik)"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input
              type="number"
              placeholder="Nominal (Rp)"
              className="form-input"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              required
            />
            <select
              className="form-select"
              value={intervalMonths}
              onChange={e => setIntervalMonths(Number(e.target.value))}
            >
              <option value="1">1 Bulan sekali</option>
              <option value="2">2 Bulan sekali</option>
              <option value="3">3 Bulan sekali</option>
              <option value="6">6 Bulan sekali (Semester)</option>
              <option value="12">12 Bulan sekali (Tahunan)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select
              className="form-select"
              value={walletId}
              onChange={e => setWalletId(e.target.value)}
            >
              <option value="">Pilih dompet bawaan</option>
              {activeWallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">Pilih kategori</option>
              {activeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Jatuh tempo tgl (1-31):</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-input"
                value={dueDay}
                onChange={e => handleDueDayChange(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Jatuh tempo terdekat:</label>
              <input
                type="date"
                className="form-input"
                value={nextDueDate}
                onChange={e => handleDateChange(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" style={{ minHeight: '38px', fontSize: '13px' }}>
            Tambah Tagihan
          </button>
        </form>
      </div>

      {/* Daftar Tagihan */}
      <div className="card">
        <div className="card-title">Daftar Tagihan</div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Memuat...</div>
        ) : bills.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Belum ada tagihan</div>
        ) : (
          <div>
            {bills.map(b => {
              const isOverdue = b.next_due_date < todayStr;
              const isToday = b.next_due_date === todayStr;

              return (
                <div key={b.id} className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{b.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        ({b.interval_months} bln)
                      </span>
                    </div>
                    <span className="amount-text">{formatRupiah(Number(b.amount))}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Jatuh tempo: {formatDateIndo(b.next_due_date)}
                      </span>
                      {isOverdue && (
                        <span className="badge" style={{ backgroundColor: 'var(--expense)', color: '#ffffff' }}>
                          Terlambat
                        </span>
                      )}
                      {isToday && (
                        <span className="badge" style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}>
                          Hari ini
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => openPayModal(b)}
                        className="btn btn-primary"
                        style={{ minHeight: '30px', padding: '2px 8px', fontSize: '11px' }}
                      >
                        Tandai Dibayar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBill(b.id)}
                        className="btn btn-danger"
                        style={{ minHeight: '30px', padding: '2px 8px', fontSize: '11px' }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tandai Dibayar */}
      {payingBill && (
        <div className="modal-backdrop" onClick={() => setPayingBill(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Bayar Tagihan: {payingBill.name}</h2>
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="btn btn-secondary"
                style={{ minHeight: '30px', padding: '2px 8px' }}
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleConfirmPay}>
              <div className="form-group">
                <label className="form-label">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  className="form-input form-input-amount"
                  value={payAmountStr}
                  onChange={e => setPayAmountStr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sumber Dompet</label>
                <select
                  className="form-select"
                  value={payWalletId}
                  onChange={e => setPayWalletId(e.target.value)}
                  required
                >
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select
                  className="form-select"
                  value={payCategoryId}
                  onChange={e => setPayCategoryId(e.target.value)}
                  required
                >
                  {activeCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Bayar</label>
                <input
                  type="date"
                  className="form-input"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={payingLoading}
                className="btn btn-primary btn-full"
                style={{ marginTop: '12px' }}
              >
                {payingLoading ? 'Menyimpan...' : 'Konfirmasi Bayar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
