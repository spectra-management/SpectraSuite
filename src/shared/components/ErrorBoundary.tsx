import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  /** Center the fallback over the full viewport — used when mounted at the app root. */
  fullScreen?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const card = (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <div>
            <p className="font-semibold text-red-700">
              {this.props.fallbackTitle ?? 'Something went wrong'}
            </p>
            <p className="mt-1 text-sm text-red-500">{this.state.error.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      )
      if (this.props.fullScreen) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
            <div className="w-full max-w-md">{card}</div>
          </div>
        )
      }
      return card
    }
    return this.props.children
  }
}
