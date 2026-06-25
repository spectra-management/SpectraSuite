import { describe, it, expect } from 'vitest'
import { buildVariables, fillTemplate, extractUsedVariables, formatLongDate } from '../variables'
import type { Employee, CompanySettings } from '@/shared/types'
import type { HrEmployeeDetail } from '@/shared/connectors/bamboohr-hr'

const emp: Employee = {
  id: '42', firstName: 'Idaly', lastName: 'Peña', workEmail: 'idaly@acme.com',
  payRate: 85000, payRateCurrency: 'DOP', payType: 'Salary', jobTitle: 'Analista',
  department: 'Finanzas', hireDate: '2024-03-01', status: 'Active', country: 'Dominican Republic',
  payroll_active: true,
}

const hr: HrEmployeeDetail = {
  id: '42', firstName: 'Idaly', lastName: 'Peña', workEmail: 'idaly@acme.com',
  jobTitle: 'Analista', department: 'Finanzas', hireDate: '2024-03-01',
  nationalId: '001-1234567-8', address: 'Calle 1 #2', city: 'Santo Domingo', state: 'D.N.',
  zipcode: '10101', mobilePhone: '809-555-1234', workPhone: '', homePhone: '',
  dateOfBirth: '1990-05-20', gender: 'Female', maritalStatus: 'Single', nationality: 'Dominican',
  supervisor: 'Ana Gómez', employeeNumber: 'E-42',
}

const company: CompanySettings = {
  name: 'ACME SRL', rnc: '130-99999-9', address: 'Av. Principal', phone: '809-000-0000',
  email: 'rh@acme.com', accentColor: '#059669',
}

describe('buildVariables', () => {
  const vars = buildVariables(emp, hr, company, 'es', new Date('2026-06-25T12:00:00Z'))

  it('maps base employee + HR fields', () => {
    expect(vars.nombre).toBe('Idaly Peña')
    expect(vars.primer_nombre).toBe('Idaly')
    expect(vars.cargo).toBe('Analista')
    expect(vars.departamento).toBe('Finanzas')
    expect(vars.email).toBe('idaly@acme.com')
    expect(vars.pais).toBe('Dominican Republic')
  })

  it('pulls cédula, address and phone from rich HR data', () => {
    expect(vars.cedula).toBe('001-1234567-8')
    expect(vars.direccion).toBe('Calle 1 #2, Santo Domingo, D.N.')
    expect(vars.telefono).toBe('809-555-1234')
    expect(vars.supervisor).toBe('Ana Gómez')
  })

  it('formats salary with currency and dates in Spanish long form', () => {
    expect(vars.salario).toBe('DOP 85,000.00')
    expect(vars.fecha_ingreso).toContain('2024')
    expect(vars.fecha_hoy).toContain('2026')
  })

  it('derives salutation, salary figures/words and the legal date', () => {
    // emp is Salary @ 85000 -> monthly = payRate; figures grouped; words spelled out.
    expect(vars.trato).toBe('la señora') // hr.gender = 'Female'
    expect(vars.salario_hora).toBe('85,000.00')
    expect(vars.salario_mensual).toBe('85,000.00')
    expect(vars.salario_letras).toBe('Ochenta y cinco mil pesos dominicanos con 00/100')
    expect(vars.fecha_legal).toBe('a los veinticinco (25) días del mes de junio del año dos mil veintiséis (2026)')
  })

  it('computes monthly salary from the hourly rate for Hourly staff', () => {
    const hourly = buildVariables(
      { ...emp, payType: 'Hourly', payRate: 270.11 },
      hr, company, 'es', new Date('2026-06-25T12:00:00Z'),
    )
    expect(hourly.salario_hora).toBe('270.11')
    expect(hourly.salario_mensual).toBe('46,819.07') // 270.11 * (40*52/12)
    expect(hourly.salario_letras).toBe('Doscientos setenta pesos dominicanos con 11/100')
  })

  it('falls back to a neutral salutation when sex is unknown', () => {
    const noGender = buildVariables(emp, { ...hr, gender: '' }, company, 'es', new Date())
    expect(noGender.trato).toBe('el/la señor(a)')
  })

  it('leaves HR-only fields blank when HR detail is missing', () => {
    const noHr = buildVariables(emp, undefined, company, 'es', new Date('2026-06-25T12:00:00Z'))
    expect(noHr.cedula).toBe('')
    expect(noHr.direccion).toBe('')
    expect(noHr.telefono).toBe('')
    expect(noHr.nombre).toBe('Idaly Peña') // base data still present
  })
})

describe('fillTemplate', () => {
  const vars = buildVariables(emp, hr, company, 'es', new Date('2026-06-25T12:00:00Z'))

  it('replaces known tokens (with or without inner spaces)', () => {
    expect(fillTemplate('Sr(a). {{nombre}}, cédula {{ cedula }}.', vars))
      .toBe('Sr(a). Idaly Peña, cédula 001-1234567-8.')
  })

  it('replaces known catalog tokens that have no value with empty string', () => {
    const noHr = buildVariables(emp, undefined, company, 'es', new Date())
    expect(fillTemplate('Cédula: [{{cedula}}]', noHr)).toBe('Cédula: []')
  })

  it('leaves unknown tokens verbatim so typos are visible', () => {
    expect(fillTemplate('Hola {{nmbre}}', vars)).toBe('Hola {{nmbre}}')
  })
})

describe('extractUsedVariables', () => {
  it('returns the distinct variable keys referenced', () => {
    const used = extractUsedVariables('{{nombre}} {{cargo}} {{nombre}} {{cedula}}')
    expect(used.sort()).toEqual(['cargo', 'cedula', 'nombre'])
  })
})

describe('formatLongDate', () => {
  it('returns empty string for empty/invalid input', () => {
    expect(formatLongDate('', 'es')).toBe('')
    expect(formatLongDate('not-a-date', 'es')).toBe('')
  })
})
