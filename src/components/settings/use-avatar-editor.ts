import { useState } from 'react'
import { Alert } from 'react-native'

import { queryClient } from '@/components/providers'
import { showActionSheet } from '@/lib/action-sheet'
import { errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import {
  pickAvatar,
  removeAvatar,
  uploadAvatar,
  UploadError,
  type Photo,
} from '@/lib/upload'
import type { ProfileData } from '@/shared/settings'

/**
 * Зміна фото профілю — одна для шапки налаштувань (камера на аватарі) і
 * екрана «Профіль»: системне меню «Вибрати нове / Видалити», обрізка
 * квадратом, хмара, профіль. Фото зберігається одразу, як на сайті.
 *
 * `current` — фото, яке є зараз (із сесії чи з форми профілю). Поки нове
 * вантажиться, видно його прев'ю.
 */
export function useAvatarEditor(current: Photo) {
  const { refetch } = authClient.useSession()
  const [local, setLocal] = useState<Photo | null>(null)
  const [busy, setBusy] = useState(false)
  const avatar = local ?? current

  /** Нове фото — у кеш форми профілю й у сесію (шапка, бічна панель). */
  async function sync(next: Photo) {
    setLocal(next)
    queryClient.setQueryData<ProfileData>(['me', 'profile'], (old) =>
      old
        ? {
            ...old,
            user: {
              ...old.user,
              avatar: next.url || null,
              avatarPublicId: next.publicId || null,
            },
          }
        : old,
    )
    await refetch({ query: { disableCookieCache: true } }).catch(() => {})
  }

  async function upload() {
    const asset = await pickAvatar().catch(() => null)
    if (!asset) return
    const prev = avatar
    // Обране видно одразу, поки воно летить у хмару.
    setLocal({ url: asset.uri, publicId: prev.publicId })
    setBusy(true)
    try {
      await sync(await uploadAvatar(asset))
    } catch (err) {
      setLocal(prev)
      Alert.alert(
        'Не вдалося завантажити фото',
        err instanceof UploadError ? err.message : errorText(err),
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await removeAvatar()
      await sync({ url: '', publicId: '' })
    } catch (err) {
      Alert.alert('Не вдалося видалити фото', errorText(err))
    } finally {
      setBusy(false)
    }
  }

  function change() {
    if (busy) return
    if (!avatar.url) return void upload()
    showActionSheet(undefined, [
      { label: 'Вибрати нове фото', onPress: () => void upload() },
      { label: 'Видалити фото', destructive: true, onPress: () => void remove() },
    ])
  }

  return { avatar, busy, change }
}
