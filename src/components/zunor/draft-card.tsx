import { Image } from 'expo-image'
import { Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import type { ZunorDraft } from '@/shared/zunor'

/**
 * Готова заявка від Zunor. Створює її СИСТЕМА (POST /api/jobs), коли
 * людина підтвердила, — не модель. «Змінити» повертає в розмову.
 */
export function DraftCard({
  draft,
  photos,
  creating,
  duplicateTitle,
  onCreate,
  onEdit,
}: {
  draft: ZunorDraft
  /** Фото з розмови — підуть у заявку разом із нею. */
  photos: string[]
  creating: boolean
  /** Схожа відкрита заявка (409 від сервера) — кнопка тоді створює другу свідомо. */
  duplicateTitle: string | null
  onCreate: () => void
  onEdit: () => void
}) {
  return (
    <View
      className="gap-4 rounded-[24px] bg-card p-4"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="gap-1">
        <Text className="text-[13px] font-medium text-muted-foreground">
          Заявка готова
        </Text>
        <Text className="text-[19px] font-semibold leading-[25px] text-foreground">
          {draft.title}
        </Text>
      </View>

      {draft.summary.length ? (
        <View className="gap-2">
          {draft.summary.map((row) => (
            <View key={row.label} className="flex-row gap-3">
              <Text className="w-[38%] text-[14px] leading-[20px] text-muted-foreground">
                {row.label}
              </Text>
              <Text className="flex-1 text-[15px] leading-[20px] text-foreground">
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {draft.description ? (
        <Text className="text-[14px] leading-[20px] text-muted-foreground">
          {draft.description}
        </Text>
      ) : null}

      {photos.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {photos.map((url) => (
            <Image
              key={url}
              source={url}
              contentFit="cover"
              style={{ width: 56, height: 56, borderRadius: 10 }}
            />
          ))}
        </View>
      ) : null}

      {duplicateTitle ? (
        <View className="gap-1 rounded-[14px] bg-secondary p-3">
          <Text className="text-[14px] font-semibold text-foreground">
            Схожа заявка вже шукає майстра
          </Text>
          <Text className="text-[14px] leading-[19px] text-muted-foreground">
            «{duplicateTitle}». Якщо це інше прибирання — створіть ще одну.
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        <Button onPress={onCreate} loading={creating}>
          {duplicateTitle ? 'Все одно створити' : 'Створити заявку'}
        </Button>
        <Button variant="secondary" onPress={onEdit} disabled={creating}>
          Змінити
        </Button>
      </View>
    </View>
  )
}
