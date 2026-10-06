import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useWallets } from './hooks/useWallets';
import { useCategories } from './hooks/useCategories';
import { useTransactions } from './hooks/useTransactions';
import { useBudgets } from './hooks/useBudgets';
import { useBills } from './hooks/useBills';
import { TopBar } from './components/common/TopBar';
import { BottomNav, type TabType } from './components/common/BottomNav';
import { TransactionModal } from './components/forms/TransactionModal';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Transactions } from './pages/Transactions';
import { Budgets } from './pages/Budgets';
import { Bills } from './pages/Bills';
import { Reports } from './pages/Reports';
import { More } from './pages/More';

export function App() {
  const { session, loading: authLoading, signIn, signUp, signOut, isConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showBillsSubScreen, setShowBillsSubScreen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    wallets,
    activeWallets,
    totalBalance,
    refreshWallets,
    createWallet,
    updateInitialBalance,
    toggleArchive: toggleWalletArchive,
    deleteWallet
  } = useWallets();

  const {
    sources,
    categories,
    activeSources,
    activeCategories,
    createSource,
    createCategory,
    toggleSourceArchive,
    toggleCategoryArchive,
    toggleDailyRoutine
  } = useCategories();

  const {
    transactions,
    todaySummary,
    addIncome,
    addExpense,
    addTransfer,
    deleteTransaction
  } = useTransactions();

  const {
    totalLimit,
    totalRemaining
  } = useBudgets();

  const {
    nearestBill,
    refreshBills
  } = useBills();

  // Handler setelah transaksi ditambahkan
  const handleAddIncome = async (data: { amount: number; wallet_id: string; source_id: string; date: string; notes?: string }) => {
    await addIncome(data);
    await refreshWallets();
  };

  const handleAddExpense = async (data: { amount: number; wallet_id: string; category_id: string; date: string; notes?: string }) => {
    await addExpense(data);
    await refreshWallets();
  };

  const handleAddTransfer = async (data: { amount: number; wallet_id: string; destination_wallet_id: string; admin_fee: number; date: string; notes?: string }) => {
    await addTransfer(data);
    await refreshWallets();
  };

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id);
    await refreshWallets();
  };

  const handleBillPaid = async () => {
    await refreshWallets();
    await refreshBills();
  };

  if (!isConfigured) {
    return (
      <div className="content-area" style={{ justifyContent: 'center', minHeight: '80vh' }}>
        <div className="card">
          <div className="card-title">Setup Supabase Diperlukan</div>
          <p style={{ fontSize: '14px', marginBottom: '12px' }}>
            Aplikasi belum terhubung ke database Supabase.
          </p>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            1. Buat proyek baru di <strong>supabase.com</strong><br />
            2. Jalankan migration SQL di folder <code>supabase/migrations/</code><br />
            3. Buat file <code>.env</code> di root proyek dengan menyalin isi <code>.env.example</code><br />
            4. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="content-area" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Memuat...</div>
      </div>
    );
  }

  if (!session) {
    return <Login onSignIn={signIn} onSignUp={signUp} />;
  }

  const getPageTitle = () => {
    if (showBillsSubScreen) return 'Tagihan Wajib';
    switch (activeTab) {
      case 'home': return 'Keuangan Pribadi';
      case 'transactions': return 'Riwayat Transaksi';
      case 'budgets': return 'Anggaran';
      case 'reports': return 'Laporan';
      case 'more': return 'Pengaturan & Lainnya';
      default: return 'Keuangan Pribadi';
    }
  };

  return (
    <>
      <TopBar
        title={getPageTitle()}
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setShowBillsSubScreen(false);
          setActiveTab(tab);
        }}
        onOpenAddModal={() => setIsModalOpen(true)}
        onSignOut={signOut}
        showBackButton={showBillsSubScreen}
        onBack={() => setShowBillsSubScreen(false)}
      />

      {showBillsSubScreen ? (
        <Bills
          activeWallets={activeWallets}
          activeCategories={activeCategories}
          onBillPaid={handleBillPaid}
          onBack={() => setShowBillsSubScreen(false)}
        />
      ) : (
        <>
          {activeTab === 'home' && (
            <Home
              activeWallets={activeWallets}
              totalBalance={totalBalance}
              todaySummary={todaySummary}
              recentTransactions={transactions}
              totalBudgetRemaining={totalRemaining}
              hasBudget={totalLimit > 0}
              nearestBill={nearestBill}
              onOpenAddModal={() => setIsModalOpen(true)}
              onNavigateToBills={() => setShowBillsSubScreen(true)}
              onNavigateToTransactions={() => setActiveTab('transactions')}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions
              transactions={transactions}
              activeWallets={activeWallets}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddModal={() => setIsModalOpen(true)}
            />
          )}

          {activeTab === 'budgets' && <Budgets categories={categories} />}

          {activeTab === 'reports' && <Reports />}

          {activeTab === 'more' && (
            <More
              wallets={wallets}
              activeWallets={activeWallets}
              sources={sources}
              categories={categories}
              onSignOut={signOut}
              onCreateWallet={createWallet}
              onUpdateInitialBalance={updateInitialBalance}
              onToggleWalletArchive={toggleWalletArchive}
              onDeleteWallet={deleteWallet}
              onCreateSource={createSource}
              onToggleSourceArchive={toggleSourceArchive}
              onToggleDailyRoutine={toggleDailyRoutine}
              onCreateCategory={createCategory}
              onToggleCategoryArchive={toggleCategoryArchive}
              onOpenBills={() => setShowBillsSubScreen(true)}
              onAddIncome={handleAddIncome}
              onAddExpense={handleAddExpense}
            />
          )}
        </>
      )}

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeWallets={activeWallets}
        activeSources={activeSources}
        activeCategories={activeCategories}
        onAddIncome={handleAddIncome}
        onAddExpense={handleAddExpense}
        onAddTransfer={handleAddTransfer}
      />

      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setShowBillsSubScreen(false);
          setActiveTab(tab);
        }}
      />
    </>
  );
}

export default App;
