import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { UserMenu } from './UserMenu'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  const toggleLang = () => {
    const next = currentLang === 'en' ? 'es' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-border bg-card px-4 md:justify-end md:px-6">
      {/* Hamburger — opens the sidebar drawer on mobile */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className="font-semibold tracking-wide"
          aria-label="Toggle language"
        >
          {currentLang === 'en' ? 'ES' : 'EN'}
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
