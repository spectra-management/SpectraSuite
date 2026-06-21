import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Upload, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu'
import { toast } from '@/shared/hooks/useToast'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { useRrhhPhotos } from '@/modules/rrhh/hooks/useRrhhPhotos'
import { MAX_PHOTO_BYTES } from '@/modules/rrhh/lib/photoStorage'
import type { RrhhEmployee } from '@/modules/rrhh/types'

/**
 * Profile-header avatar with an admin-only edit control.
 *
 * - Non-admins (`canEdit === false`) just see the avatar — no overlay, ever.
 * - Admins get a camera button that opens an "Upload / Remove" menu. Uploads are
 *   validated client-side (image/* only, ≤ 5 MB) and stored APP-LOCALLY in Supabase —
 *   this NEVER writes to BambooHR.
 */
export function RrhhPhotoEditor({
  employee,
  proxiedSrc,
  customSrc,
  canEdit,
}: {
  employee: RrhhEmployee
  /** Proxied BambooHR photo URL. */
  proxiedSrc?: string
  /** Current custom (Supabase) photo URL, if any. */
  customSrc?: string
  /** Whether the current user may edit the photo (RBAC admin check). */
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const { upload, remove, busy } = useRrhhPhotos()
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => inputRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: t('rrhh.photo.invalidType') })
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast({ variant: 'destructive', title: t('rrhh.photo.tooLarge') })
      return
    }

    try {
      await upload(employee.id, file)
      toast({ variant: 'success', title: t('rrhh.photo.uploaded') })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('rrhh.photo.uploadFailed'),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const onRemove = async () => {
    try {
      await remove(employee.id)
      toast({ variant: 'success', title: t('rrhh.photo.removed') })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('rrhh.photo.removeFailed'),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div className="relative shrink-0">
      <RrhhAvatar employee={employee} customSrc={customSrc} src={proxiedSrc} size="xl" />

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                title={t('rrhh.photo.edit')}
                aria-label={t('rrhh.photo.edit')}
                className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openPicker() }}>
                <Upload className="mr-2 h-4 w-4" />
                {customSrc ? t('rrhh.photo.replace') : t('rrhh.photo.upload')}
              </DropdownMenuItem>
              {customSrc && (
                <DropdownMenuItem
                  onSelect={() => void onRemove()}
                  className="text-red-600 focus:text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('rrhh.photo.remove')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </>
      )}
    </div>
  )
}
