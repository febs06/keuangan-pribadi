import { useState } from 'react';
import { useReports } from '../hooks/useReports';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { CategoryHBarChart } from '../components/charts/CategoryHBarChart';
import { formatRupiah } from '../lib/format';

export function Reports() {
  const {
    monthlySummaries,
    selectedMonth,
    setSelectedMonth,
    monthExpenses,
    monthIncome,
    monthRange,
    setMonthRange,
    loading,
    exportTransactionsToCSV
  } = useReports();

  const [exporting, setExporting] = useState(false);

  // Data bulan terpilih
  const currentSummary = monthlySummaries.find(s => s.month_year === selectedMonth);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTransactionsToCSV();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="content-area">
      {/* 1. Header & Pemilih Rentang Bulan (6 / 12) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Tren Bulanan
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={`btn ${monthRange === 6 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '32px', padding: '2px 10px', fontSize: '12px' }}
            onClick={() => setMonthRange(6)}
          >
            6 Bulan
          </button>
          <button
            type="button"
            className={`btn ${monthRange === 12 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '32px', padding: '2px 10px', fontSize: '12px' }}
            onClick={() => setMonthRange(12)}
          >
            12 Bulan
          </button>
        </div>
      </div>

      <div className="grid-responsive">
        {/* Kolom Kiri di Desktop: Grafik & Ekspor */}
        <div className="grid-col">
          {/* 2. Grafik Batang Bulanan (SVG murni) */}
          <div className="card">
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Memuat analitik...</div>
            ) : (
              <MonthlyBarChart
                summaries={monthlySummaries}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
              />
            )}
          </div>

          {/* 4. Tombol Ekspor CSV */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Ekspor Data</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unduh seluruh riwayat transaksi ke format CSV</div>
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ minHeight: '36px', padding: '4px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {exporting ? 'Mengunduh...' : 'Ekspor CSV'}
            </button>
          </div>
        </div>

        {/* Kolom Kanan di Desktop: Rincian Bulan Terpilih */}
        <div className="grid-col">
          {selectedMonth && (
            <div className="card">
              <div className="card-title">Rincian Bulan {selectedMonth}</div>

              {/* Kartu Ringkasan Bulan Terpilih */}
              {currentSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Masuk</div>
                    <div className="amount-text amount-income" style={{ textAlign: 'left', fontSize: '16px' }}>
                      {formatRupiah(Number(currentSummary.total_income))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Keluar</div>
                    <div className="amount-text amount-expense" style={{ textAlign: 'left', fontSize: '16px' }}>
                      {formatRupiah(Number(currentSummary.total_expense))}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Surplus / Defisit:</span>
                    <span className={`amount-text ${currentSummary.net_diff >= 0 ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '15px' }}>
                      {currentSummary.net_diff > 0 ? '+' : ''}{formatRupiah(Number(currentSummary.net_diff))}
                    </span>
                  </div>
                </div>
              )}

              {/* Pengeluaran per Kategori (Batang Horizontal) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Pengeluaran per Kategori
                </div>
                <CategoryHBarChart expenses={monthExpenses} />
              </div>

              {/* Pemasukan per Sumber */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Pemasukan per Sumber
                </div>
                {monthIncome.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tidak ada pemasukan pada bulan ini</div>
                ) : (
                  <div>
                    {monthIncome.map(s => (
                      <div key={s.source_id || s.source_name} className="row-item" style={{ padding: '8px 0' }}>
                        <span style={{ fontSize: '13px' }}>{s.source_name || 'Sumber'}</span>
                        <span className="amount-text amount-income" style={{ fontSize: '13px' }}>
                          {formatRupiah(Number(s.total_income))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
