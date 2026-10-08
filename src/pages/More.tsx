import React, { useState } from 'react';
import type { WalletWithBalance, IncomeSource, ExpenseCategory, Debt } from '../types';
import { useSavings } from '../hooks/useSavings';
import { useDebts } from '../hooks/useDebts';
import { useRecurring } from '../hooks/useRecurring';
import { formatRupiah, formatDateIndo, getTodayDateString } from '../lib/format';
import {
  Wallet as WalletIcon,
  Receipt,
  Tags,
  HandCoins,
  PiggyBank,
  Repeat,
  LogOut,
  ChevronRight
} from 'lucide-react';

type MoreSection = 'menu' | 'wallets' | 'categories' | 'savings' | 'debts' | 'recurring';

interface MoreProps {
  wallets: WalletWithBalance[];
  activeWallets: WalletWithBalance[];
  sources: IncomeSource[];
  categories: ExpenseCategory[];
  onSignOut: () => Promise<void>;
  onCreateWallet: (name: string, initialBalance?: number) => Promise<unknown>;
  onUpdateInitialBalance: (id: string, initialBalance: number) => Promise<void>;
  onToggleWalletArchive: (id: string, status: boolean) => Promise<void>;
  onDeleteWallet: (id: string) => Promise<void>;
  onCreateSource: (name: string, isDailyRoutine?: boolean) => Promise<void>;
  onToggleSourceArchive: (id: string, status: boolean) => Promise<void>;
  onToggleDailyRoutine: (id: string, status: boolean) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
  onToggleCategoryArchive: (id: string, status: boolean) => Promise<void>;
  onOpenBills: () => void;
  onAddIncome: (data: { amount: number; wallet_id: string; source_id: string; date: string; notes?: string }) => Promise<void>;
  onAddExpense: (data: { amount: number; wallet_id: string; category_id: string; date: string; notes?: string }) => Promise<void>;
}

export function More({
  wallets,
  activeWallets,
  sources,
  categories,
  onSignOut,
  onCreateWallet,
  onUpdateInitialBalance,
  onToggleWalletArchive,
  onDeleteWallet,
  onCreateSource,
  onToggleSourceArchive,
  onToggleDailyRoutine,
  onCreateCategory,
  onToggleCategoryArchive,
  onOpenBills,
  onAddIncome,
  onAddExpense
}: MoreProps) {
  const [currentSection, setCurrentSection] = useState<MoreSection>('menu');

  // Dompet
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editBalanceStr, setEditBalanceStr] = useState('');

  // Sumber & Kategori
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceRoutine, setNewSourceRoutine] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Tabungan
  const { goals, addGoal, addDeposit, deleteGoal } = useSavings();
  const [goalName, setGoalName] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmountStr, setDepositAmountStr] = useState('');

  // Utang & Piutang
  const { debts, addDebt, settleDebt, deleteDebt } = useDebts();
  const [debtType, setDebtType] = useState<'debt' | 'receivable'>('receivable');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtAmountStr, setDebtAmountStr] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [recordTxWalletId, setRecordTxWalletId] = useState(activeWallets[0]?.id || '');

  // Transaksi Rutin
  const { rules, addRule, deleteRule } = useRecurring();
  const [ruleType, setRuleType] = useState<'income' | 'expense'>('expense');
  const [ruleFreq, setRuleFreq] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [ruleAmountStr, setRuleAmountStr] = useState('');
  const [ruleWalletId, setRuleWalletId] = useState(activeWallets[0]?.id || '');
  const [ruleCatOrSrcId, setRuleCatOrSrcId] = useState('');
  const [ruleNotes, setRuleNotes] = useState('');

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const balance = parseInt(newWalletBalance.replace(/\D/g, ''), 10) || 0;
    await onCreateWallet(newWalletName.trim(), balance);
    setNewWalletName('');
    setNewWalletBalance('');
  };

  const handleSaveInitialBalance = async (id: string) => {
    const balance = parseInt(editBalanceStr.replace(/\D/g, ''), 10) || 0;
    await onUpdateInitialBalance(id, balance);
    setEditingWalletId(null);
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    await onCreateSource(newSourceName.trim(), newSourceRoutine);
    setNewSourceName('');
    setNewSourceRoutine(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await onCreateCategory(newCategoryName.trim());
    setNewCategoryName('');
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    const target = parseInt(goalTargetStr.replace(/\D/g, ''), 10);
    if (!target || target <= 0) return;
    await addGoal({ name: goalName.trim(), target_amount: target });
    setGoalName('');
    setGoalTargetStr('');
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoalId) return;
    const dep = parseInt(depositAmountStr.replace(/\D/g, ''), 10);
    if (!dep || dep <= 0) return;
    const g = goals.find(x => x.id === depositGoalId);
    if (!g) return;
    await addDeposit(g.id, Number(g.current_amount || 0), dep);
    setDepositGoalId(null);
    setDepositAmountStr('');
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtPerson.trim()) return;
    const amount = parseInt(debtAmountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) return;
    await addDebt({
      type: debtType,
      person_name: debtPerson.trim(),
      amount,
      due_date: debtDueDate || undefined
    });
    setDebtPerson('');
    setDebtAmountStr('');
    setDebtDueDate('');
  };

  const handleConfirmSettle = async (recordToWallet: boolean) => {
    if (!settlingDebt) return;
    if (recordToWallet && recordTxWalletId) {
      const today = getTodayDateString();
      if (settlingDebt.type === 'receivable') {
        const defaultSource = sources.find(s => s.name === 'Pengembalian utang' || s.name === 'Lainnya')?.id || sources[0]?.id;
        if (defaultSource) {
          await onAddIncome({
            amount: Number(settlingDebt.amount),
            wallet_id: recordTxWalletId,
            source_id: defaultSource,
            date: today,
            notes: `Pelunasan piutang: ${settlingDebt.person_name}`
          });
        }
      } else {
        const defaultCat = categories.find(c => c.name === 'Kebutuhan' || c.name === 'Lainnya')?.id || categories[0]?.id;
        if (defaultCat) {
          await onAddExpense({
            amount: Number(settlingDebt.amount),
            wallet_id: recordTxWalletId,
            category_id: defaultCat,
            date: today,
            notes: `Bayar utang: ${settlingDebt.person_name}`
          });
        }
      }
    }
    await settleDebt(settlingDebt.id);
    setSettlingDebt(null);
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(ruleAmountStr.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) return;
    await addRule({
      type: ruleType,
      frequency: ruleFreq,
      amount,
      wallet_id: ruleWalletId,
      category_id: ruleType === 'expense' ? ruleCatOrSrcId : undefined,
      source_id: ruleType === 'income' ? ruleCatOrSrcId : undefined,
      notes: ruleNotes || undefined
    });
    setRuleAmountStr('');
    setRuleNotes('');
  };

  // TOMBOL KEMBALI SUB-MENU
  const renderBackButton = (title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
      <button
        type="button"
        onClick={() => setCurrentSection('menu')}
        className="btn btn-secondary"
        style={{ minHeight: '36px', padding: '4px 12px', fontSize: '13px' }}
      >
        ← Kembali
      </button>
      <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h2>
    </div>
  );

  // 1. TAMPILAN UTAMA: MENU PILIHAN BERSIH & TERORGANISIR
  if (currentSection === 'menu') {
    const today = getTodayDateString();
    const unSettledDebtsCount = debts.filter(d => !d.is_settled).length;
    const overdueCount = debts.filter(d => !d.is_settled && d.due_date && d.due_date < today).length;

    return (
      <div className="content-area">
        {/* GRUP 1: PENGELOLAAN KEUANGAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pengelolaan Keuangan
          </div>

          <div className="more-menu-grid">
            {/* Tagihan Wajib */}
            <button type="button" className="menu-card" onClick={onOpenBills}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={20} color="#d97706" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Tagihan Wajib</div>
                    <span className="badge">Berkala</span>
                  </div>
                  <div className="menu-card-desc">Jatuh tempo bulanan & perhitungan sisihkan uang</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>

            {/* Dompet */}
            <button type="button" className="menu-card" onClick={() => setCurrentSection('wallets')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WalletIcon size={20} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Kelola Dompet & Saldo</div>
                    <span className="badge">{activeWallets.length} aktif</span>
                  </div>
                  <div className="menu-card-desc">Atur saldo awal, rekening/e-wallet, dan arsip</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>

            {/* Kategori & Sumber */}
            <button type="button" className="menu-card" onClick={() => setCurrentSection('categories')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tags size={20} color="#8b5cf6" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Kategori & Sumber</div>
                    <span className="badge">{categories.length} pos</span>
                  </div>
                  <div className="menu-card-desc">Kelola pos pengeluaran & sumber uang masuk</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>

            {/* Utang & Piutang */}
            <button type="button" className="menu-card" onClick={() => setCurrentSection('debts')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HandCoins size={20} color="#059669" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Utang & Piutang</div>
                    {overdueCount > 0 ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', color: 'var(--expense)' }}>
                        {overdueCount} lewat tempo
                      </span>
                    ) : unSettledDebtsCount > 0 ? (
                      <span className="badge" style={{ backgroundColor: 'var(--bg-muted)' }}>
                        {unSettledDebtsCount} aktif
                      </span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'var(--bg-muted)' }}>Nihil</span>
                    )}
                  </div>
                  <div className="menu-card-desc">Catatan pinjaman, jatuh tempo, dan pelunasan</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>

            {/* Target Tabungan */}
            <button type="button" className="menu-card" onClick={() => setCurrentSection('savings')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(236, 72, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PiggyBank size={20} color="#ec4899" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Target Tabungan</div>
                    <span className="badge">
                      {goals.length > 0 ? `${goals.length} target` : 'Mulai menabung'}
                    </span>
                  </div>
                  <div className="menu-card-desc">Catat progres impian tabungan pribadi</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>
          </div>
        </div>

        {/* GRUP 2: OTOMASI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Otomasi & Rutinitas
          </div>

          <div className="more-menu-grid">
            <button type="button" className="menu-card" onClick={() => setCurrentSection('recurring')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Repeat size={20} color="#0284c7" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="menu-card-title">Transaksi Rutin</div>
                    <span className="badge">{rules.length} aturan</span>
                  </div>
                  <div className="menu-card-desc">Daftar langganan berkala (harian, mingguan, bulanan)</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>
          </div>
        </div>

        {/* GRUP 3: AKUN & SESI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Akun & Keamanan
          </div>

          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14.5px' }}>Sesi Pengguna</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Terkoneksi aman dengan enkripsi RLS database Supabase.
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="btn btn-danger"
              style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              <LogOut size={15} />
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. SUB-HALAMAN: KELOLA DOMPET
  if (currentSection === 'wallets') {
    return (
      <div className="content-area">
        {renderBackButton('Kelola Dompet')}

        <div className="card">
          <div className="card-title">Daftar Dompet</div>
          <div>
            {wallets.map(w => {
              const isEditing = editingWalletId === w.id;
              return (
                <div key={w.id} className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{w.name}</span>
                      {w.is_archived && <span className="badge">Diarsipkan</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="amount-text">{formatRupiah(Number(w.current_balance || 0))}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Saldo awal: {formatRupiah(Number(w.initial_balance || 0))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Saldo awal baru"
                          value={editBalanceStr}
                          onChange={e => setEditBalanceStr(e.target.value)}
                          style={{ minHeight: '34px', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInitialBalance(w.id)}
                          className="btn btn-primary"
                          style={{ minHeight: '34px', padding: '4px 10px', fontSize: '13px' }}
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWalletId(null)}
                          className="btn btn-secondary"
                          style={{ minHeight: '34px', padding: '4px 10px', fontSize: '13px' }}
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWalletId(w.id);
                            setEditBalanceStr(String(w.initial_balance || 0));
                          }}
                          className="btn btn-secondary"
                          style={{ minHeight: '32px', padding: '2px 8px', fontSize: '12px' }}
                        >
                          Ubah Saldo Awal
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleWalletArchive(w.id, w.is_archived)}
                          className="btn btn-secondary"
                          style={{ minHeight: '32px', padding: '2px 8px', fontSize: '12px' }}
                        >
                          {w.is_archived ? 'Buka Arsip' : 'Arsipkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus dompet ${w.name}?`)) {
                              onDeleteWallet(w.id);
                            }
                          }}
                          className="btn btn-danger"
                          style={{ minHeight: '32px', padding: '2px 8px', fontSize: '12px' }}
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreateWallet} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tambah Dompet Baru</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Nama dompet"
                className="form-input"
                value={newWalletName}
                onChange={e => setNewWalletName(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Saldo awal (Rp)"
                className="form-input"
                value={newWalletBalance}
                onChange={e => setNewWalletBalance(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{ minHeight: '38px', fontSize: '13px' }}>
              Tambah Dompet
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. SUB-HALAMAN: KATEGORI & SUMBER
  if (currentSection === 'categories') {
    return (
      <div className="content-area">
        {renderBackButton('Kategori & Sumber Pemasukan')}

        <div className="card">
          <div className="card-title">Sumber Pemasukan</div>
          <div>
            {sources.map(s => (
              <div key={s.id} className="row-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  {s.is_daily_routine && <span className="badge" style={{ marginLeft: '6px' }}>Rutin harian</span>}
                  {s.is_archived && <span className="badge" style={{ marginLeft: '6px' }}>Diarsipkan</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onToggleDailyRoutine(s.id, s.is_daily_routine)}
                    className="btn btn-secondary"
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '11px' }}
                  >
                    {s.is_daily_routine ? 'Hapus Rutin' : 'Set Rutin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSourceArchive(s.id, s.is_archived)}
                    className="btn btn-secondary"
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '11px' }}
                  >
                    {s.is_archived ? 'Buka' : 'Arsip'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateSource} style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="Nama sumber baru"
                className="form-input"
                value={newSourceName}
                onChange={e => setNewSourceName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ minHeight: '38px', padding: '0 12px', fontSize: '13px' }}>
                Tambah
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={newSourceRoutine}
                onChange={e => setNewSourceRoutine(e.target.checked)}
              />
              Tandai sebagai rutin harian (pemicu pengingat harian)
            </label>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Kategori Pengeluaran</div>
          <div>
            {categories.map(c => (
              <div key={c.id} className="row-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  {c.is_system && <span className="badge" style={{ marginLeft: '6px' }}>Sistem</span>}
                  {c.is_archived && <span className="badge" style={{ marginLeft: '6px' }}>Diarsipkan</span>}
                </div>
                {!c.is_system && (
                  <button
                    type="button"
                    onClick={() => onToggleCategoryArchive(c.id, c.is_archived)}
                    className="btn btn-secondary"
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '11px' }}
                  >
                    {c.is_archived ? 'Buka' : 'Arsip'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateCategory} style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Nama kategori baru"
                className="form-input"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ minHeight: '38px', padding: '0 12px', fontSize: '13px' }}>
                Tambah
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. SUB-HALAMAN: UTANG & PIUTANG
  if (currentSection === 'debts') {
    return (
      <div className="content-area">
        {renderBackButton('Utang & Piutang')}

        <div className="card">
          <div className="card-title">Daftar Utang & Piutang</div>
          {debts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>Belum ada catatan utang/piutang</div>
          ) : (
            debts.map(d => (
              <div key={d.id} className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{d.person_name}</span>
                    <span className="badge" style={{ marginLeft: '6px' }}>
                      {d.type === 'receivable' ? 'Piutang (saya pinjami)' : 'Utang (saya pinjam)'}
                    </span>
                    {d.is_settled && <span className="badge" style={{ marginLeft: '4px', backgroundColor: 'var(--income)', color: '#fff' }}>Lunas</span>}
                  </div>
                  <span className={`amount-text ${d.type === 'receivable' ? 'amount-income' : 'amount-expense'}`}>
                    {formatRupiah(Number(d.amount))}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {d.due_date ? `Jatuh tempo: ${formatDateIndo(d.due_date)}` : 'Tanpa tempo'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!d.is_settled && (
                      <button
                        type="button"
                        onClick={() => setSettlingDebt(d)}
                        className="btn btn-primary"
                        style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                      >
                        Tandai Lunas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteDebt(d.id)}
                      className="btn btn-danger"
                      style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <form onSubmit={handleAddDebt} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tambah Catatan Baru</div>
            <div className="segment-control" style={{ marginBottom: '8px' }}>
              <button
                type="button"
                className={`segment-btn ${debtType === 'receivable' ? 'active' : ''}`}
                onClick={() => setDebtType('receivable')}
              >
                Piutang (orang berutang)
              </button>
              <button
                type="button"
                className={`segment-btn ${debtType === 'debt' ? 'active' : ''}`}
                onClick={() => setDebtType('debt')}
              >
                Utang (saya berutang)
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="Nama orang"
                className="form-input"
                value={debtPerson}
                onChange={e => setDebtPerson(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Nominal (Rp)"
                className="form-input"
                value={debtAmountStr}
                onChange={e => setDebtAmountStr(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <input
                type="date"
                className="form-input"
                value={debtDueDate}
                onChange={e => setDebtDueDate(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{ minHeight: '36px', fontSize: '13px' }}>
              Simpan Catatan
            </button>
          </form>
        </div>

        {/* Modal Konfirmasi Pelunasan */}
        {settlingDebt && (
          <div className="modal-backdrop" onClick={() => setSettlingDebt(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Konfirmasi Lunas: {settlingDebt.person_name}</h2>
                <button type="button" onClick={() => setSettlingDebt(null)} className="btn btn-secondary" style={{ minHeight: '30px', padding: '2px 8px' }}>
                  Batal
                </button>
              </div>
              <p style={{ fontSize: '14px', marginBottom: '12px' }}>
                {settlingDebt.type === 'receivable'
                  ? `Tandai piutang ${formatRupiah(Number(settlingDebt.amount))} sebagai lunas. Ingin mencatat uang masuk ke dompet?`
                  : `Tandai utang ${formatRupiah(Number(settlingDebt.amount))} sebagai lunas. Ingin mencatat uang keluar dari dompet?`}
              </p>

              <div className="form-group">
                <label className="form-label">Pilih Dompet:</label>
                <select
                  className="form-select"
                  value={recordTxWalletId}
                  onChange={e => setRecordTxWalletId(e.target.value)}
                >
                  {activeWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleConfirmSettle(true)}
                  className="btn btn-primary"
                >
                  Ya, Catat ke Dompet
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSettle(false)}
                  className="btn btn-secondary"
                >
                  Hanya Tandai Lunas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. SUB-HALAMAN: TARGET TABUNGAN
  if (currentSection === 'savings') {
    return (
      <div className="content-area">
        {renderBackButton('Target Tabungan')}

        <div className="card">
          <div className="card-title">Daftar Target Tabungan</div>
          {goals.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>Belum ada target tabungan</div>
          ) : (
            goals.map(g => {
              const current = Number(g.current_amount || 0);
              const target = Number(g.target_amount);
              const percent = Math.min(Math.round((current / target) * 100), 100);

              return (
                <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span className="amount-text">{formatRupiah(current)} / {formatRupiah(target)}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-subtle)', borderRadius: '3px', marginBottom: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositGoalId(g.id);
                        setDepositAmountStr('');
                      }}
                      className="btn btn-secondary"
                      style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                    >
                      + Setor Progres
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal(g.id)}
                      className="btn btn-danger"
                      style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {depositGoalId && (
            <form onSubmit={handleDeposit} style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', marginBottom: '6px' }}>Tambah setoran tabungan (hanya penanda progres):</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  placeholder="Nominal (Rp)"
                  className="form-input"
                  value={depositAmountStr}
                  onChange={e => setDepositAmountStr(e.target.value)}
                  style={{ minHeight: '34px', fontSize: '13px' }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}>
                  Simpan
                </button>
                <button type="button" onClick={() => setDepositGoalId(null)} className="btn btn-secondary" style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}>
                  Batal
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleAddGoal} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tambah Target Baru</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="Nama target (mis. Beli Laptop)"
                className="form-input"
                value={goalName}
                onChange={e => setGoalName(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Target nominal (Rp)"
                className="form-input"
                value={goalTargetStr}
                onChange={e => setGoalTargetStr(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{ minHeight: '36px', fontSize: '13px' }}>
              Tambah Target Tabungan
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 6. SUB-HALAMAN: TRANSAKSI RUTIN
  return (
    <div className="content-area">
      {renderBackButton('Transaksi Rutin')}

      <div className="card">
        <div className="card-title">Daftar Langganan & Rutin</div>
        {rules.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>Belum ada transaksi rutin</div>
        ) : (
          rules.map(r => (
            <div key={r.id} className="row-item">
              <div>
                <span style={{ fontWeight: 500 }}>
                  {r.notes || (r.type === 'expense' ? r.category?.name : r.source?.name) || 'Rutin'}
                </span>
                <span className="badge" style={{ marginLeft: '6px' }}>{r.frequency}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="amount-text">{formatRupiah(Number(r.amount))}</span>
                <button
                  type="button"
                  onClick={() => deleteRule(r.id)}
                  className="btn btn-danger"
                  style={{ minHeight: '26px', padding: '2px 6px', fontSize: '11px' }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}

        <form onSubmit={handleAddRule} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tambah Transaksi Rutin</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <select
              className="form-select"
              value={ruleType}
              onChange={e => setRuleType(e.target.value as 'income' | 'expense')}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
            <select
              className="form-select"
              value={ruleFreq}
              onChange={e => setRuleFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <select
              className="form-select"
              value={ruleWalletId}
              onChange={e => setRuleWalletId(e.target.value)}
            >
              {activeWallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={ruleCatOrSrcId}
              onChange={e => setRuleCatOrSrcId(e.target.value)}
            >
              <option value="">{ruleType === 'expense' ? 'Pilih kategori' : 'Pilih sumber'}</option>
              {ruleType === 'expense'
                ? categories.filter(c => !c.is_archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                : sources.filter(s => !s.is_archived).map(s => <option key={s.id} value={s.id}>{s.name}</option>)
              }
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <input
              type="number"
              placeholder="Nominal (Rp)"
              className="form-input"
              value={ruleAmountStr}
              onChange={e => setRuleAmountStr(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Catatan (mis. Netflix)"
              className="form-input"
              value={ruleNotes}
              onChange={e => setRuleNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" style={{ minHeight: '36px', fontSize: '13px' }}>
            Tambah Transaksi Rutin
          </button>
        </form>
      </div>
    </div>
  );
}
