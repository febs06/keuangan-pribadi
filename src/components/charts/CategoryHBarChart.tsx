import type { CategoryExpenseSummary } from '../../types';
import { formatRupiah } from '../../lib/format';

interface CategoryHBarChartProps {
  expenses: CategoryExpenseSummary[];
}

export function CategoryHBarChart({ expenses }: CategoryHBarChartProps) {
  if (expenses.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
        Tidak ada pengeluaran pada bulan ini
      </div>
    );
  }

  // Cari pengeluaran terbesar untuk skala 100%
  const maxExpense = Math.max(...expenses.map(e => Number(e.total_expense)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {expenses.map(e => {
        const val = Number(e.total_expense);
        const percent = Math.min(Math.round((val / maxExpense) * 100), 100);

        return (
          <div key={e.category_id || e.category_name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{e.category_name}</span>
              <span className="amount-text" style={{ fontSize: '13px' }}>{formatRupiah(val)}</span>
            </div>

            {/* Batang Horizontal CSS murni */}
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent)',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
