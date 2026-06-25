import { describe, it, expect } from 'vitest'
import {
  countVacationDays, getVacationsForEmployee, getVacationsOverlappingPeriod, type VacationRequest,
} from '../bamboohr-vacations'

const mk = (over: Partial<VacationRequest>): VacationRequest => ({
  id: '1', employeeId: '10', employeeName: 'X', start: '2026-06-02', end: '2026-06-06',
  totalDays: 5, dates: {}, ...over,
})

describe('bamboohr vacations helpers', () => {
  it('countVacationDays sums per-day values > 0 (half days count, 0 excluded)', () => {
    expect(countVacationDays({ '2026-06-04': 1, '2026-06-05': 0.5, '2026-06-06': 0 })).toBe(1.5)
    expect(countVacationDays({})).toBe(0)
  })

  it('getVacationsForEmployee filters by employeeId (string match)', () => {
    const list = [mk({ id: 'a', employeeId: '10' }), mk({ id: 'b', employeeId: '20' })]
    expect(getVacationsForEmployee('10', list).map((v) => v.id)).toEqual(['a'])
    expect(getVacationsForEmployee('20', list).map((v) => v.id)).toEqual(['b'])
  })

  it('getVacationsOverlappingPeriod returns vacations overlapping the range', () => {
    const list = [
      mk({ id: 'in', start: '2026-06-04', end: '2026-06-08' }),   // overlaps 06-01..06-15
      mk({ id: 'edge', start: '2026-06-15', end: '2026-06-20' }), // touches end bound
      mk({ id: 'out', start: '2026-06-16', end: '2026-06-20' }),  // after period
    ]
    const overlap = getVacationsOverlappingPeriod(list, '2026-06-01', '2026-06-15').map((v) => v.id)
    expect(overlap).toContain('in')
    expect(overlap).toContain('edge')
    expect(overlap).not.toContain('out')
  })
})
