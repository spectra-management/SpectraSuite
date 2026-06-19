import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PayrollEntry, CompanySettings, PaymentMethod, BankAccount } from '@/types'
import { roundHalfUp, safeNum } from '@/lib/payroll/calculations'
import { maskAccount } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/payroll/rules'
import { logoSrc } from './logo'
import { getPaystubLang, PAYSTUB_LABELS, US_DEDUCTION_LABELS, PAYMENT_METHOD_LABELS } from './paystubLabels'

const EMERALD = '#059669'
const EMERALD_DARK = '#065F46'
const EMERALD_LIGHT = '#ECFDF5'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'
const RED = '#DC2626'

const S = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 8.5, padding: '28 36', backgroundColor: '#FFFFFF', color: GRAY_900 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: `1 solid ${GRAY_200}` },
  logoWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logo: { width: 42, height: 42, borderRadius: 5, objectFit: 'contain' },
  companyName: { fontSize: 13, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, marginBottom: 2 },
  companyMeta: { fontSize: 7.5, color: GRAY_500, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  stubTitle: { fontSize: 15, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, letterSpacing: 1.5, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  metaLabel: { fontSize: 7.5, color: GRAY_500 },
  metaValue: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_700 },

  // ── Employee box ────────────────────────────────────────────────────────────
  empBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: GRAY_50, borderLeft: `3 solid ${EMERALD}`, borderRadius: 5, padding: '9 12', marginBottom: 14, gap: 12 },
  empName: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, marginBottom: 3 },
  empMeta: { fontSize: 7.5, color: GRAY_500, marginTop: 1 },
  empMetaValue: { fontFamily: 'Roboto', fontWeight: 700, color: GRAY_700 },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: { marginBottom: 12 },

  // ── Table shared ────────────────────────────────────────────────────────────
  tHead: { flexDirection: 'row', padding: '5 8' },
  tRow: { flexDirection: 'row', padding: '3.5 8', borderBottom: `0.5 solid ${GRAY_100}` },
  tTotalRow: { flexDirection: 'row', padding: '5 8', borderTop: `1 solid ${GRAY_200}`, backgroundColor: GRAY_50 },

  // ── Earnings table ──────────────────────────────────────────────────────────
  earnHead: { backgroundColor: EMERALD, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  earnHeadText: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF' },
  earnCell: { fontSize: 8, color: GRAY_700 },
  earnCellBold: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  earnTotal: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  earnTotalValue: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD },

  // ── Deductions table ────────────────────────────────────────────────────────
  dedHead: { backgroundColor: GRAY_700, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dedHeadText: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF' },
  dedLabel: { fontSize: 8, color: GRAY_700 },
  dedRate: { fontSize: 8, color: GRAY_500 },
  dedArrow: { fontSize: 8, color: GRAY_500 },
  dedAmount: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: RED },
  dedAmountNeutral: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_700 },
  dedTotalLabel: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  dedTotalValue: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: RED },

  // ── Net income row ──────────────────────────────────────────────────────────
  netRow: { flexDirection: 'row', padding: '7 8', backgroundColor: EMERALD_LIGHT, borderTop: `1 solid ${EMERALD}` },
  netLabel: { fontSize: 10, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD_DARK },
  netValue: { fontSize: 10, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: { marginTop: 16, paddingTop: 7, borderTop: `0.5 solid ${GRAY_200}`, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

function makeFmt(currencySymbol: string) {
  return (n: number): string =>
    `${currencySymbol} ${roundHalfUp(safeNum(n), 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Lookup a custom deduction by keyword match; returns 0 if not found.
function lookupDed(
  breakdown: Array<{ name: string; amount: number }>,
  keywords: string[],
): number {
  const found = breakdown.find((d) =>
    keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase())),
  )
  return found?.amount ?? 0
}

// Custom deductions that aren't one of the three named fixed rows.
function otherDeds(
  breakdown: Array<{ name: string; amount: number }>,
): Array<{ name: string; amount: number }> {
  const fixed = ['advance', 'adelanto', 'dependent tss', 'tss depend', 'complementary', 'complementario']
  return breakdown.filter(
    (d) => !fixed.some((kw) => d.name.toLowerCase().includes(kw)),
  )
}

interface Props {
  entry: PayrollEntry
  company: CompanySettings
  startDate: string
  endDate: string
  /** Deprecated — paystub language is now derived from `country` (DR/Mexico → Spanish). */
  lang?: 'en' | 'es'
  country?: string
  paymentMethod?: PaymentMethod
  bankAccount?: BankAccount
  otRatePercent?: number
  holidayRatePercent?: number
}

export function PayStubDocument({
  entry,
  company,
  startDate,
  endDate,
  country = 'Dominican Republic',
  paymentMethod = 'transfer',
  bankAccount,
  otRatePercent = 35,
  holidayRatePercent = 100,
}: Props) {
  const { employee: emp, calculation: c, hours: h } = entry
  // Worked holiday hours are paid as regular hours, so the "Regular Hours" line shows
  // regular + holiday hours; the holiday line shows only the additional premium.
  const regularDisplayHours = safeNum(h.regularHours) + safeNum(h.holidayHours)
  // Rate shown in the earnings table. Salary pay is fixed, so the per-hour figure is
  // gross ÷ period hours (keeps hours × rate = gross). Hourly shows its stored/override rate.
  const effectiveRate = emp.payType === 'Salary'
    ? (regularDisplayHours > 0 ? safeNum(c.regularPay) / regularDisplayHours : 0)
    : safeNum(h.payRateOverride ?? emp.payRate)
  const logo = logoSrc(company.logoBase64)
  // FEATURE 1: paystub language follows the employee's country (DR/Mexico → Spanish).
  const lang = getPaystubLang(country)
  const l = PAYSTUB_LABELS[lang]
  // "Bank Transfer · Banco Popular · ****1234" when a bank account is on file for a transfer.
  const acctMask = maskAccount(bankAccount?.accountNumber)
  const methodLabel = paymentMethod === 'transfer' && bankAccount?.bank
    ? [PAYMENT_METHOD_LABELS[lang].transfer, bankAccount.bank, acctMask].filter(Boolean).join(' · ')
    : PAYMENT_METHOD_LABELS[lang][paymentMethod]
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US')

  const otMultiplier = (1 + otRatePercent / 100).toFixed(2)

  // Country-specific labels and currency. US uses its statutory names (Medicare/SS/Federal);
  // DR & every other country use the language-map deduction labels.
  const isUS = country.toLowerCase().includes('united states') || country.toLowerCase() === 'us'
  const countryL = isUS ? US_DEDUCTION_LABELS : { sfs: l.sfs, afp: l.afp, isr: l.isr }
  const fmt = makeFmt(getCurrencySymbol(country))

  const payAdvanceAmt    = lookupDed(c.customDeductionsBreakdown, ['advance', 'adelanto'])
  const dependentTSSAmt  = lookupDed(c.customDeductionsBreakdown, ['dependent tss', 'tss depend', 'depend'])
  const complementaryAmt = lookupDed(c.customDeductionsBreakdown, ['complementary', 'complementario'])
  const remainingDeds    = otherDeds(c.customDeductionsBreakdown)

  // "Salary for the month applicable to ISR" = monthly net base (net 1st + net 2nd fortnight)
  const isrSalaryDisplay = c.isrMonthlyBase

  // Column flex widths — earnings: [desc 5, hours 1.5, rate 2.5, amount 2]
  const eD = 5, eH = 1.5, eR = 2.5, eA = 2
  // deductions: [desc 5.5, rate 1.5, arrow 0.5, amount 2]
  const dD = 5.5, dR = 1.5, dArr = 0.5, dA = 2

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── HEADER ── */}
        <View style={S.header}>
          <View style={S.logoWrap}>
            {logo && (
              <Image style={S.logo} src={logo} />
            )}
            <View>
              <Text style={S.companyName}>{company.name}</Text>
              {!!company.rnc && <Text style={S.companyMeta}>{l.rnc}: {company.rnc}</Text>}
              {!!company.address && <Text style={S.companyMeta}>{company.address}</Text>}
              {!!company.phone && <Text style={S.companyMeta}>{company.phone}</Text>}
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.stubTitle}>{l.stub}</Text>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{l.dateRange}:</Text>
              <Text style={S.metaValue}>{startDate} – {endDate}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{l.payDate}:</Text>
              <Text style={S.metaValue}>{today}</Text>
            </View>
          </View>
        </View>

        {/* ── EMPLOYEE BOX ── */}
        <View style={S.empBox}>
          <View style={{ flex: 1 }}>
            <Text style={S.empName}>{emp.firstName} {emp.lastName}</Text>
            <Text style={S.empMeta}>{l.paymentMethod}: <Text style={S.empMetaValue}>{methodLabel}</Text></Text>
            <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 1 }}>
              {!!emp.jobTitle && (
                <Text style={S.empMeta}>{l.position}: <Text style={S.empMetaValue}>{emp.jobTitle}</Text></Text>
              )}
              {!!emp.department && (
                <Text style={S.empMeta}>{l.dept}: <Text style={S.empMetaValue}>{emp.department}</Text></Text>
              )}
              <Text style={S.empMeta}>{l.empId}: <Text style={S.empMetaValue}>{emp.id}</Text></Text>
            </View>
          </View>
        </View>

        {/* ── EARNINGS TABLE ── */}
        <View style={S.section}>
          {/* Header */}
          <View style={[S.tHead, S.earnHead]}>
            <Text style={[S.earnHeadText, { flex: eD }]}>{l.payDesc}</Text>
            <Text style={[S.earnHeadText, { flex: eH, textAlign: 'right' }]}>{l.hours}</Text>
            <Text style={[S.earnHeadText, { flex: eR, textAlign: 'right' }]}>{l.rate}</Text>
            <Text style={[S.earnHeadText, { flex: eA, textAlign: 'right' }]}>{l.total}</Text>
          </View>

          {/* Regular hours */}
          <View style={S.tRow}>
            <Text style={[S.earnCell, { flex: eD }]}>{l.regular}</Text>
            <Text style={[S.earnCell, { flex: eH, textAlign: 'right' }]}>{regularDisplayHours}</Text>
            <Text style={[S.earnCell, { flex: eR, textAlign: 'right' }]}>{fmt(effectiveRate)}/hr</Text>
            <Text style={[S.earnCellBold, { flex: eA, textAlign: 'right' }]}>{fmt(c.regularPay)}</Text>
          </View>

          {/* Night incentive (always shown, default 0) */}
          <View style={S.tRow}>
            <Text style={[S.earnCell, { flex: eD }]}>{l.night}</Text>
            <Text style={[S.earnCell, { flex: eH, textAlign: 'right' }]}>{safeNum(c.nightIncentiveHours)}</Text>
            <Text style={[S.earnCell, { flex: eR, textAlign: 'right' }]}>15%</Text>
            <Text style={[S.earnCellBold, { flex: eA, textAlign: 'right' }]}>{fmt(c.nightIncentiveAmount)}</Text>
          </View>

          {/* Double Holiday hours (always shown) */}
          <View style={S.tRow}>
            <Text style={[S.earnCell, { flex: eD }]}>{l.holiday}</Text>
            <Text style={[S.earnCell, { flex: eH, textAlign: 'right' }]}>{safeNum(h.holidayHours)}</Text>
            <Text style={[S.earnCell, { flex: eR, textAlign: 'right' }]}>{fmt(effectiveRate)}/hr × {holidayRatePercent}%</Text>
            <Text style={[S.earnCellBold, { flex: eA, textAlign: 'right' }]}>{fmt(c.holidayPay)}</Text>
          </View>

          {/* Overtime hours (always shown) */}
          <View style={S.tRow}>
            <Text style={[S.earnCell, { flex: eD }]}>{l.ot}</Text>
            <Text style={[S.earnCell, { flex: eH, textAlign: 'right' }]}>{safeNum(h.otHours)}</Text>
            <Text style={[S.earnCell, { flex: eR, textAlign: 'right' }]}>{fmt(effectiveRate)}/hr × {otMultiplier}</Text>
            <Text style={[S.earnCellBold, { flex: eA, textAlign: 'right' }]}>{fmt(c.otPay)}</Text>
          </View>

          {/* GROSS TOTAL */}
          <View style={S.tTotalRow}>
            <Text style={[S.earnTotal, { flex: eD }]}>{l.grossTotal}</Text>
            <Text style={[S.earnTotal, { flex: eH }]}> </Text>
            <Text style={[S.earnTotal, { flex: eR }]}> </Text>
            <Text style={[S.earnTotalValue, { flex: eA, textAlign: 'right' }]}>{fmt(c.grossPay)}</Text>
          </View>
        </View>

        {/* ── DEDUCTIONS TABLE ── */}
        <View style={S.section}>
          {/* Header */}
          <View style={[S.tHead, S.dedHead]}>
            <Text style={[S.dedHeadText, { flex: dD }]}>{l.deductions}</Text>
            <Text style={[S.dedHeadText, { flex: dR, textAlign: 'center' }]}>{l.rateCol}</Text>
            <Text style={[S.dedHeadText, { flex: dArr }]}> </Text>
            <Text style={[S.dedHeadText, { flex: dA, textAlign: 'right' }]}>{l.total}</Text>
          </View>

          {/* SFS / Medicare */}
          <View style={S.tRow}>
            <Text style={[S.dedLabel, { flex: dD }]}>{countryL.sfs}</Text>
            <Text style={[S.dedRate, { flex: dR, textAlign: 'center' }]}>{isUS ? '1.45%' : '3.04%'}</Text>
            <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
            <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(c.sfsAmount)}</Text>
          </View>

          {/* AFP / Social Security */}
          <View style={S.tRow}>
            <Text style={[S.dedLabel, { flex: dD }]}>{countryL.afp}</Text>
            <Text style={[S.dedRate, { flex: dR, textAlign: 'center' }]}>{isUS ? '6.2%' : '2.87%'}</Text>
            <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
            <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(c.afpAmount)}</Text>
          </View>

          {/* Pay Advance Deduction */}
          <View style={S.tRow}>
            <Text style={[S.dedLabel, { flex: dD }]}>{l.payAdvance}</Text>
            <Text style={[S.dedRate, { flex: dR }]}> </Text>
            <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
            <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(payAdvanceAmt)}</Text>
          </View>

          {/* Dependent TSS retention */}
          <View style={S.tRow}>
            <Text style={[S.dedLabel, { flex: dD }]}>{l.dependentTSS}</Text>
            <Text style={[S.dedRate, { flex: dR }]}> </Text>
            <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
            <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(dependentTSSAmt)}</Text>
          </View>

          {/* ISR — single line with the month's retained ISR. Hidden on the DR 1st
              quincena, where ISR is deferred to the 2nd fortnight. */}
          {!c.isrDeferred && (
            <>
              <View style={S.tRow}>
                <Text style={[S.dedLabel, { flex: dD }]}>{countryL.isr}</Text>
                <Text style={[S.dedRate, { flex: dR }]}> </Text>
                <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
                <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(c.isrPeriod)}</Text>
              </View>

              {/* Pending vacation ISR collected this period + total */}
              {safeNum(c.vacationIsr) > 0 && (
                <>
                  <View style={S.tRow}>
                    <Text style={[S.dedLabel, { flex: dD }]}>{l.vacationIsr}</Text>
                    <Text style={[S.dedRate, { flex: dR }]}> </Text>
                    <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
                    <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(c.vacationIsr)}</Text>
                  </View>
                  <View style={S.tRow}>
                    <Text style={[S.dedLabel, { flex: dD, fontFamily: 'Roboto', fontWeight: 700 }]}>{l.isrTotalRetained}</Text>
                    <Text style={[S.dedRate, { flex: dR }]}> </Text>
                    <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
                    <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(safeNum(c.isrPeriod) + safeNum(c.vacationIsr))}</Text>
                  </View>
                </>
              )}

              {/* Salary for the month applicable to ISR */}
              <View style={[S.tRow, { backgroundColor: GRAY_50 }]}>
                <Text style={[S.dedLabel, { flex: dD, color: GRAY_500 }]}>{l.isrSalary}</Text>
                <Text style={[S.dedRate, { flex: dR }]}> </Text>
                <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
                <Text style={[S.dedAmountNeutral, { flex: dA, textAlign: 'right' }]}>{fmt(isrSalaryDisplay)}</Text>
              </View>
            </>
          )}

          {/* Complementary Insurance Dependent */}
          <View style={S.tRow}>
            <Text style={[S.dedLabel, { flex: dD }]}>{l.complementaryIns}</Text>
            <Text style={[S.dedRate, { flex: dR }]}> </Text>
            <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
            <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(complementaryAmt)}</Text>
          </View>

          {/* Any other custom deductions not in the named list */}
          {remainingDeds.map((d) => (
            <View key={d.name} style={S.tRow}>
              <Text style={[S.dedLabel, { flex: dD }]}>{d.name}</Text>
              <Text style={[S.dedRate, { flex: dR }]}> </Text>
              <Text style={[S.dedArrow, { flex: dArr, textAlign: 'center' }]}>{'>'}</Text>
              <Text style={[S.dedAmount, { flex: dA, textAlign: 'right' }]}>{fmt(d.amount)}</Text>
            </View>
          ))}

          {/* Total Deductions */}
          <View style={S.tTotalRow}>
            <Text style={[S.dedTotalLabel, { flex: dD }]}>{l.totalDed}</Text>
            <Text style={[S.dedTotalLabel, { flex: dR }]}> </Text>
            <Text style={[S.dedTotalLabel, { flex: dArr }]}> </Text>
            <Text style={[S.dedTotalValue, { flex: dA, textAlign: 'right' }]}>{fmt(c.totalDeductions)}</Text>
          </View>

          {/* NET INCOME */}
          <View style={S.netRow}>
            <Text style={[S.netLabel, { flex: dD + dR + dArr }]}>{l.netPay}</Text>
            <Text style={[S.netValue, { flex: dA, textAlign: 'right' }]}>{fmt(c.netPay)}</Text>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>{company.name}{company.rnc ? ` — ${l.rnc} ${company.rnc}` : ''}</Text>
          <Text style={S.footerText}>{l.generatedOn} {today}</Text>
        </View>

      </Page>
    </Document>
  )
}
