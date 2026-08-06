import { describe, expect, it } from 'vitest'
import { summarize } from './finance'
describe('fechamento financeiro', () => {
  it('ignora lançamentos estornados e calcula custos e comissão', () => {
    const result = summarize([
      { amount: 100, service_cost_snapshot: 10, commission_percent_snapshot: 10, status: 'posted', revenue_date: '2026-08-05' },
      { amount: 999, service_cost_snapshot: 0, commission_percent_snapshot: 0, status: 'void', revenue_date: '2026-08-05' },
    ], [{ amount: 20, status: 'posted', expense_date: '2026-08-01' }], '2026-08')
    expect(result).toEqual({ gross: 100, directCosts: 20, operatingExpenses: 20, net: 60, ticket: 100, count: 1 })
  })
  it('preserva histórico quando funcionário não existe mais', () => {
    const result = summarize([{ amount: 80, service_cost_snapshot: 5, commission_percent_snapshot: 25, status: 'posted', revenue_date: '2026-08-05' }], [], '2026-08')
    expect(result.net).toBe(55)
  })
})
