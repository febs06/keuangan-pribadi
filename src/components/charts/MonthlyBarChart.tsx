import { useState } from 'react';
import type { MonthlySummary } from '../../types';
import { formatRupiah, formatShortRupiah } from '../../lib/format';

interface MonthlyBarChartProps {
  summaries: MonthlySummary[];
  selectedMonth: string;
  onSelectMonth: (monthYear: string) => void;
}

export function MonthlyBarChart({
  summaries,
  selectedMonth,
  onSelectMonth
}: MonthlyBarChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  if (summaries.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
        Belum ada riwayat transaksi bulanan
      </div>
    );
  }

  // Cari nilai maksimum untuk skala tinggi batang
  let maxVal = 1;
  summaries.forEach(s => {
    if (s.total_income > maxVal) maxVal = s.total_income;
    if (s.total_expense > maxVal) maxVal = s.total_expense;
  });

  const chartHeight = 160;
  const numItems = summaries.length;
  const svgWidth = Math.max(numItems * 90, 440);
  const colWidth = svgWidth / numItems;

  const activeHoverData = summaries.find(s => s.month_year === (hoveredMonth || selectedMonth));

  return (
    <div>
      {/* Header Info & Legenda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Tren Pemasukan vs Pengeluaran
          </span>
          {activeHoverData && (
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {activeHoverData.month_year}: Masuk <strong>{formatRupiah(activeHoverData.total_income)}</strong> • Keluar <strong>{formatRupiah(activeHoverData.total_expense)}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--income)', borderRadius: '2px' }} />
            <span>Masuk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--expense)', borderRadius: '2px' }} />
            <span>Keluar</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Bar Chart */}
      <div style={{ width: '100%', height: `${chartHeight + 54}px`, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${chartHeight + 54}`}
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {/* Garis Grid Halus */}
          {[0.25, 0.5, 0.75, 1].map(ratio => {
            const y = chartHeight - chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1="0"
                y1={y}
                x2={svgWidth}
                y2={y}
                stroke="var(--border-color)"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.6"
              />
            );
          })}

          {/* Garis Dasar Nol */}
          <line
            x1="0"
            y1={chartHeight}
            x2={svgWidth}
            y2={chartHeight}
            stroke="var(--border-color)"
            strokeWidth="1.5"
          />

          {summaries.map((s, idx) => {
            const isSelected = s.month_year === selectedMonth;
            const isHovered = s.month_year === hoveredMonth;
            const xCenter = idx * colWidth + colWidth / 2;

            // Hitung tinggi batang
            const incH = Math.max(Math.round((s.total_income / maxVal) * chartHeight), s.total_income > 0 ? 5 : 0);
            const expH = Math.max(Math.round((s.total_expense / maxVal) * chartHeight), s.total_expense > 0 ? 5 : 0);

            const incY = chartHeight - incH;
            const expY = chartHeight - expH;

            // Format bulan pendek misal "2026-10" -> "Okt 2026"
            const [yStr, mStr] = s.month_year.split('-');
            const monthNum = parseInt(mStr, 10);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const mLabel = `${monthNames[monthNum - 1] || mStr} '${yStr.slice(2)}`;

            return (
              <g
                key={s.month_year}
                onClick={() => onSelectMonth(s.month_year)}
                onMouseEnter={() => setHoveredMonth(s.month_year)}
                onMouseLeave={() => setHoveredMonth(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Latar hover / terpilih */}
                {(isSelected || isHovered) && (
                  <rect
                    x={idx * colWidth + 6}
                    y="0"
                    width={colWidth - 12}
                    height={chartHeight + 46}
                    fill="var(--bg-subtle)"
                    rx="8"
                    opacity={isHovered ? 0.9 : 0.6}
                  />
                )}

                {/* Batang Pemasukan (Hijau / Income) */}
                <rect
                  x={xCenter - 22}
                  y={incY}
                  width="18"
                  height={incH}
                  fill="var(--income)"
                  rx="4"
                  opacity={isHovered || isSelected ? 1 : 0.85}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Batang Pengeluaran (Merah / Expense) */}
                <rect
                  x={xCenter + 4}
                  y={expY}
                  width="18"
                  height={expH}
                  fill="var(--expense)"
                  rx="4"
                  opacity={isHovered || isSelected ? 1 : 0.85}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Label Bulan */}
                <text
                  x={xCenter}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill={isSelected ? 'var(--accent)' : 'var(--text-muted)'}
                  fontWeight={isSelected ? '700' : '500'}
                >
                  {mLabel}
                </text>

                {/* Label Selisih (Surplus / Defisit) */}
                <text
                  x={xCenter}
                  y={chartHeight + 36}
                  textAnchor="middle"
                  fontSize="11"
                  fill={s.net_diff >= 0 ? 'var(--income)' : 'var(--expense)'}
                  fontWeight="600"
                >
                  {s.net_diff > 0 ? '+' : ''}{formatShortRupiah(s.net_diff)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {summaries.length <= 1 ? (
        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '12px' }}>
          💡 Grafik tren bulanan akan terisi seiring bertambahnya bulan pencatatan transaksi Anda.
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' }}>
          Ketuk kolom bulan untuk melihat rincian pengeluaran per kategori
        </div>
      )}
    </div>
  );
}
