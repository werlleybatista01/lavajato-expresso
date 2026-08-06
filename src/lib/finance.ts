export type Revenue = { amount: number; service_cost_snapshot: number; commission_percent_snapshot: number; status: string; revenue_date: string }
export type Expense = { amount: number; status: string; expense_date: string }

export const posted = <T extends { status: string }>(rows: T[]) => rows.filter((row) => row.status === 'posted')
export const monthKey = (iso: string) => iso.slice(0, 7)
export function summarize(revenues: Revenue[], expenses: Expense[], month: string) {
  const rev = posted(revenues).filter((r) => monthKey(r.revenue_date) === month)
  const exp = posted(expenses).filter((e) => monthKey(e.expense_date) === month)
  const gross = rev.reduce((sum, r) => sum + Number(r.amount), 0)
  const directCosts = rev.reduce((sum, r) => sum + Number(r.service_cost_snapshot) + Number(r.amount) * Number(r.commission_percent_snapshot) / 100, 0)
  const operatingExpenses = exp.reduce((sum, e) => sum + Number(e.amount), 0)
  return { gross, directCosts, operatingExpenses, net: gross - directCosts - operatingExpenses, ticket: rev.length ? gross / rev.length : 0, count: rev.length }
}
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
