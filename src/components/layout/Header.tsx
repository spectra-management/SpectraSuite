import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { UserMenu } from './UserMenu'

export function Header() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  const toggleLang = () => {
    const next = currentLang === 'en' ? 'es' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <header className="flex h-16 items-center justify-end gap-3 border-b border-border bg-white px-6">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLang}
        className="font-semibold tracking-wide"
        aria-label="Toggle language"
      >
        {currentLang === 'en' ? 'ES' : 'EN'}
      </Button>
      <UserMenu />
    </header>
  )
}
