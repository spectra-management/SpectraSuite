import { describe, it, expect } from 'vitest'
import { assignmentsByDivision, type RosterEmployee } from '../compute'
import type { BillingClient, ClientEmployee } from '../types'

const client = (over: Partial<BillingClient> = {}): BillingClient => ({
  id: 'c1', name: 'AdventHealth', division: 'AdventHealth',
  contactName: '', contactEmail: '', contactPhone: '',
  billingAddress: '', remitToName: '', remitToAddress: '', remitToDetails: '',
  invoicePrefix: 'INV', nextInvoiceSeq: 1, defaultMethod: 'hour',
  currencyCountry: 'Dominican Republic', notes: '', active: true,
  createdAt: '', updatedAt: '', ...over,
})

const roster: RosterEmployee[] = [
  { id: '1', firstName: 'Ana', lastName: 'A', jobTitle: 'Agent', division: 'AdventHealth' },
  { id: '2', firstName: 'Beto', lastName: 'B', jobTitle: 'Agent', division: 'adventhealth' }, // case-insensitive
  { id: '3', firstName: 'Caro', lastName: 'C', jobTitle: 'Agent', division: 'Other Client' },
  { id: '4', firstName: 'Dan', lastName: 'D', jobTitle: 'Agent', division: '' },
]

describe('assignmentsByDivision', () => {
  it('includes only employees whose division matches the client (case-insensitive)', () => {
    const a = assignmentsByDivision(client(), roster, [])
    expect(a.map((x) => x.employeeId).sort()).toEqual(['1', '2'])
    expect(a.every((x) => x.clientId === 'c1' && x.active)).toBe(true)
  })

  it('keeps an existing manual override (rate/method) instead of the synthetic row', () => {
    const manual: ClientEmployee = {
      id: 'm1', clientId: 'c1', employeeId: '1', method: 'percentage',
      baseRateOverride: null, otRateOverride: null, fixedAmount: null, percentageRate: 15,
      active: true, createdAt: '', updatedAt: '',
    }
    const a = assignmentsByDivision(client(), roster, [manual])
    const emp1 = a.find((x) => x.employeeId === '1')
    expect(emp1?.id).toBe('m1')
    expect(emp1?.percentageRate).toBe(15)
  })

  it('matches by client name when division is unset', () => {
    const a = assignmentsByDivision(client({ division: '' }), roster, [])
    // name "AdventHealth" matches divisions 1 and 2
    expect(a.map((x) => x.employeeId).sort()).toEqual(['1', '2'])
  })

  it('returns nothing extra when the client has no division/name match', () => {
    const a = assignmentsByDivision(client({ name: 'Nobody', division: 'Nobody' }), roster, [])
    expect(a).toEqual([])
  })
})
