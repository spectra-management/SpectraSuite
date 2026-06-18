import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  key: string
  label: string
}

interface Props {
  steps: Step[]
  currentStep: number
}

export function PayrollStepper({ steps, currentStep }: Props) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, idx) => {
          const done = idx < currentStep
          const active = idx === currentStep
          return (
            <li key={step.key} className={cn('flex items-center', idx < steps.length - 1 ? 'flex-1' : '')}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                    done && 'bg-emerald-600 text-white',
                    active && 'bg-emerald-600 text-white ring-4 ring-emerald-100',
                    !done && !active && 'bg-secondary text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    active ? 'text-foreground' : done ? 'text-emerald-600' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn('mx-4 h-px flex-1 transition-all', done ? 'bg-emerald-200' : 'bg-secondary')} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
