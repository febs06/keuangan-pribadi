import type { TabType } from './BottomNav';

interface TopBarProps {
  title: string;
  activeTab?: TabType;
  onChangeTab?: (tab: TabType) => void;
  onOpenAddModal?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function TopBar({
  title,
  activeTab,
  onChangeTab,
  onOpenAddModal,
  showBackButton,
  onBack
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {showBackButton && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="btn btn-secondary topbar-back-btn"
          >
            ← Kembali
          </button>
        ) : null}
        <div className="topbar-brand">
          <span className="brand-dot" />
          <span className="topbar-title desktop-brand-title">
            Keuangan Pribadi
            {showBackButton ? <span style={{ opacity: 0.5, margin: '0 6px', fontWeight: 400 }}>/ {title}</span> : null}
          </span>
          <span className="topbar-title mobile-brand-title">
            {title}
          </span>
        </div>
      </div>

      {/* Navigasi Khusus Layar PC / Desktop */}
      {onChangeTab && activeTab && (
        <nav className="desktop-nav">
          <button
            type="button"
            className={`desktop-nav-link ${activeTab === 'home' && !showBackButton ? 'active' : ''}`}
            onClick={() => onChangeTab('home')}
          >
            Beranda
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => onChangeTab('transactions')}
          >
            Transaksi
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${activeTab === 'budgets' ? 'active' : ''}`}
            onClick={() => onChangeTab('budgets')}
          >
            Anggaran
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => onChangeTab('reports')}
          >
            Laporan
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${activeTab === 'more' ? 'active' : ''}`}
            onClick={() => onChangeTab('more')}
          >
            Pengaturan
          </button>
        </nav>
      )}

      {/* Aksi Cepat Desktop */}
      <div className="desktop-actions">
        {onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="btn btn-primary"
            style={{ minHeight: '38px', padding: '0 16px', fontSize: '13.5px' }}
          >
            + Catat Transaksi
          </button>
        )}
      </div>
    </header>
  );
}

