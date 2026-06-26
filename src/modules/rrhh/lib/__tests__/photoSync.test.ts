import { describe, it, expect } from 'vitest'
import { bambooPhotoVersion, planPhotoSync } from '../photoSync'
import type { PhotoMeta } from '../photoStorage'

describe('bambooPhotoVersion', () => {
  it('extracts the stable path segment, ignoring the signed query string', () => {
    const url = 'https://images7.bamboohr.com/657748/photos/116-0-4.jpg?Policy=abc&Signature=xyz'
    expect(bambooPhotoVersion(url)).toBe('116-0-4.jpg')
  })

  it('returns empty string for a missing/blank photoUrl', () => {
    expect(bambooPhotoVersion(undefined)).toBe('')
    expect(bambooPhotoVersion('')).toBe('')
  })
})

describe('planPhotoSync', () => {
  const emp = (id: string, photoUrl: string) => ({ id, photoUrl })

  it('includes employees with no stored photo yet', () => {
    const plan = planPhotoSync([emp('1', '.../photos/1-0-4.jpg?sig')], {})
    expect(plan).toEqual([{ id: '1', version: '1-0-4.jpg' }])
  })

  it('skips employees whose stored version is unchanged', () => {
    const existing: Record<string, PhotoMeta> = {
      '1': { storagePath: 'bamboohr/1.jpg', source: 'bamboohr', bamboohrVersion: '1-0-4.jpg' },
    }
    expect(planPhotoSync([emp('1', '.../photos/1-0-4.jpg?sig')], existing)).toEqual([])
  })

  it('re-syncs when the BambooHR version changed', () => {
    const existing: Record<string, PhotoMeta> = {
      '1': { storagePath: 'bamboohr/1.jpg', source: 'bamboohr', bamboohrVersion: '1-0-4.jpg' },
    }
    expect(planPhotoSync([emp('1', '.../photos/1-1-4.jpg?sig')], existing)).toEqual([
      { id: '1', version: '1-1-4.jpg' },
    ])
  })

  it('NEVER touches a manual upload, even if the BambooHR version differs', () => {
    const existing: Record<string, PhotoMeta> = {
      '1': { storagePath: '1.png', source: 'manual', bamboohrVersion: null },
    }
    expect(planPhotoSync([emp('1', '.../photos/1-9-4.jpg?sig')], existing)).toEqual([])
  })

  it('skips employees with no BambooHR photo', () => {
    expect(planPhotoSync([emp('1', '')], {})).toEqual([])
  })
})
