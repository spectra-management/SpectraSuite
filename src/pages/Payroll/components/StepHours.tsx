import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmployeesStore } from '@/store/employeesStore'
import { formatCurrency, getInitials } from '@/lib/utils'
import { roundHalfUp } from '@/lib/payroll/calculations'
import type { EmployeeHoursEntry } from '@/types'

interface Props {
  employeeHours: EmployeeHoursEntry[]
  startDate: string
  endDate: string
  onNext: (hours: EmployeeHoursEntry[]) => void
  onBack: () => void
}

export function StepHours({ employeeHours, startDate, endDate, onNext, onBack }: Props) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const [hours, setHours] = useState<EmployeeHoursEntry[]>(employeeHours)

  const updateHours = (employeeId: string, field: 'regularHours' | 'otHours' | 'holidayHours', raw: string) => {
    const val = roundHalfUp(parseFloat(raw) || 0, 2)
    setHours((prev) =>
      prev.map((h) =>
        h.employeeId === employeeId
          ? { ...h, [field]: val, source: 'manual', editedManually: true }
          : h,
      ),
    )
  }

  const totalHours = (h: EmployeeHoursEntry) =>
    roundHalfUp(h.regularHours + h.otHours + h.holidayHours, 2)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>{t('payroll.review.title')}</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  {startDate} – {endDate}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {hours.length} {t('common.employees')}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-48">
                    {t('payroll.review.employee')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.regularHours')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.otHours')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.holidayHours')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.totalHours')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.payRate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.source')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {hours.map((h) => {
                  const emp = employees.find((e) => e.id === h.employeeId)
                  if (!emp) return null
                  return (
                    <tr key={h.employeeId} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                          <span className="font-medium text-gray-900 text-xs">
                            {emp.firstName} {emp.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <HoursInput
                          value={h.regularHours}
                          onChange={(v) => updateHours(h.employeeId, 'regularHours', v)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <HoursInput
                          value={h.otHours}
                          onChange={(v) => updateHours(h.employeeId, 'otHours', v)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <HoursInput
                          value={h.holidayHours}
                          onChange={(v) => updateHours(h.employeeId, 'holidayHours', v)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {totalHours(h)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(emp.payRate)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={h.editedManually ? 'warning' : h.source === 'hubstaff' ? 'default' : 'secondary'}>
                          {h.editedManually
                            ? <><Pencil className="mr-1 h-2.5 w-2.5" />{t('payroll.review.manual')}</>
                            : h.source === 'hubstaff'
                            ? t('payroll.review.hubstaff')
                            : t('payroll.review.manual')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
        <Button onClick={() => onNext(hours)}>{t('payroll.calculate.calculate')}</Button>
      </div>
    </div>
  )
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      min="0"
      step="0.5"
      className="h-7 w-20 text-right text-xs ml-auto"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
