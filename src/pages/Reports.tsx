import { useState } from 'react';
import { useReports } from '../hooks/useReports';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { CategoryHBarChart } from '../components/charts/CategoryHBarChart';
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart';
import { formatRupiah } from '../lib/format';
import { useToast } from '../components/common/Toast';
import { Download, PieChart, BarChart3 } from 'lucide-react';

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

  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [chartView, setChartView] = useState<'donut' | 'bar'>('donut');

  // Data bulan terpilih
  const currentSummary = monthlySummaries.find(s => s.month_year === selectedMonth);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTransactionsToCSV();
      showToast({ message: 'Riwayat transaksi berhasil diunduh ke CSV!', type: 'success' });
    } catch {
      showToast({ message: 'Gagal mengekspor data CSV', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="content-area">
      {/* 1. Header & Pemilih Rentang Bulan (6 / 12) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Analitik & Laporan Keuangan
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={`btn ${monthRange === 6 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '32px', padding: '2px 12px', fontSize: '12px' }}
            onClick={() => setMonthRange(6)}
          >
            6 Bulan
          </button>
          <button
            type="button"
            className={`btn ${monthRange === 12 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '32px', padding: '2px 12px', fontSize: '12px' }}
            onClick={() => setMonthRange(12)}
          >
            12 Bulan
          </button>
        </div>
      </div>

      <div className="grid-responsive">
        {/* Kolom Kiri di Desktop: Grafik Tren Bulanan & Ekspor */}
        <div className="grid-col">
          {/* Grafik Batang Bulanan (SVG murni) */}
          <div className="card">
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
                Memuat analitik tren...
              </div>
            ) : (
              <MonthlyBarChart
                summaries={monthlySummaries}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
              />
            )}
          </div>

          {/* Tombol Ekspor CSV dengan Feedback */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14.5px' }}>Unduh Data (.CSV)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Ekspor seluruh mutasi kas ke file spreadsheet / Excel
              </div>
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ minHeight: '38px', padding: '4px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              <Download size={15} />
              {exporting ? 'Mengunduh...' : 'Ekspor CSV'}
            </button>
          </div>
        </div>

        {/* Kolom Kanan di Desktop: Rincian Bulan Terpilih */}
        <div className="grid-col">
          {selectedMonth && (
            <div className="card">
              <div className="card-header-row" style={{ marginBottom: '12px' }}>
                <span className="card-title" style={{ marginBottom: 0 }}>
                  Rincian Bulan {selectedMonth}
                </span>
                {/* Switcher Donut vs Bar */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setChartView('donut')}
                    className={`btn ${chartView === 'donut' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                    title="Grafik Donut"
                  >
                    <PieChart size={13} /> Donut
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('bar')}
                    className={`btn ${chartView === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px' }}
                    title="Grafik Batang"
                  >
                    <BarChart3 size={13} /> Batang
                  </button>
                </div>
              </div>

              {/* Kartu Ringkasan Bulan Terpilih */}
              {currentSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Total Masuk</div>
                    <div className="amount-text amount-income" style={{ textAlign: 'left', fontSize: '17px' }}>
                      {formatRupiah(Number(currentSummary.total_income))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Total Keluar</div>
                    <div className="amount-text amount-expense" style={{ textAlign: 'left', fontSize: '17px' }}>
                      {formatRupiah(Number(currentSummary.total_expense))}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Surplus / Defisit:</span>
                    <span className={`amount-text ${currentSummary.net_diff >= 0 ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '16px' }}>
                      {currentSummary.net_diff > 0 ? '+' : ''}{formatRupiah(Number(currentSummary.net_diff))}
                    </span>
                  </div>
                </div>
              )}

              {/* Distribusi Pengeluaran per Kategori */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                  Distribusi Pengeluaran Kategori
                </div>
                {chartView === 'donut' ? (
                  <CategoryDonutChart expenses={monthExpenses} />
                ) : (
                  <CategoryHBarChart expenses={monthExpenses} />
                )}
              </div>

              {/* Pemasukan per Sumber */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Pemasukan per Sumber
                </div>
                {monthIncome.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '6px 0' }}>
                    Tidak ada transaksi masuk pada bulan ini
                  </div>
                ) : (
                  <div>
                    {monthIncome.map(s => (
                      <div key={s.source_id || s.source_name} className="row-item" style={{ padding: '8px 4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{s.source_name || 'Sumber'}</span>
                        <span className="amount-text amount-income" style={{ fontSize: '13.5px' }}>
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
