-- Migration: 20261006161000_reports_and_analytics.sql
-- Fitur Tahap 3: View Ringkasan Bulanan v_monthly_summary

CREATE OR REPLACE VIEW public.v_monthly_summary 
WITH (security_invoker = true) AS
WITH months AS (
  SELECT DISTINCT user_id, to_char(date, 'YYYY-MM') AS month_year 
  FROM public.transactions
),
monthly_inc AS (
  SELECT user_id, month_year, SUM(total_income) AS total_income
  FROM public.v_monthly_income_by_source
  GROUP BY user_id, month_year
),
monthly_exp AS (
  SELECT user_id, month_year, SUM(total_expense) AS total_expense
  FROM public.v_monthly_expenses_by_category
  GROUP BY user_id, month_year
)
SELECT 
  m.user_id,
  m.month_year,
  COALESCE(inc.total_income, 0) AS total_income,
  COALESCE(exp.total_expense, 0) AS total_expense,
  (COALESCE(inc.total_income, 0) - COALESCE(exp.total_expense, 0)) AS net_diff
FROM months m
LEFT JOIN monthly_inc inc ON inc.user_id = m.user_id AND inc.month_year = m.month_year
LEFT JOIN monthly_exp exp ON exp.user_id = m.user_id AND exp.month_year = m.month_year
ORDER BY m.month_year ASC;
