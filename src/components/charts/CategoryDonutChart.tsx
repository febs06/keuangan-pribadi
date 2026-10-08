import { useState } from 'react';
import type { CategoryExpenseSummary } from '../../types';
import { formatRupiah, formatShortRupiah } from '../../lib/format';
import { getCategoryStyle } from '../../lib/categoryIcons';

interface CategoryDonutChartProps {
  expenses: CategoryExpenseSummary[];
}

export function CategoryDonutChart({ expenses }: CategoryDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!expenses || expenses.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
        Tidak ada data belanja kategori
      </div>
    );
  }

  const totalExpense = expenses.reduce((acc, e) => acc + Number(e.total_expense), 0);

  if (totalExpense === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
        Belum ada pengeluaran di periode ini
      </div>
    );
  }

  // Parameter Lingkaran SVG
  const radius = 66;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  const slices = expenses.map((e, idx) => {
    const amount = Number(e.total_expense);
    const percent = amount / totalExpense;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += percent * circumference;

    const catStyle = getCategoryStyle(e.category_name, 'expense');

    return {
      idx,
      name: e.category_name,
      amount,
      percent: Math.round(percent * 100),
      color: catStyle.color,
      strokeDasharray,
      strokeDashoffset
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
      {/* Visual Donut SVG */}
      <div style={{ position: 'relative', width: '190px', height: '190px' }}>
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          {/* Background Ring */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--bg-muted)"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {slices.map(slice => {
            const isHovered = hoveredIdx === slice.idx;
            return (
              <circle
                key={slice.name}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredIdx !== null && !isHovered ? 0.6 : 1
                }}
              />
            );
          })}
        </svg>

        {/* Teks Tengah Donut */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '12px'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            {activeSlice ? activeSlice.name : 'Total Belanja'}
          </span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
            {activeSlice ? formatShortRupiah(activeSlice.amount) : formatShortRupiah(totalExpense)}
          </span>
          {activeSlice && (
            <span style={{ fontSize: '11.5px', color: activeSlice.color, fontWeight: 600 }}>
              {activeSlice.percent}%
            </span>
          )}
        </div>
      </div>

      {/* Legenda Kategori Rapi di Bawah Donut (Satu Baris per Kategori) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '380px', marginTop: '6px' }}>
        {slices.map(slice => {
          const isHovered = hoveredIdx === slice.idx;
          return (
            <div
              key={slice.name}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: isHovered ? 'var(--bg-subtle)' : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              {/* Sisi Kiri: Titik Warna + Nama Kategori */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginRight: '12px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: slice.color,
                    flexShrink: 0
                  }}
                />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: 'var(--text-main)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {slice.name}
                </span>
              </div>

              {/* Sisi Kanan: Nominal & Persentase (Rata Kanan, Tabular Nums) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '12.5px'
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  {formatRupiah(slice.amount)}
                </span>
                <span
                  style={{
                    minWidth: '36px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: slice.color
                  }}
                >
                  {slice.percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
