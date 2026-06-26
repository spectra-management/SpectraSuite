import { describe, it, expect } from 'vitest'
import { resolveBaseballCard, formatMonthDay, formatMonthYear, type HrCardSource } from '../baseballCard'

const hr: HrCardSource = {
  fullName: 'James Daniel Crook',
  nickName: 'Jimmy',
  dateOfBirth: '1980-01-27',
  hireDate: '2023-08-01',
  jobTitle: 'VP, Strategic Partnerships',
}

describe('date formatters', () => {
  it('formats DOB as month + day (no year)', () => {
    expect(formatMonthDay('1980-01-27', 'en')).toBe('January 27')
  })
  it('formats start date as month abbreviation + year', () => {
    expect(formatMonthYear('2023-08-01', 'en')).toBe('Aug 2023')
  })
  it('returns empty string for missing/invalid dates', () => {
    expect(formatMonthDay('', 'en')).toBe('')
    expect(formatMonthYear('not-a-date', 'en')).toBe('')
  })
})

describe('resolveBaseballCard', () => {
  it('auto-fills from HR when no override is set', () => {
    const r = resolveBaseballCard(hr, {}, 'en')
    expect(r.fullName).toBe('James Daniel Crook')
    expect(r.nickName).toBe('Jimmy')
    expect(r.dobMonthDay).toBe('January 27')
    expect(r.spectraStartDate).toBe('Aug 2023')
    expect(r.jobTitle).toBe('VP, Strategic Partnerships')
  })

  it('lets a non-empty override win over the HR value', () => {
    const r = resolveBaseballCard(hr, { fullName: 'Jim Crook', dobMonthDay: 'Jan 27th' }, 'en')
    expect(r.fullName).toBe('Jim Crook')
    expect(r.dobMonthDay).toBe('Jan 27th')
    // untouched fields still come from HR
    expect(r.nickName).toBe('Jimmy')
  })

  it('treats a blank/whitespace override as "use HR"', () => {
    const r = resolveBaseballCard(hr, { jobTitle: '   ' }, 'en')
    expect(r.jobTitle).toBe('VP, Strategic Partnerships')
  })

  it('keeps manual-only list fields and trims/cleans them', () => {
    const r = resolveBaseballCard(hr, {
      jobHistory: [' Professor ', '', 'Director of HR'],
      goals: ['Grow team'],
      hobbies: ['Fishing', '  '],
    }, 'en')
    expect(r.jobHistory).toEqual(['Professor', 'Director of HR'])
    expect(r.goals).toEqual(['Grow team'])
    expect(r.hobbies).toEqual(['Fishing'])
  })

  it('manual-only scalar fields default to empty (no HR source)', () => {
    const r = resolveBaseballCard(hr, {}, 'en')
    expect(r.accountName).toBe('')
    expect(r.education).toBe('')
    expect(r.leadershipStyle).toBe('')
    expect(r.goals).toEqual([])
  })
})
