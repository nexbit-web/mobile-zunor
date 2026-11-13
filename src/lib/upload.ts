// Фото — тим самим шляхом, що на сайті (jobs/new/+page.svelte,
// avatar-uploader.svelte): підпис від сервера (POST /api/upload/signature)
// → файл прямо в Cloudinary, у теку користувача. Сервер бере лише
// посилання й publicId.

import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'

import { api } from './api'

export interface Photo {
  url: string
  publicId: string
}

/** Як на сайті: не більше 6 фото до заявки, кожне до 10 МБ. */
export const MAX_PHOTOS = 6
const MAX_BYTES = 10 * 1024 * 1024

/** Вибір фото з галереї; порожньо — людина передумала. */
export async function pickPhotos(
  limit: number,
): Promise<ImagePicker.ImagePickerAsset[]> {
  if (limit <= 0) return []
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    // JPEG із розумним стисненням: фото з iPhone (HEIC, 5–10 МБ) інакше
    // довго вантажились би й упирались у ліміт.
    quality: 0.8,
  })
  if (res.canceled) return []
  return res.assets.slice(0, limit)
}

export class UploadError extends Error {}

/** Фото профілю: одне, з квадратною обрізкою системним редактором. */
export async function pickAvatar(): Promise<ImagePicker.ImagePickerAsset | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  })
  return res.canceled ? null : (res.assets[0] ?? null)
}

export function uploadJobPhoto(asset: ImagePicker.ImagePickerAsset): Promise<Photo> {
  return uploadImage(asset, 'job')
}

/**
 * Нове фото профілю: у хмару, потім у профіль (POST /api/user/media), як
 * на сайті. Старе прибирає сервер.
 */
export async function uploadAvatar(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Photo> {
  const photo = await uploadImage(asset, 'avatar')
  await api('/api/user/media', {
    method: 'POST',
    json: { kind: 'avatar', url: photo.url, publicId: photo.publicId },
  })
  return photo
}

/**
 * Приклад роботи майстра — у хмару, як на сайті (portfolio-uploader:
 * теку заявок користувача). У профіль його пише форма своїм «Зберегти»
 * (POST /api/profile/master), а не це завантаження.
 */
export function uploadPortfolioPhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Photo> {
  return uploadImage(asset, 'job')
}

/**
 * Прибрати з хмари приклад роботи, який так і не зберегли (форму
 * скасували): сервер стирає файл, лише якщо він у теці цієї людини.
 */
export async function discardPortfolioPhoto(publicId: string): Promise<void> {
  await api('/api/user/media', {
    method: 'POST',
    json: { kind: 'portfolio-remove', publicId },
  })
}

/** Вкладення повідомлення — те, що чекає POST /api/chats/[id]/messages. */
export interface ChatAttachment {
  url: string
  publicId: string
  mimeType: string
  size: number
  name: string
}

/**
 * Фото в чат — у теку чатів користувача (`kind: 'chat'`, як
 * message-composer на сайті); сервер приймає лише посилання з нашої хмари.
 */
export async function uploadChatPhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<ChatAttachment> {
  const photo = await uploadImage(asset, 'chat')
  return {
    ...photo,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
    name: asset.fileName ?? 'photo.jpg',
  }
}

/** Прибрати фото профілю — і з профілю, і з хмари (вирішує сервер). */
export async function removeAvatar(): Promise<void> {
  await api('/api/user/media', {
    method: 'POST',
    json: { kind: 'avatar-remove' },
  })
}

async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  kind: 'job' | 'avatar' | 'chat',
): Promise<Photo> {
  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    throw new UploadError('Фото більше за 10 МБ')
  }

  const sig = await api<{
    apiKey: string
    timestamp: number
    signature: string
    folder: string
    cloudName: string
    /** Для аватара — сталий publicId: нове фото перезаписує старе. */
    publicId?: string
  }>('/api/upload/signature', {
    method: 'POST',
    json: { kind, resourceType: 'image' },
  })

  const form = new FormData()
  if (Platform.OS === 'web') {
    // У браузері uri — blob:/data:, файл беремо з нього.
    const name = asset.fileName ?? 'photo.jpg'
    form.append('file', await (await fetch(asset.uri)).blob(), name)
  } else {
    // Глобальний fetch тут — expo/fetch (SDK 58), і файл у вигляді
    // `{ uri, name, type }` (старий спосіб React Native) він не бере:
    // кидав «Unsupported FormDataPart», і жодне фото не вантажилось.
    // File з expo-file-system він читає сам (ім'я й тип — з файлу).
    form.append('file', new File(asset.uri) as unknown as Blob)
  }
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  if (sig.publicId) {
    form.append('public_id', sig.publicId)
    form.append('overwrite', 'true')
  }

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: 'POST', body: form },
  )
  const data = (await res.json().catch(() => null)) as {
    secure_url?: string
    public_id?: string
    error?: { message?: string }
  } | null
  if (!res.ok || !data?.secure_url || !data.public_id) {
    throw new UploadError(data?.error?.message ?? 'Не вдалося завантажити фото')
  }
  return { url: data.secure_url, publicId: data.public_id }
}
