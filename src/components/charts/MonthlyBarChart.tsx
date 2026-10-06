import type { MonthlySummary } from '../../types';
import { formatShortRupiah } from '../../lib/format';

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
  if (summaries.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
        Belum ada data bulanan
      </div>
    );
  }

  // Cari nilai maksimum untuk skala tinggi batang
  let maxVal = 1;
  summaries.forEach(s => {
    if (s.total_income > maxVal) maxVal = s.total_income;
    if (s.total_expense > maxVal) maxVal = s.total_expense;
  });

  const chartHeight = 150;
  const numItems = summaries.length;
  const svgWidth = Math.max(numItems * 90, 460);
  const colWidth = svgWidth / numItems;

  return (
    <div>
      {/* Legenda Ringkas */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '16px', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--text-dim)', borderRadius: '2px' }} />
          <span>Masuk</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent)', borderRadius: '2px' }} />
          <span>Keluar</span>
        </div>
      </div>

      {/* SVG Canvas Bar Chart */}
      <div style={{ width: '100%', height: `${chartHeight + 50}px`, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${chartHeight + 50}`}
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {/* Garis Dasar Nol */}
          <line
            x1="0"
            y1={chartHeight}
            x2={svgWidth}
            y2={chartHeight}
            stroke="var(--border-color)"
            strokeWidth="1"
          />

          {summaries.map((s, idx) => {
            const isSelected = s.month_year === selectedMonth;
            const xCenter = idx * colWidth + colWidth / 2;
            
            // Hitung tinggi batang
            const incH = Math.max(Math.round((s.total_income / maxVal) * chartHeight), s.total_income > 0 ? 4 : 0);
            const expH = Math.max(Math.round((s.total_expense / maxVal) * chartHeight), s.total_expense > 0 ? 4 : 0);
            
            const incY = chartHeight - incH;
            const expY = chartHeight - expH;

            // Format bulan pendek misal "2026-10" -> "Okt 2026"
            const [yStr, mStr] = s.month_year.split('-');
            const monthNum = parseInt(mStr, 10);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const mLabel = `${monthNames[monthNum - 1] || mStr} ${yStr.slice(2)}`;

            return (
              <g
                key={s.month_year}
                onClick={() => onSelectMonth(s.month_year)}
                style={{ cursor: 'pointer' }}
              >
                {/* Latar hover / terpilih */}
                {isSelected && (
                  <rect
                    x={idx * colWidth + 6}
                    y="0"
                    width={colWidth - 12}
                    height={chartHeight + 42}
                    fill="var(--bg-subtle)"
                    rx="6"
                  />
                )}

                {/* Batang Pemasukan (Abu / Muted) */}
                <rect
                  x={xCenter - 20}
                  y={incY}
                  width="16"
                  height={incH}
                  fill="var(--text-dim)"
                  rx="3"
                />

                {/* Batang Pengeluaran (Warna Aksen) */}
                <rect
                  x={xCenter + 4}
                  y={expY}
                  width="16"
                  height={expH}
                  fill="var(--accent)"
                  rx="3"
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

      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' }}>
        Ketuk bulan pada grafik untuk melihat rincian di samping
      </div>
    </div>
  );
}
